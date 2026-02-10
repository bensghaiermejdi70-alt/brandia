// ============================================
// SUPPLIER ROUTES - Complet et Corrigé v3.6
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import des middlewares AVANT toute utilisation
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// 🔥 Import du contrôleur avec toutes les méthodes
const supplierController = require('./supplier.controller');

console.log('[Supplier Routes] Loading...');
console.log('[Supplier Routes] Controller type:', typeof supplierController);
console.log('[Supplier Routes] Controller keys:', Object.keys(supplierController));

// ============================================
// MIDDLEWARES - Auth + Role fournisseur
// ============================================
// 🔥 Vérification que ce sont bien des fonctions
if (typeof authenticate !== 'function' || typeof requireRole !== 'function') {
  console.error('[Supplier Routes] ERROR: Middlewares are not functions!');
  console.error('authenticate:', typeof authenticate);
  console.error('requireRole:', typeof requireRole);
  throw new Error('Middlewares import failed');
}

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