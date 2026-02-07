// ============================================
// ORDER CONTROLLER - Avec Stripe Connect, Transactions & Emails
// ============================================

const OrderModel = require('./order.model');
const ProductModel = require('../products/product.model');
const logger = require('../../utils/logger');
const { pool } = require('../../config/db');
const stripe = require('../../config/stripe');
const EmailService = require('../../services/email.service');

// ==========================================
// HELPERS
// ==========================================

const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `BRD-${timestamp}-${random}`;
};

// ✅ VALIDATION STRICTE DES IDs
const validateProductId = (id) => {
    if (!id) return null;
    // Convertir en nombre entier
    const numId = parseInt(id);
    // Vérifier que c'est un nombre valide et positif
    if (isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
        return null;
    }
    return numId;
};

// ✅ VALIDATION DES ITEMS DU PANIER
const validateCartItems = (items) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return { valid: false, error: 'Le panier est vide ou invalide' };
    }

    const validatedItems = [];
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Vérifier product_id
        const productId = validateProductId(item.product_id || item.id);
        if (!productId) {
            return { 
                valid: false, 
                error: `Produit invalide à l'index ${i}: ID manquant ou incorrect (${item.product_id || item.id})` 
            };
        }

        // Vérifier quantity
        const quantity = parseInt(item.quantity);
        if (isNaN(quantity) || quantity < 1 || quantity > 99) {
            return { 
                valid: false, 
                error: `Quantité invalide pour le produit ${productId}: ${item.quantity}` 
            };
        }

        // Vérifier price (optionnel mais recommandé)
        const price = parseFloat(item.price);
        if (isNaN(price) || price < 0) {
            return { 
                valid: false, 
                error: `Prix invalide pour le produit ${productId}: ${item.price}` 
            };
        }

        validatedItems.push({
            product_id: productId,
            quantity: quantity,
            price: price,
            original_price: parseFloat(item.original_price) || price,
            name: item.name || 'Produit sans nom'
        });
    }

    return { valid: true, items: validatedItems };
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

            // ✅ Validation ID commande
            const orderId = validateProductId(id);
            if (!orderId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID de commande invalide' 
                });
            }

            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            // Vérifier autorisation (propriétaire, admin, ou fournisseur concerné)
            if (order.user_id !== userId && req.user.role !== 'admin') {
                const supplierCheck = await pool.query(
                    `SELECT 1 FROM order_items oi 
                     JOIN suppliers s ON oi.supplier_id = s.id 
                     WHERE oi.order_id = $1 AND s.user_id = $2 LIMIT 1`,
                    [orderId, userId]
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
    // CRÉER UNE COMMANDE (Checkout avec Stripe Connect + Emails)
    // ==========================================
    create: async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
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

            // ✅ VALIDATION STRICTE DES ITEMS
            const validation = validateCartItems(items);
            if (!validation.valid) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(400).json({ 
                    success: false, 
                    message: validation.error 
                });
            }

            const validatedItems = validation.items;
            logger.info(`[Order] Validation OK: ${validatedItems.length} items pour user ${userId}`);

            // Calcul des totaux et vérification stock
            let subtotal = 0;
            let vatAmount = 0;
            const orderItems = [];
            const supplierAmounts = {};
            let primarySupplierId = null;

            for (const item of validatedItems) {
                // ✅ Utiliser l'ID validé
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
                        message: `Stock insuffisant pour ${product.name} (dispo: ${product.stock_quantity}, demandé: ${item.quantity})` 
                    });
                }

                const unitPrice = parseFloat(product.price);
                const quantity = item.quantity;
                const totalPrice = unitPrice * quantity;
                const vatRate = parseFloat(product.vat_rate || 20);
                const vatOnItem = totalPrice * (vatRate / 100);

                // Commission Brandia 15%
                const commissionRate = 0.15;
                const commissionAmount = totalPrice * commissionRate;
                const supplierAmount = totalPrice - commissionAmount;

                subtotal += totalPrice;
                vatAmount += vatOnItem;

                // ✅ Validation supplier_id
                const supplierId = validateProductId(product.supplier_id);
                if (!supplierId) {
                    await client.query('ROLLBACK');
                    client.release();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Fournisseur invalide pour le produit ${product.name}` 
                    });
                }

                // Grouper par fournisseur
                if (!supplierAmounts[supplierId]) {
                    supplierAmounts[supplierId] = {
                        amount: 0,
                        stripe_account_id: null,
                        company_name: null,
                        email: null
                    };
                }
                supplierAmounts[supplierId].amount += supplierAmount;
                if (!primarySupplierId) primarySupplierId = supplierId;

                orderItems.push({
                    product_id: product.id,
                    supplier_id: supplierId,
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

            // Récupérer les infos des fournisseurs (pour Stripe et Email)
            for (const supplierId of Object.keys(supplierAmounts)) {
                const suppResult = await client.query(
                    `SELECT s.id, s.stripe_account_id, s.company_name, u.email 
                     FROM suppliers s 
                     JOIN users u ON s.user_id = u.id 
                     WHERE s.id = $1`,
                    [supplierId]
                );
                if (suppResult.rows[0]) {
                    supplierAmounts[supplierId].stripe_account_id = suppResult.rows[0].stripe_account_id;
                    supplierAmounts[supplierId].company_name = suppResult.rows[0].company_name;
                    supplierAmounts[supplierId].email = suppResult.rows[0].email;
                }
            }

            // 🔥 STRIPE CONNECT PAYMENTINTENT
            let clientSecret = null;
            let stripePaymentIntentId = null;
            let applicationFee = Math.round((totalAmount * 0.15) * 100);
            
            if (process.env.STRIPE_SECRET_KEY && totalAmount > 0) {
                try {
                    const primaryStripeAccount = supplierAmounts[primarySupplierId]?.stripe_account_id;
                    
                    const paymentIntentData = {
                        amount: Math.round(totalAmount * 100),
                        currency: 'eur',
                        automatic_payment_methods: { enabled: true },
                        application_fee_amount: applicationFee,
                        transfer_group: orderNumber,
                        metadata: {
                            order_number: orderNumber,
                            user_id: userId.toString(),
                            order_type: 'marketplace',
                            supplier_count: Object.keys(supplierAmounts).length.toString()
                        },
                        description: `Commande ${orderNumber} - Brandia Marketplace`
                    };

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
                    // On continue sans Stripe en mode démo
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

            await client.query('COMMIT');

            // 🎯 ENVOI DES EMAILS (Fire and forget - ne bloque pas la réponse)
            try {
                const primarySupplier = supplierAmounts[primarySupplierId];
                
                // ✅ Image fallback si pas d'image produit
                const orderData = {
                    id: order.id,
                    orderNumber: orderNumber,
                    customerName: `${customer_first_name || req.user.first_name} ${customer_last_name || req.user.last_name}`,
                    total: totalAmount,
                    date: order.created_at,
                    items: orderItems.map(item => ({
                        name: item.product_name,
                        quantity: item.quantity,
                        price: item.unit_price,
                        image: item.product_image_url || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=60&h=60&fit=crop',
                        supplierName: supplierAmounts[item.supplier_id]?.company_name || 'Marque'
                    })),
                    supplierName: primarySupplier?.company_name || 'Marque'
                };

                // Email Client (Confirmation commande créée)
                const customerMail = customer_email || req.user.email;
                EmailService.sendOrderConfirmation(customerMail, orderData)
                    .then(result => {
                        if (result.success) {
                            logger.info(`✅ Email confirmation envoyé à ${customerMail} pour commande ${orderNumber}`);
                        } else {
                            logger.error(`⚠️ Échec email confirmation: ${result.error}`);
                        }
                    })
                    .catch(err => logger.error(`Exception email client: ${err.message}`));

                // Email Fournisseur (Nouvelle commande)
                if (primarySupplier?.email) {
                    EmailService.sendNewOrderNotification(primarySupplier.email, orderData, {
                        companyName: primarySupplier.company_name,
                        email: primarySupplier.email
                    })
                        .then(result => {
                            if (result.success) {
                                logger.info(`✅ Email fournisseur envoyé à ${primarySupplier.email} pour commande ${orderNumber}`);
                            } else {
                                logger.error(`⚠️ Échec email fournisseur: ${result.error}`);
                            }
                        })
                        .catch(err => logger.error(`Exception email fournisseur: ${err.message}`));
                }

            } catch (emailError) {
                logger.error('⚠️ Erreur envoi emails:', emailError);
            }

            client.release();

            logger.info(`✅ Commande ${orderNumber} créée | Total: ${totalAmount}€ | Items: ${orderItems.length} | Stripe: ${stripePaymentIntentId || 'N/A'}`);

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
    // Confirmer le paiement
    // ==========================================
    confirmPayment: async (req, res) => {
        try {
            const { order_id, payment_intent_id } = req.body;
            
            // ✅ Validation ID
            const orderId = validateProductId(order_id);
            if (!orderId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID de commande invalide' 
                });
            }

            let orderResult;
            
            if (process.env.STRIPE_SECRET_KEY && payment_intent_id) {
                const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
                
                if (paymentIntent.status === 'succeeded') {
                    orderResult = await pool.query(
                        `UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = $1 RETURNING *`,
                        [orderId]
                    );
                    
                    await pool.query(
                        `UPDATE order_items SET payment_status = 'paid' WHERE order_id = $1`,
                        [orderId]
                    );
                    
                    logger.info(`💰 Paiement confirmé: Commande ${orderId} | PI: ${payment_intent_id}`);
                    
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `Statut paiement: ${paymentIntent.status}`
                    });
                }
            } else {
                orderResult = await pool.query(
                    `UPDATE orders SET status = 'paid' WHERE id = $1 RETURNING *`,
                    [orderId]
                );
            }

            res.json({
                success: true,
                message: 'Paiement confirmé',
                data: { order: orderResult.rows[0] }
            });
            
        } catch (error) {
            logger.error('❌ Erreur confirmation paiement:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // ==========================================
    // Mettre à jour le statut (avec Email expédition)
    // ==========================================
    updateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, tracking_number } = req.body;

            // ✅ Validation ID
            const orderId = validateProductId(id);
            if (!orderId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID de commande invalide' 
                });
            }

            const validStatuses = [
                'pending', 'pending_payment', 'paid', 'processing', 
                'shipped', 'delivered', 'cancelled', 'refunded'
            ];
            
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Statut invalide' });
            }

            let updateQuery = `UPDATE orders SET status = $1, updated_at = NOW()`;
            let params = [status, orderId];
            
            if (status === 'shipped' && tracking_number) {
                updateQuery += `, tracking_number = $3, shipped_at = NOW()`;
                params.push(tracking_number);
            }
            
            updateQuery += ` WHERE id = $2 RETURNING *`;
            
            const result = await pool.query(updateQuery, params);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            const order = result.rows[0];

            // 🎯 Email d'expédition si statut = shipped
            if (status === 'shipped') {
                try {
                    const userResult = await pool.query(
                        'SELECT email, first_name, last_name FROM users WHERE id = $1',
                        [order.user_id]
                    );
                    
                    if (userResult.rows.length > 0) {
                        const user = userResult.rows[0];
                        
                        const trackingInfo = {
                            carrier: 'Transporteur',
                            number: tracking_number || 'N/A',
                            url: `https://tracking.example.com/${tracking_number || ''}`,
                            estimatedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')
                        };

                        const orderData = {
                            orderNumber: order.order_number,
                            customerName: `${user.first_name} ${user.last_name}`
                        };

                        EmailService.sendShippingConfirmation(user.email, orderData, trackingInfo)
                            .then(result => {
                                if (result.success) {
                                    logger.info(`✅ Email expédition envoyé à ${user.email} pour commande ${order.order_number}`);
                                } else {
                                    logger.error(`⚠️ Échec email expédition: ${result.error}`);
                                }
                            })
                            .catch(err => logger.error(`Exception email expédition: ${err.message}`));
                    }
                } catch (emailErr) {
                    logger.error('⚠️ Erreur préparation email expédition:', emailErr);
                }
            }
            
            logger.info(`✅ Statut commande mis à jour: ${orderId} → ${status}`);

            res.json({ 
                success: true, 
                message: 'Statut mis à jour', 
                data: { order } 
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