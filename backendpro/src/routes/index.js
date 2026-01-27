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
const supplierRoutes = require('../modules/supplier/supplier.routes'); // Chemin corrigé

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
// ROUTES API
// ============================================

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/payments', paymentRoutes);
router.use('/orders', orderRoutes);
router.use('/countries', countryRoutes);
router.use('/supplier', supplierRoutes); // Toutes les routes supplier sous /api/supplier/*

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
            authentication: {
                base: '/api/auth',
                routes: [
                    { method: 'POST', path: '/register', description: 'Inscription client/fournisseur' },
                    { method: 'POST', path: '/login', description: 'Connexion' },
                    { method: 'POST', path: '/refresh', description: 'Rafraîchir token JWT' },
                    { method: 'GET', path: '/me', auth: true, description: 'Profil utilisateur connecté' },
                    { method: 'POST', path: '/forgot-password', description: 'Demande réinitialisation mot de passe' },
                    { method: 'POST', path: '/reset-password', description: 'Réinitialisation mot de passe' }
                ]
            },
            products: {
                base: '/api/products',
                routes: [
                    { method: 'GET', path: '/', description: 'Liste des produits (avec filtres)' },
                    { method: 'GET', path: '/featured', description: 'Produits en vedette' },
                    { method: 'GET', path: '/:id', description: 'Détail produit par ID' },
                    { method: 'GET', path: '/slug/:slug', description: 'Détail produit par slug' }
                ]
            },
            payments: {
                base: '/api/payments',
                routes: [
                    { method: 'POST', path: '/connect/account', auth: true, role: 'supplier', description: 'Créer compte Stripe Connect' },
                    { method: 'POST', path: '/connect/onboarding', auth: true, role: 'supplier', description: 'Lien onboarding Stripe' },
                    { method: 'POST', path: '/create-intent', auth: true, description: 'Créer intention de paiement' },
                    { method: 'GET', path: '/status/:id', auth: true, description: 'Statut paiement' },
                    { method: 'POST', path: '/webhook', description: 'Webhook Stripe (raw body)' }
                ]
            },
            orders: {
                base: '/api/orders',
                routes: [
                    { method: 'GET', path: '/', auth: true, description: 'Mes commandes (client)' },
                    { method: 'POST', path: '/', auth: true, role: 'client', description: 'Créer commande' },
                    { method: 'GET', path: '/:id', auth: true, description: 'Détail commande' }
                ]
            },
            countries: {
                base: '/api/countries',
                routes: [
                    { method: 'GET', path: '/', description: 'Liste des pays' },
                    { method: 'GET', path: '/categories', description: 'Liste des catégories' }
                ]
            },
            supplier: {
                base: '/api/supplier',
                description: 'Espace fournisseur (authentification requise + rôle supplier)',
                routes: [
                    // Dashboard
                    { method: 'GET', path: '/dashboard', description: 'Statistiques tableau de bord' },
                    
                    // Produits
                    { method: 'GET', path: '/products', description: 'Mes produits (avec pagination/filtres)' },
                    { method: 'POST', path: '/products', description: 'Créer un produit' },
                    { method: 'PUT', path: '/products/:id', description: 'Modifier un produit' },
                    { method: 'DELETE', path: '/products/:id', description: 'Supprimer un produit' },
                    
                    // Commandes
                    { method: 'GET', path: '/orders', description: 'Commandes clients (avec filtres)' },
                    { method: 'PUT', path: '/orders/:id/status', description: 'Mettre à jour statut commande' },
                    
                    // Paiements
                    { method: 'GET', path: '/payments', description: 'Solde et historique paiements' },
                    { method: 'POST', path: '/payouts', description: 'Demander un virement' },
                    
                    // Profil
                    { method: 'GET', path: '/profile', description: 'Mon profil fournisseur' },
                    { method: 'PUT', path: '/profile', description: 'Modifier profil' },
                    
                    // Promotions
                    { method: 'GET', path: '/promotions', description: 'Mes promotions' },
                    { method: 'POST', path: '/promotions', description: 'Créer une promotion' }
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
        method: req.method,
        suggestion: 'Consultez la documentation à GET /api'
    });
});

module.exports = router;