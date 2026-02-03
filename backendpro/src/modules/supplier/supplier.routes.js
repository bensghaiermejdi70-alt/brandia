const express = require('express');
const router = express.Router();
const supplierController = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

console.log('[Supplier Routes] Loading...');

// ROUTES PUBLIQUES
router.get('/campaigns/active/:supplierId/:productId', supplierController.getActiveCampaignForProduct);
router.post('/campaigns/track/click', supplierController.trackCampaignClick);

// ROUTES PROTÉGÉES
router.use(authMiddleware);

router.get('/stats', supplierController.getStats);
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);
router.post('/campaigns/track/view', supplierController.trackCampaignView);

console.log('[Supplier Routes] Loaded successfully');
module.exports = router;
