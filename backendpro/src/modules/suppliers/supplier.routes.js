const express = require('express');
const router = express.Router();
const supplierController = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Protection JWT pour toutes les routes
router.use(authMiddleware);

// ==========================================
// DASHBOARD
// ==========================================
router.get('/dashboard', supplierController.getDashboardStats);

// ==========================================
// PRODUITS
// ==========================================
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// ==========================================
// COMMANDES
// ==========================================
router.get('/orders', supplierController.getOrders);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// ==========================================
// PAIEMENTS
// ==========================================
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);

// ==========================================
// PROFIL
// ==========================================
router.get('/profile', supplierController.getProfile);
router.put('/profile', supplierController.updateProfile);

// ==========================================
// PROMOTIONS
// ==========================================
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);

module.exports = router;