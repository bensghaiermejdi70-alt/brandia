// ============================================
// SUPPLIER ROUTES - Complet et Corrigé v3.7
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import des middlewares (nouvelle structure)
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

console.log('[Supplier Routes] Loading...');
console.log('[Supplier Routes] Controller methods:', Object.keys(supplierController));

// ============================================
// ROUTES PUBLIQUES (sans auth) - À AJOUTER
// Ces routes doivent être AVANT le router.use(authenticate)
// ============================================
// Récupérer campagne active pour un produit (PUBLIC)
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);

// Tracker une vue (PUBLIC)
router.post('/public/campaigns/view', supplierController.trackCampaignView);

// Tracker un clic (PUBLIC)
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// MIDDLEWARES - Auth + Role fournisseur
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

// ============================================
// STATS & DASHBOARD
// ============================================
router.get('/stats', supplierController.getStats);

// ============================================
// PRODUITS
// ============================================
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// ============================================
// COMMANDES
// ============================================
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// ============================================
// PAIEMENTS & VIREMENTS
// ============================================
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/payouts', supplierController.getPayouts);

// ============================================
// PROMOTIONS
// ============================================
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);
router.put('/promotions/:id', supplierController.updatePromotion);
router.delete('/promotions/:id', supplierController.deletePromotion);

// ============================================
// CAMPAGNES PUBLICITAIRES
// ============================================
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);

// ============================================
// UPLOADS (Cloudinary)
// ============================================
router.post('/upload-image', supplierController.uploadMiddleware, supplierController.uploadImage);
router.post('/upload-video', supplierController.uploadMiddleware, supplierController.uploadCampaignVideo);

module.exports = router;