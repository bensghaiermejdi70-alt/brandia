const express = require('express');
const router = express.Router();

const { controller, uploadMiddleware } = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

console.log('[Supplier Routes] Loaded');

// ===============================
// ROUTES PUBLIQUES
// ===============================
router.get('/campaigns/active/:supplierId/:productId', controller.getActiveCampaignForProduct);
router.post('/campaigns/track/click', controller.trackCampaignClick);
router.post('/campaigns/track/view', controller.trackCampaignView);

// ===============================
// ROUTES PROTÉGÉES
// ===============================
router.use(authMiddleware);

// Dashboard
router.get('/stats', controller.getStats);

// Produits
router.get('/products', controller.getProducts);
router.post('/products', controller.createProduct);
router.put('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);

// Uploads
router.post('/upload-image', uploadMiddleware, controller.uploadImage);
router.post('/upload-video', uploadMiddleware, controller.uploadCampaignVideo);

// Commandes ✅
router.get('/orders', controller.getOrders);
router.put('/orders/:id/status', controller.updateOrderStatus);

// Paiements
router.get('/payments', controller.getPayments);
router.post('/payouts', controller.requestPayout);

// Campagnes
router.get('/campaigns', controller.getCampaigns);
router.post('/campaigns', controller.createCampaign);
router.put('/campaigns/:id', controller.updateCampaign);
router.delete('/campaigns/:id', controller.deleteCampaign);

module.exports = router;
