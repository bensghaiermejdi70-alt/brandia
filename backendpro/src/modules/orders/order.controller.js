// ============================================
// ORDER CONTROLLER - Avec intégration Stripe
// ============================================

const OrderModel = require('./order.model');
const ProductModel = require('../products/product.model');
const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const stripe = require('../../config/stripe'); // Instance Stripe configurée

// Générer numéro de commande unique
const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `BRD-${timestamp}-${random}`;
};

const OrderController = {
    // Liste des commandes de l'utilisateur connecté
    list: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { limit = 20, offset = 0 } = req.query;

            const orders = await OrderModel.findByUser(userId, parseInt(limit), parseInt(offset));

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

            // Vérifier autorisation (propriétaire ou admin ou fournisseur concerné)
            if (order.user_id !== userId && req.user.role !== 'admin') {
                // Vérifier si c'est un fournisseur qui a des produits dans cette commande
                const supplierCheck = await query(
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

    // Créer une commande (checkout) avec Stripe PaymentIntent
    create: async (req, res) => {
        const client = await query('BEGIN').catch(() => ({ query: () => {} })); // Transaction
        
        try {
            const userId = req.user.userId;
            const {
                items,
                shipping_address,
                shipping_city,
                shipping_postal_code,
                shipping_country_code = 'FR',
                billing_address,
                billing_city,
                billing_postal_code,
                billing_country_code,
                customer_email,
                customer_first_name,
                customer_last_name,
                customer_phone
            } = req.body;

            // Validation
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, message: 'Le panier est vide' });
            }

            // Vérifier que les produits existent et calculer les totaux
            let subtotal = 0;
            let vatAmount = 0;
            const orderItems = [];

            for (const item of items) {
                const product = await ProductModel.findById(item.product_id);
                
                if (!product) {
                    await query('ROLLBACK');
                    return res.status(404).json({ 
                        success: false, 
                        message: `Produit ${item.product_id} non trouvé` 
                    });
                }

                if (product.stock_quantity < item.quantity) {
                    await query('ROLLBACK');
                    return res.status(400).json({ 
                        success: false, 
                        message: `Stock insuffisant pour ${product.name} (disponible: ${product.stock_quantity})` 
                    });
                }

                const unitPrice = parseFloat(product.price);
                const quantity = parseInt(item.quantity);
                const totalPrice = unitPrice * quantity;
                const vatRate = parseFloat(product.vat_rate || 20);
                const vatOnItem = totalPrice * (vatRate / 100);

                // Calcul commission Brandia (15%)
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

            // Calcul frais de port
            const shippingCost = subtotal > 50 ? 0 : 5.90;
            const totalAmount = subtotal + vatAmount + shippingCost;
            const orderNumber = generateOrderNumber();

            // 🔥 CRÉATION PAYMENTINTENT STRIPE (si configuré)
            let clientSecret = null;
            let stripePaymentIntentId = null;
            
            if (process.env.STRIPE_SECRET_KEY && totalAmount > 0) {
                try {
                    const paymentIntent = await stripe.paymentIntents.create({
                        amount: Math.round(totalAmount * 100), // Centimes
                        currency: 'eur',
                        automatic_payment_methods: { enabled: true },
                        metadata: {
                            order_number: orderNumber,
                            user_id: userId.toString(),
                            customer_email: customer_email || req.user.email
                        },
                        description: `Commande ${orderNumber} - Brandia`
                    });
                    
                    clientSecret = paymentIntent.client_secret;
                    stripePaymentIntentId = paymentIntent.id;
                    
                    logger.info(`💳 PaymentIntent créé: ${stripePaymentIntentId} pour commande ${orderNumber}`);
                } catch (stripeError) {
                    logger.error('❌ Erreur Stripe:', stripeError);
                    // On continue sans Stripe si erreur (mode démo) ou on bloque selon config
                    if (process.env.REQUIRE_STRIPE_PAYMENT === 'true') {
                        await query('ROLLBACK');
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Erreur lors de la création du paiement' 
                        });
                    }
                }
            }

            // Créer la commande en DB
            const orderData = {
                user_id: userId,
                order_number: orderNumber,
                customer_email: customer_email || req.user.email,
                customer_first_name: customer_first_name || req.user.first_name,
                customer_last_name: customer_last_name || req.user.last_name,
                customer_phone,
                shipping_address,
                shipping_city,
                shipping_postal_code,
                shipping_country_code,
                billing_address: billing_address || shipping_address,
                billing_city: billing_city || shipping_city,
                billing_postal_code: billing_postal_code || shipping_postal_code,
                billing_country_code: billing_country_code || shipping_country_code,
                subtotal,
                shipping_cost: shippingCost,
                vat_amount: vatAmount,
                discount_amount: 0,
                total_amount: totalAmount,
                currency: 'EUR',
                vat_rate: 20,
                stripe_payment_intent_id: stripePaymentIntentId,
                status: stripePaymentIntentId ? 'pending_payment' : 'pending',
                items: orderItems
            };

            const order = await OrderModel.create(orderData);

            // Décrémenter le stock
            for (const item of orderItems) {
                await query(
                    `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
                    [item.quantity, item.product_id]
                );
            }

            await query('COMMIT');

            logger.info(`✅ Commande créée: ${orderNumber} | Total: ${totalAmount}€ | Client: ${userId} | Stripe: ${stripePaymentIntentId || 'N/A'}`);

            // Réponse succès
            res.status(201).json({
                success: true,
                message: 'Commande créée avec succès',
                data: {
                    order: {
                        id: order.id,
                        order_number: orderNumber,
                        total_amount: totalAmount,
                        status: orderData.status,
                        created_at: new Date()
                    },
                    client_secret: clientSecret, // 🔥 Pour Stripe frontend
                    requires_payment: !!clientSecret
                }
            });

        } catch (error) {
            await query('ROLLBACK').catch(() => {});
            logger.error('❌ Erreur création commande:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Erreur lors de la création de la commande' 
            });
        }
    },

    // Confirmer le paiement (appelé par webhook Stripe ou frontend après succès)
    confirmPayment: async (req, res) => {
        try {
            const { order_id, payment_intent_id } = req.body;
            
            // Vérifier le PaymentIntent avec Stripe
            if (process.env.STRIPE_SECRET_KEY && payment_intent_id) {
                const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
                
                if (paymentIntent.status === 'succeeded') {
                    // Mettre à jour la commande comme payée
                    const order = await OrderModel.updateStatus(order_id, 'paid');
                    
                    // Mettre à jour les items comme payés
                    await query(
                        `UPDATE order_items SET payment_status = 'paid' WHERE order_id = $1`,
                        [order_id]
                    );
                    
                    logger.info(`💰 Paiement confirmé: Commande ${order_id} | PI: ${payment_intent_id}`);
                    
                    return res.json({
                        success: true,
                        message: 'Paiement confirmé',
                        data: { order }
                    });
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `Statut paiement: ${paymentIntent.status}`
                    });
                }
            } else {
                // Mode sans Stripe (tests)
                const order = await OrderModel.updateStatus(order_id, 'paid');
                return res.json({
                    success: true,
                    message: 'Commande confirmée (mode test)',
                    data: { order }
                });
            }
            
        } catch (error) {
            logger.error('❌ Erreur confirmation paiement:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // Mettre à jour le statut
    updateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, tracking_number } = req.body;

            const validStatuses = ['pending', 'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Statut invalide' });
            }

            const order = await OrderModel.updateStatus(id, status);
            
            // Si statut shipped, ajouter numéro de tracking
            if (status === 'shipped' && tracking_number) {
                await query(
                    `UPDATE orders SET tracking_number = $1, shipped_at = NOW() WHERE id = $2`,
                    [tracking_number, id]
                );
            }

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
            
            // Récupérer le supplier_id à partir du user_id
            const supplierResult = await query(
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

            const ordersResult = await query(`
                SELECT DISTINCT o.*, 
                       json_agg(json_build_object(
                           'id', oi.id,
                           'product_name', oi.product_name,
                           'product_image_url', oi.product_image_url,
                           'quantity', oi.quantity,
                           'unit_price', oi.unit_price,
                           'total_price', oi.total_price,
                           'fulfillment_status', oi.fulfillment_status,
                           'commission_amount', oi.commission_amount,
                           'supplier_amount', oi.supplier_amount
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

    // Obtenir les stats pour dashboard fournisseur
    getSupplierStats: async (req, res) => {
        try {
            const userId = req.user.userId;
            
            const supplierResult = await query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', 
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
            }

            const supplierId = supplierResult.rows[0].id;

            // Stats globales
            const statsResult = await query(`
                SELECT 
                    COALESCE(SUM(oi.total_price), 0) as total_sales,
                    COALESCE(SUM(oi.supplier_amount), 0) as total_earnings,
                    COUNT(DISTINCT o.id) as total_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
            `, [supplierId]);

            // Ventes des derniers 30 jours pour graphique
            const salesResult = await query(`
                SELECT 
                    DATE(o.created_at) as date,
                    SUM(oi.supplier_amount) as amount
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
                    stats: statsResult.rows[0],
                    chart: salesResult.rows
                }
            });

        } catch (error) {
            logger.error('❌ Erreur stats fournisseur:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    }
};

module.exports = OrderController;