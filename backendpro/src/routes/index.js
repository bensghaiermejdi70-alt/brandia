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

/// ============================================
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

        const { query } = require('../config/db');
        
        const result = await query(`
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
// CORRECTION IMAGE DIFFUSEUR (TEMPORAIRE)
// ============================================

router.get('/fix-diffuseur', async (req, res) => {
    try {
        const { query } = require('../config/db');
        await query(`
            UPDATE products 
            SET main_image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800' 
            WHERE id = 11
        `);
        res.send('✅ Image du diffuseur corrigée ! Rafraîchissez la page produit.');
    } catch (err) {
        res.status(500).send('Erreur: ' + err.message);
    }
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
// ROUTES API (protégées ou spécifiques)
// ============================================

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/payments', paymentRoutes);
router.use('/orders', orderRoutes);
router.use('/countries', countryRoutes);
router.use('/supplier', supplierRoutes);

// ============================================
// DOCUMENTATION API (Route racine)
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
            public: {
                method: 'GET',
                path: '/api/public/campaigns?supplier=X&product=Y',
                description: 'Campagnes publicitaires (public)'
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
                description: 'Espace fournisseur - REQUIÈRE AUTH JWT',
                routes: [
                    { method: 'GET', path: '/stats', auth: true, description: 'Statistiques dashboard' },
                    { method: 'GET', path: '/products', auth: true, description: 'Mes produits' },
                    { method: 'GET', path: '/orders', auth: true, description: 'Mes commandes' },
                    { method: 'GET', path: '/payments', auth: true, description: 'Paiements et soldes' },
                    { method: 'GET', path: '/campaigns', auth: true, description: 'Mes campagnes pub' },
                    { method: 'POST', path: '/campaigns', auth: true, description: 'Créer campagne' }
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
// GESTION ERREURS 404 - DOIT ÊTRE DERNIER
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