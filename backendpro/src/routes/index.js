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
// DEBUG - TEST DB (TEMPORAIRE)
// ============================================

router.get('/test-db', async (req, res) => {
    try {
        const { query } = require('../config/db');
        const result = await query('SELECT COUNT(*) as count FROM products');
        res.json({ 
            success: true, 
            count: result.rows[0].count,
            message: 'DB OK' 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message,
            stack: err.stack 
        });
    }
});

// ============================================
// ROUTES API
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
        documentation: {
            description: 'Marketplace B2B pour marques et fournisseurs',
            base_url: `${req.protocol}://${req.get('host')}/api`
        },
        endpoints: {
            health: {
                method: 'GET',
                path: '/api/health',
                description: 'Vérification état du serveur'
            },
            test: {
                method: 'GET',
                path: '/api/test-db',
                description: 'Test connexion DB (debug)'
            },
            authentication: {
                base: '/api/auth',
                routes: [
                    { method: 'POST', path: '/register', description: 'Inscription client/fournisseur' },
                    { method: 'POST', path: '/login', description: 'Connexion' },
                    { method: 'POST', path: '/refresh', description: 'Rafraîchir token JWT' },
                    { method: 'GET', path: '/me', auth: true, description: 'Profil utilisateur connecté' }
                ]
            },
            products: {
                base: '/api/products',
                routes: [
                    { method: 'GET', path: '/', description: 'Liste des produits' },
                    { method: 'GET', path: '/featured', description: 'Produits en vedette' },
                    { method: 'GET', path: '/:id', description: 'Détail produit' }
                ]
            },
            countries: {
                base: '/api/countries',
                routes: [
                    { method: 'GET', path: '/', description: 'Liste des pays' }
                ]
            },
            supplier: {
                base: '/api/supplier',
                description: 'Espace fournisseur',
                routes: [
                    { method: 'GET', path: '/dashboard', description: 'Statistiques' },
                    { method: 'GET', path: '/products', description: 'Mes produits' }
                ]
            }
        },
        authentication: {
            type: 'JWT Bearer Token',
            header: 'Authorization: Bearer <token>',
            token_url: '/api/auth/login'
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
        path: req.path,
        method: req.method
    });
});

module.exports = router;