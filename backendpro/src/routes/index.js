// ============================================
// ROUTES PRINCIPALES - API Brandia
// ============================================

const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('../modules/auth/auth.routes');
const productRoutes = require('../modules/products/product.routes');
const paymentRoutes = require('../modules/payments/payment.routes');
const orderRoutes = require('../modules/orders/order.routes');
const countryRoutes = require('../modules/countries/country.routes');
const supplierRoutes = require('../modules/supplier/supplier.routes');

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'brandia-api',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// ============================================
// ROUTES PUBLIQUES - CAMPAGNES PUBLICITAIRES
// ============================================
router.get('/public/campaigns', async (req, res) => {
    try {
        const { supplier, product } = req.query;
        
        console.log(`[Public Campaigns] Request: supplier=${supplier}, product=${product}`);

        if (!supplier || !product) {
            return res.status(400).json({
                success: false,
                message: 'Les paramètres supplier et product sont requis'
            });
        }

        const db = require('../config/db');
        
        const result = await db.query(`
            SELECT 
                c.id,
                c.name,
                c.media_url,
                c.media_type,
                c.headline,
                c.description,
                c.cta_text,
                c.cta_link,
                c.start_date,
                c.end_date
            FROM supplier_campaigns c
            WHERE c.supplier_id = $1
                AND $2 = ANY(c.target_products)
                AND c.status = 'active'
                AND c.start_date <= NOW()
                AND c.end_date >= NOW()
            ORDER BY c.created_at DESC
            LIMIT 1
        `, [supplier, product]);

        console.log(`[Public Campaigns] Found: ${result.rows.length} campaign(s)`);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'Aucune campagne active trouvée'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[Public Campaigns] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération de la campagne'
        });
    }
});

/// ============================================
// ROUTE CATEGORIES (MANQUANTE)
// ============================================
router.get('/categories', async (req, res) => {
    try {
        const db = require('../config/db');
        const result = await db.query(`
            SELECT id, name, slug, icon, gradient, parent_id, sort_order, is_active
            FROM categories
            WHERE is_active = true OR is_active IS NULL
            ORDER BY sort_order ASC, name ASC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('[Categories] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des catégories'
        });
    }
});

// ============================================
// DEBUG ROUTES (TEMPORAIRES)
// ============================================
router.get('/fix-diffuseur', async (req, res) => {
    try {
        const db = require('../config/db');
        await db.query(`
            UPDATE products 
            SET main_image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800' 
            WHERE id = 11
        `);
        res.send('✅ Image du diffuseur corrigée !');
    } catch (err) {
        res.status(500).send('Erreur: ' + err.message);
    }
});

router.get('/test-db', async (req, res) => {
    try {
        const db = require('../config/db');
        const result = await db.query('SELECT COUNT(*) as count FROM products');
        res.json({ 
            success: true, 
            count: result.rows[0].count,
            message: 'DB OK' 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});
// ============================================
// ROUTES PUBLIQUES - PROMOTIONS
// ============================================

/**
 * GET /api/public/promotions/active
 * Renvoie toutes les promotions actives du site (pour page /offres)
 */
router.get('/public/promotions/active', async (req, res) => {
    try {
        const db = require('../config/db');
        
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.type,
                p.value,
                p.code,
                p.applies_to,
                p.start_date,
                p.end_date,
                u.first_name as supplier_name,
                s.company_name as supplier_company,
                s.logo_url as supplier_logo,
                COUNT(pp.product_id) as products_count
            FROM promotions p
            JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            LEFT JOIN promotion_products pp ON p.id = pp.promotion_id
            WHERE p.status = 'active'
                AND p.start_date <= CURRENT_DATE 
                AND p.end_date >= CURRENT_DATE
                AND (p.max_usage IS NULL OR p.usage_count < p.max_usage)
            GROUP BY p.id, u.first_name, s.company_name, s.logo_url
            ORDER BY p.created_at DESC
        `);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('[Public Promotions] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

/**
 * POST /api/public/promotions/validate
 * Valide un code promo (appelé depuis le panier)
 */
router.post('/public/promotions/validate', async (req, res) => {
    try {
        const { code, productIds, totalAmount } = req.body;
        const db = require('../config/db');

        if (!code) {
            return res.status(400).json({ success: false, message: 'Code requis' });
        }

        const result = await db.query(`
            SELECT *
            FROM promotions
            WHERE code = $1 
            AND status = 'active'
            AND start_date <= CURRENT_DATE 
            AND end_date >= CURRENT_DATE
            AND (max_usage IS NULL OR usage_count < max_usage)
            LIMIT 1
        `, [code.toUpperCase()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Code promo invalide ou expiré' 
            });
        }

        const promo = result.rows[0];
        
        // Vérifier applicabilité
        let applicable = false;
        if (promo.applies_to === 'all') {
            applicable = true;
        } else if (promo.applies_to === 'products' && productIds) {
            const check = await db.query(`
                SELECT 1 FROM promotion_products 
                WHERE promotion_id = $1 AND product_id = ANY($2)
                LIMIT 1
            `, [promo.id, productIds]);
            applicable = check.rows.length > 0;
        }

        if (!applicable) {
            return res.status(400).json({ 
                success: false, 
                message: 'Code non applicable à ces produits' 
            });
        }

        // Calcul réduction
        let discount = 0;
        if (promo.type === 'percentage') {
            discount = totalAmount * (promo.value / 100);
        } else {
            discount = Math.min(promo.value, totalAmount);
        }

        res.json({
            success: true,
            data: {
                promo_id: promo.id,
                name: promo.name,
                type: promo.type,
                value: promo.value,
                discount: parseFloat(discount.toFixed(2)),
                final_total: parseFloat((totalAmount - discount).toFixed(2))
            }
        });

    } catch (error) {
        console.error('[Validate Promo] Error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});
// ============================================
// ROUTES API (protégées ou spécifiques)
// ============================================
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/payments', paymentRoutes);
router.use('/orders', orderRoutes);
router.use('/countries', countryRoutes);
router.use('/supplier', supplierRoutes);

// ============================================
// DOCUMENTATION API
// ============================================
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Brandia API',
        version: '1.0.0',
        endpoints: {
            public: '/api/public/campaigns?supplier=X&product=Y',
            categories: '/api/categories',
            health: '/api/health',
            test: '/api/test-db'
        }
    });
});

// ============================================
// GESTION ERREURS 404 - DERNIER
// ============================================
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint non trouvé',
        path: req.path
    });
});

module.exports = router;