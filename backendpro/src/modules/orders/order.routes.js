// ============================================
// ORDER ROUTES - Endpoints Commandes
// ============================================

const express = require('express');
const router = express.Router();
const OrderController = require('./order.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Route fournisseur (mettre avant les routes dynamiques)
router.get('/supplier/orders', authMiddleware, OrderController.getSupplierOrders);

// Routes protégées (client connecté)
router.post('/', authMiddleware, OrderController.create);
router.get('/', authMiddleware, OrderController.list);
router.get('/:id', authMiddleware, OrderController.detail);

// Route admin (mettre à jour statut)
router.patch('/:id/status', authMiddleware, OrderController.updateStatus);

module.exports = router;
