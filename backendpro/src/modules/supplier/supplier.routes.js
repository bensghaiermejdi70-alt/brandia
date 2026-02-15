// ============================================
// SUPPLIER ROUTES - v5.2 CORRIGÉ
// ============================================

const express = require('express');
const router = express.Router();

console.log('[Supplier Routes] Loading v5.2...');

// Import du controller
let supplierController;
try {
    supplierController = require('./supplier.controller');
    console.log('[Supplier Routes] Controller loaded');
    
    // Vérification que les méthodes existent
    const requiredMethods = ['getStats', 'getProducts', 'createProduct', 'updateProduct', 'deleteProduct', 
                             'getOrders', 'getOrderById', 'updateOrderStatus', 'getPayments', 'requestPayout', 
                             'getPayouts', 'getPromotions', 'createPromotion', 'updatePromotion', 'deletePromotion',
                             'getCampaigns', 'createCampaign', 'updateCampaign', 'deleteCampaign', 'toggleCampaignStatus',
                             'getActiveCampaignForProduct', 'trackCampaignClick', 'trackCampaignView',
                             'uploadImage', 'uploadCampaignVideo', 'uploadImageMiddleware', 'uploadVideoMiddleware'];
    
    const missing = requiredMethods.filter(m => typeof supplierController[m] !== 'function');
    if (missing.length > 0) {
        console.error('[Supplier Routes] MISSING methods:', missing);
        throw new Error('Methodes manquantes dans le controller');
    }
    
} catch (err) {
    console.error('[Supplier Routes] FAILED to load controller:', err.message);
    // Export router vide pour éviter crash
    module.exports = router;
    return;
}

// Import middlewares
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// ============================================
// ROUTES PUBLIQUES
// ============================================
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// ROUTES PROTÉGÉES
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

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