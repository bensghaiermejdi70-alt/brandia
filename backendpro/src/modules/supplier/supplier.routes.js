const express = require('express');
const router = express.Router();
const { controller, uploadMiddleware } = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

console.log('[Supplier Routes] Loading...');

// ============================================
// ROUTES PUBLIQUES (Sans authentification)
// ============================================
router.get('/campaigns/active/:supplierId/:productId', controller.getActiveCampaignForProduct);
router.post('/campaigns/track/click', controller.trackCampaignClick);
router.post('/campaigns/track/view', controller.trackCampaignView);

// ============================================
// ROUTES PROTÉGÉES (Authentification requise)
// ============================================
router.use(authMiddleware);

router.get('/stats', controller.getStats);
router.get('/products', controller.getProducts);

// ✅ NOUVEAU: Upload image avant création produit
router.post('/upload-image', uploadMiddleware, controller.uploadImage);

router.post('/products', controller.createProduct);
router.put('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);
router.get('/orders', controller.getOrders);
router.get('/orders/:id', controller.getOrderById);
router.put('/orders/:id/status', controller.updateOrderStatus);
router.get('/payments', controller.getPayments);
router.post('/payouts', controller.requestPayout);
router.get('/campaigns', controller.getCampaigns);
router.post('/campaigns', controller.createCampaign);
router.put('/campaigns/:id', controller.updateCampaign);
router.delete('/campaigns/:id', controller.deleteCampaign);

console.log('[Supplier Routes] Loaded successfully');
module.exports = router;