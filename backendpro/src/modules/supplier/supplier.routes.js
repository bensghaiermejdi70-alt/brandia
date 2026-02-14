// ============================================
// SUPPLIER ROUTES - v4.0 CORRECTION CRITIQUE
// Contourne express.json() sur les routes d'upload
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configuration multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'), false);
    }
  }
});

// 🔥 CORRECTION CRITIQUE : Importer les middlewares
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

console.log('[Supplier Routes] Loading v4.0...');

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// MIDDLEWARES AUTH
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
// PAIEMENTS
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
// CAMPAGNES
// ============================================
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);

// ============================================
// UPLOADS - CORRECTION CRITIQUE v4.0
// ============================================

// 🔥 SOLUTION 1 : Désactiver express.json pour ces routes spécifiques
// en utilisant un middleware qui vide le body déjà parsé
const resetBodyForUpload = (req, res, next) => {
  // Si express.json a déjà parsé le body, on le remet à undefined
  // pour que multer re-parse correctement
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    console.log('[Upload] Resetting body for multer');
    req.body = undefined;
  }
  next();
};

// Routes d'upload avec le reset + multer
router.post('/upload-image', resetBodyForUpload, upload.single('media'), supplierController.uploadImage);
router.post('/upload-video', resetBodyForUpload, upload.single('media'), supplierController.uploadCampaignVideo);

// Gestion des erreurs multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Fichier trop grand (max 50MB)' 
      });
    }
    return res.status(400).json({ 
      success: false, 
      message: 'Erreur upload: ' + error.message 
    });
  }
  next(error);
});

module.exports = router;