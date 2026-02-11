// ============================================
// ORDER ROUTES - Endpoints Commandes (CORRIGÉ)
// Erreur: Route.get() requires callback function
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 CORRECTION: Import nommé correct du middleware
const { authenticate } = require('../../middlewares/auth.middleware');

// 🔥 CORRECTION: Import du contrôleur
const OrderController = require('./order.controller');

// Debug
console.log('[Order Routes] Loading...');
console.log('[Order Routes] authenticate:', typeof authenticate);
console.log('[Order Routes] OrderController:', typeof OrderController);
console.log('[Order Routes] Methods:', Object.keys(OrderController || {}));

// ==========================================
// ROUTES FOURNISSEUR (spécifiques avant dynamiques)
// ==========================================

// Stats pour dashboard fournisseur - 🔥 VÉRIFIER: doit être une fonction
router.get('/supplier/stats', authenticate, OrderController.getSupplierStats);

// Liste des commandes du fournisseur - 🔥 VÉRIFIER: doit être une fonction  
router.get('/supplier/orders', authenticate, OrderController.getSupplierOrders);

// ==========================================
// ROUTES PAIEMENT
// ==========================================

// Confirmer un paiement (après succès Stripe côté frontend)
router.post('/confirm-payment', authenticate, OrderController.confirmPayment);

// ==========================================
// ROUTES CLIENT (protégées)
// ==========================================

// Créer une commande (checkout)
router.post('/', authenticate, OrderController.create);

// Liste mes commandes
router.get('/', authenticate, OrderController.list);

// Détail d'une commande
router.get('/:id', authenticate, OrderController.detail);

// ==========================================
// ROUTES ADMIN / MISE À JOUR
// ==========================================

// Mettre à jour le statut (ou fournisseur met à jour fulfillment)
router.patch('/:id/status', authenticate, OrderController.updateStatus);

module.exports = router;