// ============================================
// ORDER MODEL - Requêtes DB pour les commandes
// ============================================

const { query, transaction } = require('../../config/db');

const OrderModel = {
    // Créer une commande (avec items)
    create: async ({ user_id, order_number, customer_email, customer_first_name, customer_last_name, customer_phone, shipping_address, shipping_city, shipping_postal_code, shipping_country_code, billing_address, billing_city, billing_postal_code, billing_country_code, subtotal, shipping_cost, vat_amount, discount_amount, total_amount, currency, vat_rate, items }) => {
        
        return await transaction(async (client) => {
            // 1. Créer la commande
            const orderSql = `
                INSERT INTO orders (
                    user_id, order_number, customer_email, customer_first_name, customer_last_name, customer_phone,
                    shipping_address, shipping_city, shipping_postal_code, shipping_country_code,
                    billing_address, billing_city, billing_postal_code, billing_country_code,
                    subtotal, shipping_cost, vat_amount, discount_amount, total_amount,
                    currency, vat_rate, status, payment_status, shipping_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'pending', 'pending', 'pending')
                RETURNING *
            `;
            
            const orderResult = await client.query(orderSql, [
                user_id, order_number, customer_email, customer_first_name, customer_last_name, customer_phone,
                shipping_address, shipping_city, shipping_postal_code, shipping_country_code,
                billing_address, billing_city, billing_postal_code, billing_country_code,
                subtotal, shipping_cost, vat_amount, discount_amount, total_amount,
                currency, vat_rate
            ]);
            
            const order = orderResult.rows[0];

            // 2. Créer les items de commande
            const itemSql = `
                INSERT INTO order_items (
                    order_id, product_id, supplier_id, product_name, product_sku, product_image_url,
                    quantity, unit_price, vat_rate, total_price, supplier_amount, commission_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const orderItems = [];
            for (const item of items) {
                const itemResult = await client.query(itemSql, [
                    order.id,
                    item.product_id,
                    item.supplier_id,
                    item.product_name,
                    item.product_sku,
                    item.product_image_url,
                    item.quantity,
                    item.unit_price,
                    item.vat_rate,
                    item.total_price,
                    item.supplier_amount,
                    item.commission_amount
                ]);
                orderItems.push(itemResult.rows[0]);
            }

            return { ...order, items: orderItems };
        });
    },

    // Récupérer toutes les commandes d'un utilisateur
    findByUser: async (userId, limit = 20, offset = 0) => {
        const sql = `
            SELECT o.*, 
                   json_agg(json_build_object(
                       'id', oi.id,
                       'product_name', oi.product_name,
                       'quantity', oi.quantity,
                       'unit_price', oi.unit_price,
                       'total_price', oi.total_price,
                       'supplier_id', oi.supplier_id
                   )) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = $1
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await query(sql, [userId, limit, offset]);
        return result.rows;
    },

    // Récupérer une commande par ID
    findById: async (orderId) => {
        const sql = `
            SELECT o.*, 
                   json_agg(json_build_object(
                       'id', oi.id,
                       'product_id', oi.product_id,
                       'product_name', oi.product_name,
                       'product_sku', oi.product_sku,
                       'product_image_url', oi.product_image_url,
                       'quantity', oi.quantity,
                       'unit_price', oi.unit_price,
                       'vat_rate', oi.vat_rate,
                       'total_price', oi.total_price,
                       'supplier_amount', oi.supplier_amount,
                       'commission_amount', oi.commission_amount,
                       'fulfillment_status', oi.fulfillment_status,
                       'supplier_id', oi.supplier_id
                   )) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1
            GROUP BY o.id
        `;
        const result = await query(sql, [orderId]);
        return result.rows[0];
    },

    // Récupérer une commande par numéro
    findByOrderNumber: async (orderNumber) => {
        const sql = `
            SELECT o.*, 
                   json_agg(json_build_object(
                       'id', oi.id,
                       'product_name', oi.product_name,
                       'quantity', oi.quantity,
                       'unit_price', oi.unit_price
                   )) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.order_number = $1
            GROUP BY o.id
        `;
        const result = await query(sql, [orderNumber]);
        return result.rows[0];
    },

    // Mettre à jour le statut d'une commande
    updateStatus: async (orderId, status) => {
        const sql = `
            UPDATE orders 
            SET status = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1 
            RETURNING id, status
        `;
        const result = await query(sql, [orderId, status]);
        return result.rows[0];
    },

    // Mettre à jour le statut de paiement
    updatePaymentStatus: async (orderId, paymentStatus, stripePaymentIntentId = null) => {
        const sql = `
            UPDATE orders 
            SET payment_status = $2, stripe_payment_intent_id = $3, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1 
            RETURNING id, payment_status
        `;
        const result = await query(sql, [orderId, paymentStatus, stripePaymentIntentId]);
        return result.rows[0];
    },

    // Commandes par fournisseur (pour le dashboard fournisseur)
    findBySupplier: async (supplierId, limit = 20, offset = 0) => {
        const sql = `
            SELECT DISTINCT o.*, oi.product_name, oi.quantity
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE oi.supplier_id = $1
            ORDER BY o.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await query(sql, [supplierId, limit, offset]);
        return result.rows;
    },

    // Générer un numéro de commande unique
    generateOrderNumber: () => {
        const date = new Date();
        const year = date.getFullYear();
        const random = Math.floor(100000 + Math.random() * 900000);
        return `BRD-${year}-${random}`;
    }
};

module.exports = OrderModel;