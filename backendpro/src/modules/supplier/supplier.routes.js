// ============================================
// SUPPLIER ROUTES - v5.1 CORRIGÉ
// ============================================

const express = require('express');
const router = express.Router();

// Import du controller - UTILISER LE MÊME FICHIER
const supplierController = require('./supplier.controller');

console.log('[Supplier Routes] Loading v5.1...');

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// IMPORT MIDDLEWARES AUTH
// ============================================
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// ============================================
// MIDDLEWARES AUTH pour routes protégées
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

// ============================================
// STATS & DASHBOARD
// ============================================
router.get('/stats', supplierController.getStats);

// ============================================
// PRODUITS
// ============================================
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// ============================================
// UPLOADS - Routes avec multer middleware
// ============================================
router.post('/upload-image', supplierController.uploadImageMiddleware, supplierController.uploadImage);
router.post('/upload-video', supplierController.uploadVideoMiddleware, supplierController.uploadCampaignVideo);

// ============================================
// COMMANDES
// ============================================
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// ============================================
// PAIEMENTS
// ============================================
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/payouts', supplierController.getPayouts);

// ============================================
// PROMOTIONS
// ============================================
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);
router.put('/promotions/:id', supplierController.updatePromotion);
router.delete('/promotions/:id', supplierController.deletePromotion);

// ============================================
// CAMPAGNES PUBLICITAIRES
// ============================================
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);
router.put('/campaigns/:id/status', supplierController.toggleCampaignStatus);

console.log('[Supplier Routes] All routes registered');

module.exports = router;