// ============================================
// SUPPLIER ROUTES - v5.3 CORRIGÉ
// ============================================

const express = require('express');
const router = express.Router();

console.log('[Supplier Routes] Loading v5.3...');

// Import du controller
let supplierController;
try {
    supplierController = require('./supplier.controller');
    console.log('[Supplier Routes] Controller loaded');
} catch (err) {
    console.error('[Supplier Routes] FAILED to load controller:', err.message);
    module.exports = router;
    return;
}

// Import middlewares
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// ============================================
// ROUTES PUBLIQUES (doivent être AVANT le middleware auth)
// ============================================

// 🔥 IMPORTANT: Ces routes sont accessibles sans authentification
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// MIDDLEWARES D'AUTHENTIFICATION (tout ce qui suit est protégé)
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

// ============================================
// ROUTES PROTÉGÉES FOURNISSEUR
// ============================================

// Stats
router.get('/stats', supplierController.getStats);

// Products
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// Uploads
router.post('/upload-image', supplierController.uploadImageMiddleware, supplierController.uploadImage);
router.post('/upload-video', supplierController.uploadVideoMiddleware, supplierController.uploadCampaignVideo);

// Orders
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// Payments
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/payouts', supplierController.getPayouts);

// Promotions
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);
router.put('/promotions/:id', supplierController.updatePromotion);
router.delete('/promotions/:id', supplierController.deletePromotion);

// Campaigns
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);
router.put('/campaigns/:id/status', supplierController.toggleCampaignStatus);

console.log('[Supplier Routes] All routes registered successfully');

module.exports = router;