const express = require('express');
const router = express.Router();
const supplierController = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

console.log('[Supplier Routes] Loading...');

// ==========================================
// ROUTES PUBLIQUES (pas d'authentification)
// ==========================================

// Route pour récupérer une campagne active (utilisée par le frontend produit)
router.get('/campaigns/active/:supplierId/:productId', supplierController.getActiveCampaignForProduct);

// Tracking des clics (pas besoin d'auth pour tracker)
router.post('/campaigns/track/click', supplierController.trackCampaignClick);

// ==========================================
// ROUTES PROTÉGÉES (nécessitent JWT)
// ==========================================
router.use(authMiddleware);

// Stats et dashboard
router.get('/stats', supplierController.getStats);

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

// Campagnes (CRUD fournisseur)
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
// ? SUPPRIMÉ: router.put('/campaigns/:id/status', supplierController.updateCampaignStatus);
// ? Utilise updateCampaign à la place (gère le status dans le body)
router.delete('/campaigns/:id', supplierController.deleteCampaign);

// Tracking views (protégé car appelé depuis le dashboard)
router.post('/campaigns/track/view', supplierController.trackCampaignView);

console.log('[Supplier Routes] Loaded successfully');
module.exports = router;