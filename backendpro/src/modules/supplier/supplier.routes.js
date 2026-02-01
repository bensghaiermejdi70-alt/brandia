const express = require('express');
const router = express.Router();

// Import du middleware (vérifie le bon nom selon ton projet)
const authMiddleware = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

// Si authMiddleware est un objet avec 'authenticate', on l'utilise
// Sinon on utilise authMiddleware directement s'il est déjà la fonction
const authenticate = authMiddleware.authenticate || authMiddleware;

// Protection JWT sur toutes les routes
router.use(authenticate);

// Dashboard & Stats
router.get('/stats', supplierController.getStats);
router.get('/profile', supplierController.getProfile);
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
router.get('/campaigns/active', supplierController.getActiveCampaignForProduct);

module.exports = router;