
// ============================================
// ROUTES PRINCIPALES - API Brandia v3.0
// CORRECTION: Supplier routes retirées (déjà dans app.js)
// ============================================

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth.middleware');

// Import des contrôleurs et routes
const authController = require('../modules/auth/auth.controller');
const productRoutes = require('../modules/products/product.routes');
const paymentRoutes = require('../modules/payments/payment.routes');
const orderRoutes = require('../modules/orders/order.routes');
const countryRoutes = require('../modules/countries/country.routes');

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

// ============================================
// ROUTE CATEGORIES
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
// AUTH ROUTES
// ============================================
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);
router.get('/auth/me', authenticate, authController.me);
router.post('/auth/logout', authenticate, authController.logout);

// ============================================
// ROUTES API (sauf supplier déjà monté dans app.js)
// ============================================
router.use('/products', productRoutes);
router.use('/payments', paymentRoutes);
router.use('/orders', orderRoutes);
router.use('/countries', countryRoutes);

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
            health: '/api/health'
        }
    });
});

// ============================================
// GESTION ERREURS 404
// ============================================
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint non trouvé',
        path: req.path
    });
});

module.exports = router;


