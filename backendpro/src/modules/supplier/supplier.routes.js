// ============================================
// SUPPLIER ROUTES - Complet et Corrigé v3.9
// AJOUT : Middleware multer pour l'upload de fichiers
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configuration multer pour l'upload de fichiers
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter images et vidéos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez une image ou une vidéo.'), false);
    }
  }
});

// 🔥 Import des middlewares
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');
const supplierController = require('./supplier.controller');

console.log('[Supplier Routes] Loading v3.9...');
console.log('[Supplier Routes] Controller methods:', Object.keys(supplierController));

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================

router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
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
// UPLOADS - CORRIGÉ avec multer
// ============================================
// 🔥 Utilisation de upload.single('media') pour parser le fichier
router.post('/upload-image', upload.single('media'), supplierController.uploadImage);
router.post('/upload-video', upload.single('media'), supplierController.uploadCampaignVideo);

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