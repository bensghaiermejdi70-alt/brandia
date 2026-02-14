
// ============================================
// SUPPLIER ROUTES - v5.0 AVEC CLOUDINARY
// Uploads corrigés avec multer-storage-cloudinary
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage pour images produits
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'brandia/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});

// Storage pour vidéos campagnes
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'brandia/campaigns',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'webm'],
    transformation: [{ width: 720, crop: 'limit', quality: 'auto' }]
  }
});

// Middlewares multer
const uploadImage = multer({ 
  storage: imageStorage, 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadVideo = multer({ 
  storage: videoStorage, 
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Import controller
const supplierController = require('./supplier.controller');
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

console.log('[Supplier Routes] Loading v5.0 with Cloudinary...');

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// MIDDLEWARES AUTH pour routes protégées
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
// UPLOADS CLOUDINARY - Routes spéciales
// ============================================
router.post('/upload-image', uploadImage.single('media'), supplierController.uploadImage);
router.post('/upload-video', uploadVideo.single('media'), supplierController.uploadCampaignVideo);

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
// CAMPAGNES PUBLICITAIRES
// ============================================
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);
router.put('/campaigns/:id/status', supplierController.toggleCampaignStatus);

// ============================================
// GESTION ERREURS UPLOAD
// ============================================
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Fichier trop grand (max 5MB pour images, 50MB pour vidéos)' 
      });
    }
    return res.status(400).json({ 
      success: false, 
      message: 'Erreur upload: ' + error.message 
    });
  }
  
  if (error.message && error.message.includes('Cloudinary')) {
    console.error('[Cloudinary Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur Cloudinary: ' + error.message
    });
  }
  
  next(error);
});

module.exports = router;
'''

