// ============================================
// ROUTES PRINCIPALES - API Brandia v3.1 CORRIGÉ
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
// HEALTH CHECK (déjà dans app.js mais on garde pour compatibilité)
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
// 🔥 SUPPRIMÉ: La route /public/campaigns est maintenant dans supplier.routes.js
// pour éviter les conflits et avoir toute la logique métier au même endroit
// ============================================

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
// ROUTE PROMOTIONS PUBLIQUES (pour offre.html)
// ============================================
router.get('/public/promotions/active', async (req, res) => {
    try {
        const db = require('../config/db');
        
        const result = await db.query(`
            SELECT 
                p.*,
                s.company_name as brand_name,
                s.logo_url as brand_logo
            FROM promotions p
            JOIN suppliers s ON p.supplier_id = s.user_id
            WHERE p.status = 'active'
                AND p.start_date <= NOW()
                AND p.end_date >= NOW()
            ORDER BY p.created_at DESC
            LIMIT 20
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
        
    } catch (error) {
        console.error('[Public Promotions] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des promotions'
        });
    }
});

// ============================================
// DOCUMENTATION API
// ============================================
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Brandia API',
        version: '1.0.0',
        endpoints: {
            public: '/api/supplier/public/campaigns?supplier=X&product=Y',
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