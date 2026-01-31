// ============================================
// ORDER CONTROLLER - Avec Stripe Connect & Transactions
// ============================================

const OrderModel = require('./order.model');
const ProductModel = require('../products/product.model');
const logger = require('../../utils/logger');
const { pool } = require('../../config/db'); // 🎯 Import pool pour transactions
const stripe = require('../../config/stripe');

// ==========================================
// HELPERS
// ==========================================

const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `BRD-${timestamp}-${random}`;
};

// ==========================================
// CONTROLLER
// ==========================================

const OrderController = {
    
    // ==========================================
    // Liste des commandes (client)
    // ==========================================
    list: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { limit = 20, offset = 0 } = req.query;

            const orders = await OrderModel.findByUser(
                userId,
                parseInt(limit),
                parseInt(offset)
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

    // ==========================================
    // Détail d'une commande
    // ==========================================
    detail: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;

            const order = await OrderModel.findById(id);

            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            // Vérifier autorisation (propriétaire, admin, ou fournisseur concerné)
            if (order.user_id !== userId && req.user.role !== 'admin') {
                const supplierCheck = await pool.query(
                    `SELECT 1 FROM order_items oi 
                     JOIN suppliers s ON oi.supplier_id = s.id 
                     WHERE oi.order_id = $1 AND s.user_id = $2 LIMIT 1`,
                    [id, userId]
                );
                
                if (supplierCheck.rows.length === 0) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
                }
            }

            res.json({ success: true, data: { order } });

        } catch (error) {
            logger.error('❌ Erreur détail commande:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // ==========================================
    // CRÉER UNE COMMANDE (Checkout avec Stripe Connect)
    // ==========================================
    create: async (req, res) => {
        const client = await pool.connect(); // 🎯 CORRECTION: Utiliser pool.connect()
        
        try {
            await client.query('BEGIN'); // 🎯 CORRECTION: Transaction propre
            
            const userId = req.user.userId;
            const {
                items,
                shipping_address,
                shipping_city,
                shipping_postal_code,
                shipping_country_code = 'FR',
                billing_address,
                customer_email,
                customer_first_name,
                customer_last_name,
                customer_phone
            } = req.body;

            // Validation
            if (!items || !Array.isArray(items) || items.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(400).json({ success: false, message: 'Le panier est vide' });
            }

            // Calcul des totaux et vérification stock
            let subtotal = 0;
            let vatAmount = 0;
            const orderItems = [];
            const supplierAmounts = {}; // Pour Stripe Connect

            for (const item of items) {
                const product = await ProductModel.findById(item.product_id);
                
                if (!product) {
                    await client.query('ROLLBACK');
                    client.release();
                    return res.status(404).json({ 
                        success: false, 
                        message: `Produit ${item.product_id} non trouvé` 
                    });
                }

                if (product.stock_quantity < item.quantity) {
                    await client.query('ROLLBACK');
                    client.release();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Stock insuffisant pour ${product.name} (dispo: ${product.stock_quantity})` 
                    });
                }

                const unitPrice = parseFloat(product.price);
                const quantity = parseInt(item.quantity);
                const totalPrice = unitPrice * quantity;
                const vatRate = parseFloat(product.vat_rate || 20);
                const vatOnItem = totalPrice * (vatRate / 100);

                // Commission Brandia 15%
                const commissionRate = 0.15;
                const commissionAmount = totalPrice * commissionRate;
                const supplierAmount = totalPrice - commissionAmount;

                subtotal += totalPrice;
                vatAmount += vatOnItem;

                // Grouper par fournisseur pour Stripe Connect
                if (!supplierAmounts[product.supplier_id]) {
                    supplierAmounts[product.supplier_id] = {
                        amount: 0,
                        stripe_account_id: null
                    };
                }
                supplierAmounts[product.supplier_id].amount += supplierAmount;

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
            const orderNumber = generateOrderNumber();

            // Récupérer les comptes Stripe des fournisseurs
            for (const supplierId of Object.keys(supplierAmounts)) {
                const suppResult = await client.query(
                    'SELECT stripe_account_id FROM suppliers WHERE id = $1',
                    [supplierId]
                );
                if (suppResult.rows[0]?.stripe_account_id) {
                    supplierAmounts[supplierId].stripe_account_id = suppResult.rows[0].stripe_account_id;
                }
            }

            // 🔥 STRIPE CONNECT PAYMENTINTENT
            let clientSecret = null;
            let stripePaymentIntentId = null;
            let applicationFee = Math.round((totalAmount * 0.15) * 100); // 15% commission en centimes
            
            if (process.env.STRIPE_SECRET_KEY && totalAmount > 0) {
                try {
                    // 🎯 Stripe Connect: On destination pour le transfert automatique au fournisseur principal
                    // Si plusieurs fournisseurs, on utilise transfer_group et on fait les transferts après
                    const primarySupplierId = Object.keys(supplierAmounts)[0];
                    const primaryStripeAccount = supplierAmounts[primarySupplierId]?.stripe_account_id;
                    
                    const paymentIntentData = {
                        amount: Math.round(totalAmount * 100),
                        currency: 'eur',
                        automatic_payment_methods: { enabled: true },
                        application_fee_amount: applicationFee, // Commission Brandia
                        transfer_group: orderNumber,
                        metadata: {
                            order_number: orderNumber,
                            user_id: userId.toString(),
                            order_type: 'marketplace',
                            supplier_count: Object.keys(supplierAmounts).length.toString()
                        },
                        description: `Commande ${orderNumber} - Brandia Marketplace`
                    };

                    // Si on a un compte Stripe Connect du fournisseur, on destination
                    if (primaryStripeAccount) {
                        paymentIntentData.transfer_data = {
                            destination: primaryStripeAccount
                        };
                    }
                    
                    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
                    
                    clientSecret = paymentIntent.client_secret;
                    stripePaymentIntentId = paymentIntent.id;
                    
                    logger.info(`💳 PaymentIntent Connect créé: ${stripePaymentIntentId} | Order: ${orderNumber}`);
                } catch (stripeError) {
                    logger.error('❌ Erreur Stripe:', stripeError);
                    // Continue sans Stripe si erreur (mode test)
                }
            }

            // Insérer la commande
            const orderResult = await client.query(
                `INSERT INTO orders (
                    user_id, order_number, status, total_amount, subtotal, 
                    shipping_cost, vat_amount, currency,
                    customer_email, customer_first_name, customer_last_name, customer_phone,
                    shipping_address, shipping_city, shipping_postal_code, shipping_country_code,
                    billing_address, stripe_payment_intent_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                RETURNING *`,
                [
                    userId, orderNumber, 
                    stripePaymentIntentId ? 'pending_payment' : 'pending',
                    totalAmount, subtotal, shippingCost, vatAmount, 'EUR',
                    customer_email || req.user.email,
                    customer_first_name || req.user.first_name,
                    customer_last_name || req.user.last_name,
                    customer_phone,
                    shipping_address, shipping_city, shipping_postal_code, shipping_country_code,
                    billing_address || shipping_address,
                    stripePaymentIntentId
                ]
            );
            
            const order = orderResult.rows[0];

            // Insérer les items et maj stock
            for (const item of orderItems) {
                await client.query(
                    `INSERT INTO order_items (
                        order_id, product_id, supplier_id, product_name, product_sku,
                        product_image_url, quantity, unit_price, total_price,
                        supplier_amount, commission_amount, vat_rate
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        order.id, item.product_id, item.supplier_id, item.product_name, item.product_sku,
                        item.product_image_url, item.quantity, item.unit_price, item.total_price,
                        item.supplier_amount, item.commission_amount, item.vat_rate
                    ]
                );
                
                // Décrémenter stock
                await client.query(
                    'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                    [item.quantity, item.product_id]
                );
            }

            await client.query('COMMIT'); // 🎯 Validation transaction
            client.release();

            logger.info(`✅ Commande ${orderNumber} créée | Total: ${totalAmount}€ | Stripe: ${stripePaymentIntentId || 'N/A'}`);

            res.status(201).json({
                success: true,
                data: {
                    order: {
                        id: order.id,
                        order_number: orderNumber,
                        total_amount: totalAmount,
                        status: stripePaymentIntentId ? 'pending_payment' : 'pending'
                    },
                    client_secret: clientSecret,
                    requires_payment: !!clientSecret
                }
            });

        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            client.release();
            logger.error('❌ Erreur création commande:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Erreur lors de la création de la commande' 
            });
        }
    },

    // ==========================================
    // Confirmer le paiement (après succès Stripe)
    // ==========================================
    confirmPayment: async (req, res) => {
        try {
            const { order_id, payment_intent_id } = req.body;
            
            if (process.env.STRIPE_SECRET_KEY && payment_intent_id) {
                const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
                
                if (paymentIntent.status === 'succeeded') {
                    // Mettre à jour la commande
                    const result = await pool.query(
                        `UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = $1 RETURNING *`,
                        [order_id]
                    );
                    
                    // Mettre à jour les items
                    await pool.query(
                        `UPDATE order_items SET payment_status = 'paid' WHERE order_id = $1`,
                        [order_id]
                    );
                    
                    logger.info(`💰 Paiement confirmé: Commande ${order_id} | PI: ${payment_intent_id}`);
                    
                    return res.json({
                        success: true,
                        message: 'Paiement confirmé',
                        data: { order: result.rows[0] }
                    });
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `Statut paiement: ${paymentIntent.status}`
                    });
                }
            } else {
                // Mode sans Stripe
                const result = await pool.query(
                    `UPDATE orders SET status = 'paid' WHERE id = $1 RETURNING *`,
                    [order_id]
                );
                return res.json({
                    success: true,
                    message: 'Commande confirmée (mode test)',
                    data: { order: result.rows[0] }
                });
            }
            
        } catch (error) {
            logger.error('❌ Erreur confirmation paiement:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // ==========================================
    // Mettre à jour le statut
    // ==========================================
    updateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, tracking_number } = req.body;

            const validStatuses = [
                'pending', 'pending_payment', 'paid', 'processing', 
                'shipped', 'delivered', 'cancelled', 'refunded'
            ];
            
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Statut invalide' });
            }

            let updateQuery = `UPDATE orders SET status = $1, updated_at = NOW()`;
            let params = [status, id];
            
            if (status === 'shipped' && tracking_number) {
                updateQuery += `, tracking_number = $3, shipped_at = NOW()`;
                params.push(tracking_number);
            }
            
            updateQuery += ` WHERE id = $2 RETURNING *`;
            
            const result = await pool.query(updateQuery, params);
            
            logger.info(`✅ Statut commande mis à jour: ${id} → ${status}`);

            res.json({ 
                success: true, 
                message: 'Statut mis à jour', 
                data: { order: result.rows[0] } 
            });

        } catch (error) {
            logger.error('❌ Erreur mise à jour statut:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // ==========================================
    // Commandes pour dashboard fournisseur
    // ==========================================
    getSupplierOrders: async (req, res) => {
        try {
            const userId = req.user.userId;
            
            const supplierResult = await pool.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', 
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Profil fournisseur non trouvé' 
                });
            }

            const supplierId = supplierResult.rows[0].id;

            const ordersResult = await pool.query(`
                SELECT DISTINCT o.*, 
                       json_agg(json_build_object(
                           'id', oi.id,
                           'product_name', oi.product_name,
                           'product_image_url', oi.product_image_url,
                           'quantity', oi.quantity,
                           'unit_price', oi.unit_price,
                           'total_price', oi.total_price,
                           'supplier_amount', oi.supplier_amount,
                           'commission_amount', oi.commission_amount,
                           'fulfillment_status', oi.fulfillment_status
                       ) ORDER BY oi.id) as items
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT 50
            `, [supplierId]);

            res.json({ 
                success: true, 
                count: ordersResult.rows.length, 
                data: { orders: ordersResult.rows } 
            });

        } catch (error) {
            logger.error('❌ Erreur commandes fournisseur:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // ==========================================
    // Stats pour dashboard fournisseur
    // ==========================================
    getSupplierStats: async (req, res) => {
        try {
            const userId = req.user.userId;
            
            const supplierResult = await pool.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', 
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Fournisseur non trouvé' 
                });
            }

            const supplierId = supplierResult.rows[0].id;

            // Stats globales
            const statsResult = await pool.query(`
                SELECT 
                    COALESCE(SUM(oi.total_price), 0) as total_sales,
                    COALESCE(SUM(oi.supplier_amount), 0) as total_earnings,
                    COUNT(DISTINCT o.id) as total_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'pending' OR o.status = 'processing' THEN o.id END) as pending_orders
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
            `, [supplierId]);

            // Ventes des derniers 30 jours
            const salesResult = await pool.query(`
                SELECT 
                    DATE(o.created_at) as date,
                    SUM(oi.supplier_amount) as amount,
                    COUNT(*) as orders_count
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1 
                AND o.created_at >= NOW() - INTERVAL '30 days'
                AND o.status NOT IN ('cancelled', 'refunded')
                GROUP BY DATE(o.created_at)
                ORDER BY date ASC
            `, [supplierId]);

            res.json({
                success: true,
                data: {
                    stats: {
                        ...statsResult.rows[0],
                        total_sales: parseFloat(statsResult.rows[0].total_sales),
                        total_earnings: parseFloat(statsResult.rows[0].total_earnings)
                    },
                    chart: salesResult.rows
                }
            });

        } catch (error) {
            logger.error('❌ Erreur stats fournisseur:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = OrderController;