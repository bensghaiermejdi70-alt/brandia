// ============================================
// SUPPLIER ROUTES - Complet et Corrigé v3.8
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import des middlewares
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

console.log('[Supplier Routes] Loading...');
console.log('[Supplier Routes] Controller methods:', Object.keys(supplierController));

// ============================================
// ROUTES PUBLIQUES (sans auth) - CORRIGÉ
// ============================================

// Ces routes utilisent les méthodes du controller si elles existent, sinon fallback
router.get('/public/campaigns', (req, res, next) => {
  if (supplierController.getActiveCampaignForProduct) {
    return supplierController.getActiveCampaignForProduct(req, res, next);
  }
  res.status(501).json({ success: false, message: 'Not implemented' });
});

router.post('/public/campaigns/view', (req, res, next) => {
  if (supplierController.trackCampaignView) {
    return supplierController.trackCampaignView(req, res, next);
  }
  res.json({ success: true, message: 'Tracked (fallback)' });
});

router.post('/public/campaigns/click', (req, res, next) => {
  if (supplierController.trackCampaignClick) {
    return supplierController.trackCampaignClick(req, res, next);
  }
  res.json({ success: true, message: 'Tracked (fallback)' });
});

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
// UPLOADS - CORRIGÉ (sans uploadMiddleware)
// ============================================
router.post('/upload-image', (req, res, next) => {
  if (supplierController.uploadImage) {
    return supplierController.uploadImage(req, res, next);
  }
  res.status(501).json({ success: false, message: 'Upload not implemented' });
});

router.post('/upload-video', (req, res, next) => {
  if (supplierController.uploadCampaignVideo) {
    return supplierController.uploadCampaignVideo(req, res, next);
  }
  res.status(501).json({ success: false, message: 'Upload not implemented' });
});

module.exports = router;