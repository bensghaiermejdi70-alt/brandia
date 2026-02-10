// ============================================
// SUPPLIER ROUTES - Complet et Corrigé v3.5
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// 🔥 CORRECTION : Importation correcte du contrôleur
const { 
  getStats,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getPayments,
  requestPayout,
  getPayouts,
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  uploadImage,
  uploadCampaignVideo,
  uploadMiddleware
} = require('./supplier.controller');

console.log('[Supplier Routes] Loading...');

// Debug - Vérifier les fonctions importées
console.log('[Supplier Routes] Imported functions:', {
  getStats: typeof getStats,
  getProducts: typeof getProducts,
  getOrders: typeof getOrders,
  getPayments: typeof getPayments,
  requestPayout: typeof requestPayout
});

// ============================================
// MIDDLEWARES - Auth + Role fournisseur
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

// ============================================
// STATS & DASHBOARD
// ============================================
router.get('/stats', getStats);

// ============================================
// PRODUITS
// ============================================
router.get('/products', getProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// ============================================
// COMMANDES
// ============================================
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/status', updateOrderStatus);

// ============================================
// PAIEMENTS & VIREMENTS
// ============================================
router.get('/payments', getPayments);
router.post('/payouts', requestPayout);
router.get('/payouts', getPayouts);

// ============================================
// PROMOTIONS
// ============================================
router.get('/promotions', getPromotions);
router.post('/promotions', createPromotion);
router.put('/promotions/:id', updatePromotion);
router.delete('/promotions/:id', deletePromotion);

// ============================================
// CAMPAGNES PUBLICITAIRES
// ============================================
router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);

// ============================================
// UPLOADS (Cloudinary)
// ============================================
router.post('/upload-image', uploadMiddleware, uploadImage);
router.post('/upload-video', uploadMiddleware, uploadCampaignVideo);

module.exports = router;