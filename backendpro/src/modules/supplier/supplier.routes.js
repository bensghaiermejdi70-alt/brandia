const express = require('express');
const router = express.Router();
const { controller, uploadMiddleware } = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

console.log('[Supplier Routes] Loading...');
console.log('[Supplier Routes] Controller type:', typeof controller);
console.log('[Supplier Routes] Controller methods:', {
  getStats: typeof controller?.getStats,
  getProducts: typeof controller?.getProducts,
  getOrders: typeof controller?.getOrders,
  getOrderById: typeof controller?.getOrderById,
  updateOrderStatus: typeof controller?.updateOrderStatus,
  getCampaigns: typeof controller?.getCampaigns,
  createCampaign: typeof controller?.createCampaign,
  updateCampaign: typeof controller?.updateCampaign,
  deleteCampaign: typeof controller?.deleteCampaign,
  uploadImage: typeof controller?.uploadImage,
  uploadCampaignVideo: typeof controller?.uploadCampaignVideo
});

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
router.get('/promotions', controller.getPromotions);
router.post('/promotions', controller.createPromotion);
router.put('/promotions/:id', controller.updatePromotion);
router.delete('/promotions/:id', controller.deletePromotion);
router.get('/stats', controller.getStats);
router.get('/products', controller.getProducts);
router.post('/upload-image', uploadMiddleware, controller.uploadImage);
router.post('/upload-video', uploadMiddleware, controller.uploadCampaignVideo);
router.post('/products', controller.createProduct);
router.put('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);
router.get('/orders', controller.getOrders);
router.get('/orders/:id', controller.getOrderById);
router.put('/orders/:id/status', controller.updateOrderStatus);
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/payouts', supplierController.getPayouts);
router.get('/campaigns', controller.getCampaigns);
router.post('/campaigns', controller.createCampaign);
router.put('/campaigns/:id', controller.updateCampaign);
router.delete('/campaigns/:id', controller.deleteCampaign);

console.log('[Supplier Routes] Loaded successfully');
module.exports = router;