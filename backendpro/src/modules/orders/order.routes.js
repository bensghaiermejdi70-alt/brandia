// ============================================
// ORDER ROUTES - Endpoints Commandes
// ============================================

const express = require('express');
const router = express.Router();
const OrderController = require('./order.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Routes protégées (client connecté)
router.post('/', authMiddleware, OrderController.create);
router.get('/', authMiddleware, OrderController.list);
router.get('/:id', authMiddleware, OrderController.detail);

// Route fournisseur
router.get('/supplier/orders', authMiddleware, OrderController.getSupplierOrders);

// Route admin (mettre à jour statut)
router.patch('/:id/status', authMiddleware, OrderController.updateStatus);

module.exports = router;