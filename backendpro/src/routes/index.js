// ============================================
// ROUTES PRINCIPALES - API Brandia v3.3 CORRIGÉ
// Ajout des routes Supplier manquantes
// ============================================

const express = require('express');
const router = express.Router();

// ============================================
// IMPORTS
// ============================================

const authController = require('../modules/auth/auth.controller');
const orderRoutes = require('../modules/orders/order.routes');
const paymentRoutes = require('../modules/payments/payment.routes');
const countryRoutes = require('../modules/countries/country.routes');

// 🔥 NOUVEAU: Import des routes Supplier
const supplierRoutes = require('../modules/supplier/supplier.routes');

// 🔥 Import du middleware (uniquement pour routes spécifiques)
const { authenticate } = require('../middlewares/auth.middleware');

console.log('[Routes Index] Loading v3.3...');

// ============================================
// ROUTES PUBLIQUES (SANS AUTHENTIFICATION)
// ============================================

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'brandia-api',
        version: '3.3.0'
    });
});

// Auth - Register/Login (publiques)
router.post('/auth/register', async (req, res, next) => {
    try {
        await authController.register(req, res);
    } catch (error) {
        next(error);
    }
});

router.post('/auth/login', async (req, res, next) => {
    try {
        await authController.login(req, res);
    } catch (error) {
        next(error);
    }
});

router.post('/auth/refresh', async (req, res, next) => {
    try {
        await authController.refresh(req, res);
    } catch (error) {
        next(error);
    }
});

// Categories (100% publique)
router.get('/categories', async (req, res, next) => {
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
        next(error);
    }
});

// Promotions publiques (pour offre.html)
router.get('/public/promotions/active', async (req, res, next) => {
    try {
        const db = require('../config/db');
        
        const result = await db.query(`
            SELECT 
                p.*,
                s.company_name as brand_name,
                s.logo_url as brand_logo,
                COUNT(pp.product_id) as products_count
            FROM promotions p
            JOIN suppliers s ON p.supplier_id = s.user_id
            LEFT JOIN promotion_products pp ON pp.promotion_id = p.id
            WHERE p.status = 'active'
                AND p.start_date <= NOW()
                AND p.end_date >= NOW()
            GROUP BY p.id, s.company_name, s.logo_url
            ORDER BY p.created_at DESC
            LIMIT 20
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
        
    } catch (error) {
        console.error('[Public Promotions] Error:', error);
        next(error);
    }
});

// ============================================
// 🔥 ROUTES SUPPLIER (MIXTE: publique + protégée)
// ============================================
// IMPORTANT: supplier.routes.js gère lui-même la séparation
// des routes publiques (avant middleware) et protégées (après)
router.use('/supplier', supplierRoutes);

console.log('[Routes Index] ✅ Supplier routes mounted at /api/supplier');

// ============================================
// ROUTES PROTÉGÉES (AVEC AUTHENTIFICATION)
// ============================================

// Auth - Profil et Logout (protégés)
router.get('/auth/me', authenticate, async (req, res, next) => {
    try {
        await authController.me(req, res);
    } catch (error) {
        next(error);
    }
});

router.post('/auth/logout', authenticate, async (req, res, next) => {
    try {
        await authController.logout(req, res);
    } catch (error) {
        next(error);
    }
});

// Orders (protégé)
router.use('/orders', authenticate, (req, res, next) => {
    next();
}, orderRoutes);

// Payments (protégé)
router.use('/payments', authenticate, (req, res, next) => {
    next();
}, paymentRoutes);

// Countries (publique)
router.use('/countries', countryRoutes);

// ============================================
// DOCUMENTATION API (publique)
// ============================================
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Brandia API',
        version: '3.3.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        endpoints: {
            public: {
                health: 'GET /api/health',
                categories: 'GET /api/categories',
                products: 'GET /api/products',
                promotions: 'GET /api/public/promotions/active',
                supplier_public: {
                    campaigns: 'GET /api/supplier/public/campaigns?supplier=X&product=Y',
                    campaign_view: 'POST /api/supplier/public/campaigns/view',
                    campaign_click: 'POST /api/supplier/public/campaigns/click',
                    ad_settings: 'GET /api/supplier/public/ad-settings?supplier=X'
                }
            },
            authentication: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                refresh: 'POST /api/auth/refresh',
                me: 'GET /api/auth/me (protected)',
                logout: 'POST /api/auth/logout (protected)'
            },
            protected: {
                orders: '/api/orders/*',
                payments: '/api/payments/*',
                supplier_dashboard: '/api/supplier/* (stats, products, orders, campaigns, etc.)'
            }
        }
    });
});

// ============================================
// GESTION ERREURS 404 (DOIT ÊTRE DERNIER)
// ============================================
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint non trouvé',
        path: req.path,
        method: req.method,
        tip: 'Consultez GET /api pour la documentation'
    });
});

console.log('[Routes Index] ✅ Loaded successfully v3.3');

module.exports = router;