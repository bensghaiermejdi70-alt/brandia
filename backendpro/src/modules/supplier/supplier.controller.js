// ============================================
// SUPPLIER CONTROLLER - v5.3 CORRIGÉ ET COMPLET
// ============================================

const db = require("../../config/db");

// ============================================
// CONFIGURATION CLOUDINARY (optionnel)
// ============================================

let cloudinary, CloudinaryStorage, multer;
let uploadImageMiddleware, uploadVideoMiddleware;

try {
    cloudinary = require('cloudinary').v2;
    CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
    multer = require('multer');

    if (process.env.CLOUDINARY_CLOUD_NAME) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        const imageStorage = new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: 'brandia/products',
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
                transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
            }
        });

        const videoStorage = new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: 'brandia/campaigns',
                resource_type: 'video',
                allowed_formats: ['mp4', 'mov', 'webm'],
                transformation: [{ width: 720, crop: 'limit', quality: 'auto' }]
            }
        });

        uploadImageMiddleware = multer({ 
            storage: imageStorage, 
            limits: { fileSize: 5 * 1024 * 1024 }
        }).single('media');

        uploadVideoMiddleware = multer({ 
            storage: videoStorage, 
            limits: { fileSize: 50 * 1024 * 1024 }
        }).single('media');

        console.log('[Supplier Controller] ✅ Cloudinary configured');
    } else {
        throw new Error('Cloudinary not configured');
    }
} catch (err) {
    console.warn('[Supplier Controller] ⚠️ Cloudinary not available:', err.message);
    
    // Fallback : multer avec stockage local
    try {
        multer = require('multer');
        const upload = multer({ dest: 'uploads/' });
        uploadImageMiddleware = upload.single('media');
        uploadVideoMiddleware = upload.single('media');
        console.log('[Supplier Controller] ✅ Using local storage');
    } catch (multerErr) {
        console.error('[Supplier Controller] ❌ Multer not available');
        // Middlewares factices qui passent au suivant
        uploadImageMiddleware = (req, res, next) => next();
        uploadVideoMiddleware = (req, res, next) => next();
    }
}

// ============================================
// CLASSE CONTROLLER
// ============================================

class SupplierController {

    /* ================= PAIEMENTS ================= */

    async getPayments(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const balanceResult = await db.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) as available_balance,
                    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_balance,
                    COALESCE(SUM(amount), 0) as total_earnings
                FROM supplier_payments
                WHERE supplier_id = $1
            `, [supplierId]);

            const balance = balanceResult.rows[0] || {
                available_balance: 0,
                pending_balance: 0,
                total_earnings: 0
            };

            const transactionsResult = await db.query(`
                SELECT 
                    sp.id,
                    sp.order_id,
                    sp.amount,
                    sp.commission_amount,
                    sp.supplier_amount,
                    sp.status,
                    sp.payout_id,
                    sp.stripe_transfer_id,
                    sp.created_at,
                    sp.updated_at
                FROM supplier_payments sp
                WHERE sp.supplier_id = $1
                ORDER BY sp.created_at DESC
                LIMIT 100
            `, [supplierId]);

            const transactions = transactionsResult.rows.map(t => ({
                id: t.id,
                order_id: t.order_id,
                order_number: 'ORD-' + t.order_id,
                description: 'Vente commande #' + t.order_id,
                amount: parseFloat(t.amount) || 0,
                commission: parseFloat(t.commission_amount) || 0,
                net: parseFloat(t.supplier_amount) || 0,
                status: t.status,
                payout_id: t.payout_id,
                stripe_transfer_id: t.stripe_transfer_id,
                created_at: t.created_at,
                available_at: t.status === 'available' ? t.updated_at : null,
                paid_at: t.status === 'paid' ? t.updated_at : null
            }));

            res.json({
                success: true,
                data: {
                    balance: {
                        available: parseFloat(balance.available_balance) || 0,
                        pending: parseFloat(balance.pending_balance) || 0,
                        total: parseFloat(balance.total_earnings) || 0
                    },
                    transactions: transactions
                }
            });

        } catch (error) {
            console.error('[Get Payments] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async requestPayout(req, res) {
        try {
            const userId = req.user.id;
            const { amount } = req.body;

            if (!amount || isNaN(amount) || amount <= 0) {
                return res.status(400).json({ success: false, message: 'Montant invalide' });
            }

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const balanceResult = await db.query(`
                SELECT COALESCE(SUM(amount), 0) as available
                FROM supplier_payments
                WHERE supplier_id = $1 AND status = 'available'
            `, [supplierId]);

            const available = parseFloat(balanceResult.rows[0].available) || 0;

            if (parseFloat(amount) > available) {
                return res.status(400).json({
                    success: false,
                    message: `Solde insuffisant. Disponible: ${available.toFixed(2)}€`
                });
            }

            const payoutResult = await db.query(`
                INSERT INTO payouts (supplier_id, amount, status, created_at)
                VALUES ($1, $2, 'pending', NOW())
                RETURNING id, supplier_id, amount, status, created_at
            `, [supplierId, amount]);

            const payout = payoutResult.rows[0];

            await db.query(`
                UPDATE supplier_payments
                SET status = 'payout_requested', payout_id = $1, updated_at = NOW()
                WHERE supplier_id = $2 AND status = 'available'
            `, [payout.id, supplierId]);

            res.json({
                success: true,
                message: 'Demande de virement créée avec succès',
                data: {
                    payout_id: payout.id,
                    amount: parseFloat(amount),
                    status: 'pending',
                    estimated_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                }
            });

        } catch (error) {
            console.error('[Request Payout] Error:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
        }
    }

    async getPayouts(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(`
                SELECT 
                    p.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', sp.id,
                                'order_id', sp.order_id,
                                'amount', sp.amount,
                                'commission', sp.commission_amount,
                                'net', sp.supplier_amount
                            ) ORDER BY sp.id
                        ) FILTER (WHERE sp.id IS NOT NULL),
                        '[]'
                    ) as payments
                FROM payouts p
                LEFT JOIN supplier_payments sp ON sp.payout_id = p.id
                WHERE p.supplier_id = $1
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `, [supplierId]);

            const payouts = result.rows.map(p => ({
                id: p.id,
                amount: parseFloat(p.amount),
                status: p.status,
                stripe_payout_id: p.stripe_payout_id,
                processed_at: p.processed_at,
                created_at: p.created_at,
                payments: p.payments || []
            }));

            res.json({ success: true, data: payouts });

        } catch (error) {
            console.error('[Get Payouts] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= UPLOADS ================= */

    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
            }
            
            const result = {
                success: true,
                data: {
                    url: req.file.path || `/uploads/${req.file.filename}`,
                    public_id: req.file.filename,
                    format: req.file.format || req.file.mimetype,
                    size: req.file.size
                }
            };
            
            res.json(result);
            
        } catch (error) {
            console.error('[Upload Image] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadCampaignVideo(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
            }
            
            const result = {
                success: true,
                data: {
                    url: req.file.path || `/uploads/${req.file.filename}`,
                    public_id: req.file.filename,
                    format: req.file.format || req.file.mimetype,
                    size: req.file.size
                }
            };
            
            res.json(result);
            
        } catch (error) {
            console.error('[Upload Video] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= PRODUITS ================= */

    async getProducts(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(`
                SELECT id, name, price, stock_quantity, main_image_url, is_active, category_id, slug, description
                FROM products 
                WHERE supplier_id = $1 
                ORDER BY created_at DESC
            `, [supplierId]);
            
            res.json({ 
                success: true, 
                data: result.rows 
            });
            
        } catch (error) {
            console.error('[Get Products] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createProduct(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            const { name, price, stock_quantity, description, category_id, main_image_url } = req.body;

            const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const timestamp = Date.now();
            const slug = `${baseSlug}-${timestamp}`;

            const result = await db.query(
                `INSERT INTO products (supplier_id, name, price, stock_quantity, description, category_id, main_image_url, is_active, slug, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW(), NOW()) RETURNING *`,
                [supplierId, name, price, stock_quantity, description, category_id, main_image_url, slug]
            );

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Create Product] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateProduct(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            
            const allowedFields = {
                name: req.body.name,
                price: req.body.price,
                stock_quantity: req.body.stock_quantity,
                description: req.body.description,
                category_id: req.body.category_id,
                is_active: req.body.is_active,
                main_image_url: req.body.main_image_url
            };

            const updates = {};
            for (const [key, value] of Object.entries(allowedFields)) {
                if (value !== undefined && value !== null) {
                    updates[key] = value;
                }
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ success: false, message: 'Aucun champ valide à mettre à jour' });
            }

            const fields = Object.keys(updates);
            const values = Object.values(updates);
            
            const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
            
            const sql = `
                UPDATE products SET ${setClause}, updated_at = NOW()
                WHERE id = $${fields.length + 1} AND supplier_id = $${fields.length + 2}
                RETURNING *
            `;
            
            values.push(id, supplierId);

            const result = await db.query(sql, values);

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
            }

            res.json({ success: true, data: result.rows[0] });
            
        } catch (error) {
            console.error('[UpdateProduct] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteProduct(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(
                'DELETE FROM products WHERE id = $1 AND supplier_id = $2 RETURNING id, name',
                [id, supplierId]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
            }

            res.json({ success: true, message: 'Produit supprimé', data: result.rows[0] });
            
        } catch (error) {
            console.error('[Delete Product] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= COMMANDES ================= */

    async getOrders(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            const { status } = req.query;

            let orderIdsSql = `
                SELECT DISTINCT o.id
                FROM orders o
                INNER JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1
            `;
            
            const params = [supplierId];

            if (status && status !== 'all') {
                if (status === 'pending') {
                    orderIdsSql += ` AND (o.status = 'pending' OR o.status IS NULL OR o.status = 'paid')`;
                } else if (status === 'shipped') {
                    orderIdsSql += ` AND o.status = 'shipped'`;
                } else if (status === 'delivered') {
                    orderIdsSql += ` AND o.status = 'delivered'`;
                } else if (status === 'cancelled') {
                    orderIdsSql += ` AND o.status = 'cancelled'`;
                }
            }

            orderIdsSql += ` ORDER BY o.id DESC`;

            const orderIdsResult = await db.query(orderIdsSql, params);
            const orderIds = orderIdsResult.rows.map(r => r.id);

            if (orderIds.length === 0) {
                return res.json({ 
                    success: true, 
                    data: { orders: [], counts: { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 } } 
                });
            }

            const ordersSql = `
                SELECT o.*, 
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', oi2.id,
                                    'product_id', oi2.product_id,
                                    'product_name', oi2.product_name,
                                    'product_sku', oi2.product_sku,
                                    'product_image_url', oi2.product_image_url,
                                    'quantity', oi2.quantity,
                                    'unit_price', oi2.unit_price,
                                    'total_price', oi2.total_price,
                                    'supplier_amount', oi2.supplier_amount,
                                    'commission_amount', oi2.commission_amount,
                                    'vat_rate', oi2.vat_rate,
                                    'fulfillment_status', oi2.fulfillment_status
                                ) ORDER BY oi2.id
                            )
                            FROM order_items oi2
                            WHERE oi2.order_id = o.id AND oi2.supplier_id = $1
                        ),
                        '[]'::jsonb
                    )::json as items
                FROM orders o
                WHERE o.id = ANY($2)
                ORDER BY o.created_at DESC
            `;

            const ordersResult = await db.query(ordersSql, [supplierId, orderIds]);

            const countsResult = await db.query(`
                SELECT 
                    COUNT(DISTINCT o.id) as all_count,
                    COUNT(DISTINCT CASE WHEN (o.status = 'pending' OR o.status IS NULL OR o.status = 'paid') THEN o.id END) as pending_count,
                    COUNT(DISTINCT CASE WHEN o.status = 'shipped' THEN o.id END) as shipped_count,
                    COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_count,
                    COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_count
                FROM orders o
                INNER JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.supplier_id = $1
            `, [supplierId]);

            const counts = countsResult.rows[0];

            res.json({ 
                success: true, 
                data: { 
                    orders: ordersResult.rows,
                    counts: {
                        all: parseInt(counts.all_count) || 0,
                        pending: parseInt(counts.pending_count) || 0,
                        shipped: parseInt(counts.shipped_count) || 0,
                        delivered: parseInt(counts.delivered_count) || 0,
                        cancelled: parseInt(counts.cancelled_count) || 0
                    }
                } 
            });
            
        } catch (error) {
            console.error('[Get Orders] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getOrderById(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(`
                SELECT o.*, 
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', oi2.id,
                                    'product_id', oi2.product_id,
                                    'product_name', oi2.product_name,
                                    'product_sku', oi2.product_sku,
                                    'product_image_url', oi2.product_image_url,
                                    'quantity', oi2.quantity,
                                    'unit_price', oi2.unit_price,
                                    'total_price', oi2.total_price,
                                    'supplier_amount', oi2.supplier_amount,
                                    'commission_amount', oi2.commission_amount,
                                    'vat_rate', oi2.vat_rate
                                ) ORDER BY oi2.id
                            )
                            FROM order_items oi2
                            WHERE oi2.order_id = o.id AND oi2.supplier_id = $2
                        ),
                        '[]'::jsonb
                    )::json as items
                FROM orders o
                WHERE o.id = $1
            `, [id, supplierId]);

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée ou non autorisée' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Get Order By Id] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateOrderStatus(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { status } = req.body;

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const checkResult = await db.query(`
                SELECT 1 FROM order_items WHERE order_id = $1 AND supplier_id = $2 LIMIT 1
            `, [id, supplierId]);

            if (checkResult.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Commande non autorisée' });
            }

            const result = await db.query(
                `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
                [status, id]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Update Order Status] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= PROMOTIONS ================= */

    async getPromotions(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(
                'SELECT * FROM promotions WHERE supplier_id = $1 ORDER BY created_at DESC',
                [supplierId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('[Get Promotions] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createPromotion(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            const { name, type, value, code, max_usage, start_date, end_date, applies_to } = req.body;

            const result = await db.query(
                `INSERT INTO promotions (supplier_id, name, type, value, code, max_usage, usage_count, status, start_date, end_date, applies_to)
                 VALUES ($1,$2,$3,$4,$5,$6,0,'active',$7,$8,$9) RETURNING *`,
                [supplierId, name, type, value, code, max_usage, start_date, end_date, applies_to || 'all']
            );

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Create Promotion] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updatePromotion(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            const { id } = req.params;
            const { name, type, value, code, max_usage, start_date, end_date, applies_to } = req.body;

            const result = await db.query(
                `UPDATE promotions SET name=$1, type=$2, value=$3, code=$4, max_usage=$5,
                 start_date=$6, end_date=$7, applies_to=$8, updated_at=NOW()
                 WHERE id=$9 AND supplier_id=$10 RETURNING *`,
                [name, type, value, code, max_usage, start_date, end_date, applies_to, id, supplierId]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Promotion non trouvée' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Update Promotion] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deletePromotion(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            const { id } = req.params;

            await db.query('DELETE FROM promotions WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
            res.json({ success: true, message: 'Promotion supprimée' });
        } catch (error) {
            console.error('[Delete Promotion] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= CAMPAGNES ================= */

    async getCampaigns(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(
                `SELECT 
                    sc.*,
                    COALESCE(cs.total_views, 0) as views_count,
                    COALESCE(cs.total_clicks, 0) as clicks_count
                FROM supplier_campaigns sc
                LEFT JOIN (
                    SELECT 
                        campaign_id,
                        SUM(impressions) as total_views,
                        SUM(clicks) as total_clicks
                    FROM campaign_stats
                    GROUP BY campaign_id
                ) cs ON cs.campaign_id = sc.id
                WHERE sc.supplier_id = $1 
                ORDER BY sc.created_at DESC`,
                [supplierId]
            );
            
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('[Get Campaigns] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createCampaign(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;
            
            const {
                name, media_url, media_type, headline,
                description, cta_text, cta_link,
                start_date, end_date, target_products
            } = req.body;

            if (!name || !headline || !target_products || target_products.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom, titre et produits cibles sont obligatoires'
                });
            }

            const result = await db.query(
                `INSERT INTO supplier_campaigns
                (supplier_id, name, media_url, media_type, headline, description,
                    cta_text, cta_link, start_date, end_date, target_products, status, views_count, clicks_count)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',0,0)
                RETURNING *`,
                [
                    supplierId, name, media_url, media_type || 'image', headline,
                    description, cta_text, cta_link,
                    start_date, end_date, target_products
                ]
            );

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Create Campaign] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateCampaign(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updates = req.body;

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const allowedFields = [
                'name', 'headline', 'description', 'cta_text', 'cta_link',
                'media_url', 'media_type', 'start_date', 'end_date', 
                'target_products', 'status', 'budget', 'daily_budget'
            ];

            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    setClauses.push(`${field} = $${paramIndex}`);
                    values.push(updates[field]);
                    paramIndex++;
                }
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ success: false, message: 'Aucun champ valide à mettre à jour' });
            }

            setClauses.push(`updated_at = NOW()`);
            values.push(id, supplierId);

            const sql = `
                UPDATE supplier_campaigns
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND supplier_id = $${paramIndex + 1}
                RETURNING *
            `;

            const result = await db.query(sql, values);

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Campagne non trouvée ou non autorisée' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Update Campaign] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteCampaign(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const checkResult = await db.query(
                'SELECT id FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2',
                [id, supplierId]
            );

            if (checkResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Campagne non trouvée ou non autorisée' });
            }

            await db.query('DELETE FROM campaign_stats WHERE campaign_id = $1', [id]);
            await db.query('DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2', [id, supplierId]);

            res.json({ success: true, message: 'Campagne supprimée définitivement' });
        } catch (error) {
            console.error('[Delete Campaign] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async toggleCampaignStatus(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { status } = req.body;

            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            if (status === 'active') {
                await db.query(
                    `UPDATE supplier_campaigns SET status = 'paused', updated_at = NOW()
                    WHERE supplier_id = $1 AND status = 'active' AND id != $2`,
                    [supplierId, id]
                );
            }

            const result = await db.query(
                `UPDATE supplier_campaigns SET status = $1, updated_at = NOW()
                WHERE id = $2 AND supplier_id = $3 RETURNING *`,
                [status, id, supplierId]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[Toggle Campaign Status] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= PUBLIC CAMPAGNES (pour le frontend) ================= */

    async getActiveCampaignForProduct(req, res) {
        try {
            const { supplier, product } = req.query;

            if (!supplier || !product) {
                return res.status(400).json({ success: false, message: 'supplier et product sont requis' });
            }

            const result = await db.query(
                `SELECT * FROM supplier_campaigns
                WHERE supplier_id = $1
                    AND $2 = ANY(target_products)
                    AND status = 'active'
                    AND start_date <= NOW()
                    AND end_date >= NOW()
                ORDER BY created_at DESC LIMIT 1`,
                [supplier, product]
            );

            res.json({ success: true, data: result.rows[0] || null });
        } catch (error) {
            console.error('[Get Active Campaign] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async trackCampaignClick(req, res) {
        try {
            const { campaign_id } = req.body;

            if (!campaign_id) {
                return res.status(400).json({ success: false, message: 'campaign_id est requis' });
            }

            await db.query(
                'UPDATE supplier_campaigns SET clicks_count = clicks_count + 1 WHERE id = $1',
                [campaign_id]
            );

            await db.query(`
                INSERT INTO campaign_stats (campaign_id, date, clicks)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (campaign_id, date)
                DO UPDATE SET clicks = campaign_stats.clicks + 1
            `, [campaign_id]);

            res.json({ success: true });
        } catch (error) {
            console.error('[Track Campaign Click] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async trackCampaignView(req, res) {
        try {
            const { campaign_id } = req.body;

            if (!campaign_id) {
                return res.status(400).json({ success: false, message: 'campaign_id est requis' });
            }

            await db.query(
                'UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1',
                [campaign_id]
            );

            await db.query(`
                INSERT INTO campaign_stats (campaign_id, date, impressions)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (campaign_id, date)
                DO UPDATE SET impressions = campaign_stats.impressions + 1
            `, [campaign_id]);

            res.json({ success: true });
        } catch (error) {
            console.error('[Track Campaign View] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= STATS ================= */

    async getStats(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const [sales, orders, products, campaigns, balance] = await Promise.all([
                db.query(`
                    SELECT COALESCE(SUM(oi.total_price), 0) as total 
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.supplier_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
                `, [supplierId]),
                db.query('SELECT COUNT(DISTINCT order_id) FROM order_items WHERE supplier_id = $1', [supplierId]),
                db.query('SELECT COUNT(*) FROM products WHERE supplier_id = $1 AND is_active = true', [supplierId]),
                db.query('SELECT COUNT(*) FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2', [supplierId, 'active']),
                db.query(`
                    SELECT COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) as available
                    FROM supplier_payments WHERE supplier_id = $1
                `, [supplierId])
            ]);

            res.json({
                success: true,
                data: {
                    totalSales: Number(sales.rows[0].total),
                    totalOrders: Number(orders.rows[0].count),
                    activeProducts: Number(products.rows[0].count),
                    activeCampaigns: Number(campaigns.rows[0].count),
                    balance: Number(balance.rows[0].available)
                }
            });
        } catch (error) {
            console.error('[Get Stats] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /* ================= PARAMÈTRES PUBLICITÉ ================= */

    async getAdSettings(req, res) {
        try {
            const userId = req.user.id;
            
            const supplierResult = await db.query(
                'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
            }
            
            const supplierId = supplierResult.rows[0].id;

            const result = await db.query(`
                SELECT max_ads_per_session, daily_budget, priority, is_active, notes
                FROM supplier_ad_settings
                WHERE supplier_id = $1
            `, [supplierId]);

            if (result.rows.length === 0) {
                await db.query(`
                    INSERT INTO supplier_ad_settings (supplier_id, max_ads_per_session, notes)
                    VALUES ($1, 1, 'Configuration par défaut')
                `, [supplierId]);
                
                return res.json({
                    success: true,
                    data: {
                        max_ads_per_session: 1,
                        daily_budget: null,
                        priority: 5,
                        is_active: true,
                        ads_shown_this_session: 0
                    }
                });
            }

            const settings = result.rows[0];
            
            res.json({
                success: true,
                data: {
                    max_ads_per_session: parseInt(settings.max_ads_per_session),
                    daily_budget: settings.daily_budget !== null ? parseFloat(settings.daily_budget) : null,
                    priority: parseInt(settings.priority),
                    is_active: settings.is_active,
                    notes: settings.notes
                }
            });

        } catch (error) {
            console.error('[Get Ad Settings] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

// ============================================
// EXPORT
// ============================================

const controller = new SupplierController();

// Export des middlewares multer
module.exports.uploadImageMiddleware = uploadImageMiddleware;
module.exports.uploadVideoMiddleware = uploadVideoMiddleware;

// Export des méthodes du contrôleur
module.exports.getPayments = controller.getPayments.bind(controller);
module.exports.requestPayout = controller.requestPayout.bind(controller);
module.exports.getPayouts = controller.getPayouts.bind(controller);
module.exports.uploadImage = controller.uploadImage.bind(controller);
module.exports.uploadCampaignVideo = controller.uploadCampaignVideo.bind(controller);
module.exports.getProducts = controller.getProducts.bind(controller);
module.exports.createProduct = controller.createProduct.bind(controller);
module.exports.updateProduct = controller.updateProduct.bind(controller);
module.exports.deleteProduct = controller.deleteProduct.bind(controller);
module.exports.getOrders = controller.getOrders.bind(controller);
module.exports.getOrderById = controller.getOrderById.bind(controller);
module.exports.updateOrderStatus = controller.updateOrderStatus.bind(controller);
module.exports.getPromotions = controller.getPromotions.bind(controller);
module.exports.createPromotion = controller.createPromotion.bind(controller);
module.exports.updatePromotion = controller.updatePromotion.bind(controller);
module.exports.deletePromotion = controller.deletePromotion.bind(controller);
module.exports.getCampaigns = controller.getCampaigns.bind(controller);
module.exports.createCampaign = controller.createCampaign.bind(controller);
module.exports.updateCampaign = controller.updateCampaign.bind(controller);
module.exports.deleteCampaign = controller.deleteCampaign.bind(controller);
module.exports.toggleCampaignStatus = controller.toggleCampaignStatus.bind(controller);
module.exports.getActiveCampaignForProduct = controller.getActiveCampaignForProduct.bind(controller);
module.exports.trackCampaignClick = controller.trackCampaignClick.bind(controller);
module.exports.trackCampaignView = controller.trackCampaignView.bind(controller);
module.exports.getStats = controller.getStats.bind(controller);
module.exports.getAdSettings = controller.getAdSettings.bind(controller);