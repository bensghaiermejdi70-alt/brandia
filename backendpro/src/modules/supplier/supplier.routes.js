const express = require('express');
const router = express.Router();
const supplierController = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/dashboard', supplierController.getDashboardStats);
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);
router.get('/orders', supplierController.getOrders);
router.put('/orders/:id/status', supplierController.updateOrderStatus);
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/profile', supplierController.getProfile);
router.put('/profile', supplierController.updateProfile);
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);

module.exports = router;
