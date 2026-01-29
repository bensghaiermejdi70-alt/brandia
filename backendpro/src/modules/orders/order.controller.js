// ============================================
// ORDER CONTROLLER - Logique CRUD Commandes
// ============================================

const OrderModel = require('./order.model');
const ProductModel = require('../products/product.model');
const logger = require('../../utils/logger');
const { query } = require('../../config/db'); // centralisé pour requêtes raw SQL

// Générer un slug à partir du nom
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + '-' + Date.now();
};

const OrderController = {
    // Liste des commandes de l'utilisateur connecté
    list: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { limit, offset } = req.query;

            const orders = await OrderModel.findByUser(
                userId,
                parseInt(limit) || 20,
                parseInt(offset) || 0
            );

            res.json({
                success: true,
                count: orders.length,
                data: { orders }
            });

        } catch (error) {
            logger.error('❌ Erreur liste commandes:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // Détail d'une commande
    detail: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;

            const order = await OrderModel.findById(id);

            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            if (order.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Accès non autorisé' });
            }

            res.json({ success: true, data: { order } });

        } catch (error) {
            logger.error('❌ Erreur détail commande:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // Créer une commande (checkout)
    create: async (req, res) => {
        try {
            const userId = req.user.userId;
            const {
                items,
                shipping_address,
                shipping_city,
                shipping_postal_code,
                shipping_country_code,
                billing_address,
                billing_city,
                billing_postal_code,
                billing_country_code,
                customer_email,
                customer_first_name,
                customer_last_name,
                customer_phone
            } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, message: 'Le panier est vide' });
            }

            let subtotal = 0;
            let vatAmount = 0;
            const orderItems = [];

            for (const item of items) {
                const product = await ProductModel.findById(item.product_id);
                
                if (!product) {
                    return res.status(404).json({ success: false, message: `Produit ${item.product_id} non trouvé` });
                }

                if (product.stock_quantity < item.quantity) {
                    return res.status(400).json({ success: false, message: `Stock insuffisant pour ${product.name}` });
                }

                const unitPrice = parseFloat(product.price);
                const quantity = item.quantity;
                const totalPrice = unitPrice * quantity;
                const vatRate = parseFloat(product.vat_rate || 20);
                const vatOnItem = totalPrice * (vatRate / 100);

                const commissionRate = 0.15;
                const commissionAmount = totalPrice * commissionRate;
                const supplierAmount = totalPrice - commissionAmount;

                subtotal += totalPrice;
                vatAmount += vatOnItem;

                orderItems.push({
                    product_id: product.id,
                    supplier_id: product.supplier_id,
                    product_name: product.name,
                    product_sku: product.sku,
                    product_image_url: product.main_image_url,
                    quantity,
                    unit_price: unitPrice,
                    vat_rate: vatRate,
                    total_price: totalPrice,
                    supplier_amount: supplierAmount,
                    commission_amount: commissionAmount
                });
            }

            const shippingCost = subtotal > 50 ? 0 : 5.90;
            const totalAmount = subtotal + vatAmount + shippingCost;
            const orderNumber = OrderModel.generateOrderNumber();

            const order = await OrderModel.create({
                user_id: userId,
                order_number: orderNumber,
                customer_email: customer_email || req.user.email,
                customer_first_name,
                customer_last_name,
                customer_phone,
                shipping_address,
                shipping_city,
                shipping_postal_code,
                shipping_country_code: shipping_country_code || 'FR',
                billing_address: billing_address || shipping_address,
                billing_city: billing_city || shipping_city,
                billing_postal_code: billing_postal_code || shipping_postal_code,
                billing_country_code: billing_country_code || shipping_country_code || 'FR',
                subtotal,
                shipping_cost: shippingCost,
                vat_amount: vatAmount,
                discount_amount: 0,
                total_amount: totalAmount,
                currency: 'EUR',
                vat_rate: 20,
                items: orderItems
            });

            logger.info(`✅ Commande créée: ${orderNumber} | Total: ${totalAmount}€ | Client: ${userId}`);

            res.status(201).json({
                success: true,
                message: 'Commande créée',
                data: { order: { id: order.id, order_number: order.order_number, total_amount: order.total_amount, status: order.status } }
            });

        } catch (error) {
            logger.error('❌ Erreur création commande:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // Mettre à jour le statut
    updateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Statut invalide' });
            }

            const order = await OrderModel.updateStatus(id, status);
            logger.info(`✅ Statut commande mis à jour: ${id} → ${status}`);

            res.json({ success: true, message: 'Statut mis à jour', data: { order } });

        } catch (error) {
            logger.error('❌ Erreur mise à jour statut:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // Commandes pour dashboard fournisseur
    getSupplierOrders: async (req, res) => {
        try {
            const userId = req.user.userId;
            const supplierResult = await query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
            }

            const supplierId = supplierResult.rows[0].id;

            const ordersResult = await query(`
                SELECT DISTINCT o.*, 
                       json_agg(json_build_object(
                           'product_name', oi.product_name,
                           'quantity', oi.quantity,
                           'unit_price', oi.unit_price,
                           'total_price', oi.total_price,
                           'fulfillment_status', oi.fulfillment_status
                       )) as items
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `, [supplierId]);

            res.json({ success: true, count: ordersResult.rows.length, data: { orders: ordersResult.rows } });

        } catch (error) {
            logger.error('❌ Erreur commandes fournisseur:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    }
};

module.exports = OrderController;
