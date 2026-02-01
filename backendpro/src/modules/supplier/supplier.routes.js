const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

// Protection JWT sur toutes les routes
router.use(authenticate);

// Dashboard & Stats
router.get('/stats', supplierController.getStats);
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

// Publicité
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.get('/campaigns/active', supplierController.getActiveCampaignForProduct);

module.exports = router;