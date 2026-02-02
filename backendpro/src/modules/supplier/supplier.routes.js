const express = require('express');
const router = express.Router();

// Import middleware et controller
const authMiddleware = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

// Vérification import
console.log('[Supplier Routes] Auth middleware type:', typeof authMiddleware);
console.log('[Supplier Routes] Controller methods:', Object.keys(supplierController || {}));

// Récupération fonction d'authentification
const authenticate = authMiddleware.authenticate || authMiddleware;

if (typeof authenticate !== 'function') {
    throw new Error('Middleware d\'authentification invalide dans supplier.routes.js');
}

// Protection JWT sur toutes les routes supplier
router.use((req, res, next) => {
    console.log(`[Supplier Route] ${req.method} ${req.path} - Auth check...`);
    authenticate(req, res, next);
});

// Dashboard & Stats
router.get('/stats', (req, res, next) => {
    console.log('[Supplier] Appel getStats par user:', req.user?.id);
    supplierController.getStats(req, res, next);
});

// Profil
router.get('/profile', supplierController.getProfile);

// Produits
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// Commandes
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// Paiements
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);

// Campagnes publicitaires
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.get('/campaigns/active', supplierController.getActiveCampaignForProduct);

module.exports = router;