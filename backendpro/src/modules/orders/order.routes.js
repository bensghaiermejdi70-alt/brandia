// ============================================
// ORDER ROUTES - Endpoints Commandes
// ============================================

const express = require('express');
const router = express.Router();
const OrderController = require('./order.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// ==========================================
// ROUTES FOURNISSEUR (spécifiques avant dynamiques)
// ==========================================

// Stats pour dashboard fournisseur
router.get('/supplier/stats', authMiddleware, OrderController.getSupplierStats);

// Liste des commandes du fournisseur
router.get('/supplier/orders', authMiddleware, OrderController.getSupplierOrders);

// ==========================================
// ROUTES PAIEMENT
// ==========================================

// Confirmer un paiement (après succès Stripe côté frontend)
router.post('/confirm-payment', authMiddleware, OrderController.confirmPayment);

// ==========================================
// ROUTES CLIENT (protégées)
// ==========================================

// Créer une commande (checkout)
router.post('/', authMiddleware, OrderController.create);

// Liste mes commandes
router.get('/', authMiddleware, OrderController.list);

// Détail d'une commande
router.get('/:id', authMiddleware, OrderController.detail);

// ==========================================
// ROUTES ADMIN / MISE À JOUR
// ==========================================

// Mettre à jour le statut (ou fournisseur met à jour fulfillment)
router.patch('/:id/status', authMiddleware, OrderController.updateStatus);

module.exports = router;