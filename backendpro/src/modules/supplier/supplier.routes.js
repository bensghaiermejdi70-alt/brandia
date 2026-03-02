// ============================================
// SUPPLIER ROUTES - v6.7 FIX
// Fix: Ordre des routes campaigns/limit corrigé
// ============================================

const express = require('express');
const router = express.Router();

console.log('[Supplier Routes] Loading v6.7...');

const supplierController = require('./supplier.controller');

// Auth middleware
let authenticate, requireRole;
try {
    const auth = require('../../middlewares/auth.middleware');
    authenticate = auth.authenticate;
    requireRole = auth.requireRole;
} catch (e) {
    try {
        const auth = require('../../middleware/auth');
        authenticate = auth.authenticate;
        requireRole = auth.requireRole;
    } catch (e2) {
        console.error('[Supplier Routes] ⚠️ Auth middleware not found, using fallback');
        authenticate = (req, res, next) => next();
        requireRole = () => (req, res, next) => next();
    }
}

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        console.error('[Supplier Routes] Error:', err);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });
};

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================

router.get('/public/campaigns', asyncHandler(supplierController.getActiveCampaignForProduct));
router.post('/public/campaigns/view', asyncHandler(supplierController.trackCampaignView));
router.post('/public/campaigns/click', asyncHandler(supplierController.trackCampaignClick));

// ============================================
// AUTH REQUIRED - Toutes les routes suivantes
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

// ============================================
// STATS & INFOS
// ============================================

router.get('/stats', asyncHandler(supplierController.getStats));

// ============================================
// UPLOAD ROUTES - CORRECTION CHAMP 'media'
// ============================================

if (supplierController.uploadImageMiddleware) {
    router.post('/upload-image', 
        supplierController.uploadImageMiddleware, 
        asyncHandler(supplierController.uploadImage)
    );
    console.log('[Supplier Routes] ✅ Upload image route enabled (field: media)');
} else {
    router.post('/upload-image', (req, res) => {
        res.status(501).json({ 
            success: false, 
            message: 'Upload non disponible. Installez: npm install multer cloudinary' 
        });
    });
}

if (supplierController.uploadVideoMiddleware) {
    router.post('/upload-video',
        supplierController.uploadVideoMiddleware,
        asyncHandler(supplierController.uploadVideo)
    );
    console.log('[Supplier Routes] ✅ Upload video route enabled (field: media)');
} else {
    router.post('/upload-video', (req, res) => {
        res.status(501).json({ 
            success: false, 
            message: 'Upload non disponible. Installez: npm install multer cloudinary' 
        });
    });
}

// ============================================
// PRODUCTS
// ============================================

router.get('/products', asyncHandler(supplierController.getProducts));
router.post('/products', asyncHandler(supplierController.createProduct));
router.put('/products/:id', asyncHandler(supplierController.updateProduct));
router.delete('/products/:id', asyncHandler(supplierController.deleteProduct));

// ============================================
// ORDERS
// ============================================

router.get('/orders', asyncHandler(supplierController.getOrders));
router.get('/orders/:id', asyncHandler(supplierController.getOrderById));
router.put('/orders/:id/status', asyncHandler(supplierController.updateOrderStatus));

// ============================================
// CAMPAIGNS - 🔥 ORDRE CRITIQUE: /limit AVANT /:id
// ============================================

// 🔥 CETTE ROUTE DOIT ÊTRE AVANT /campaigns/:id
router.get('/campaigns/limit', asyncHandler(supplierController.getCampaignLimit));

// Route liste principale
router.get('/campaigns', asyncHandler(supplierController.getCampaigns));

// Routes avec paramètres ID en dernier
router.post('/campaigns', asyncHandler(supplierController.createCampaign));
router.put('/campaigns/:id', asyncHandler(supplierController.updateCampaign));
router.delete('/campaigns/:id', asyncHandler(supplierController.deleteCampaign));
router.put('/campaigns/:id/status', asyncHandler(supplierController.toggleCampaignStatus));

// ============================================
// PAYMENTS
// ============================================

router.get('/payments', asyncHandler(supplierController.getPayments));
router.post('/payouts', asyncHandler(supplierController.requestPayout));
router.get('/payouts', asyncHandler(supplierController.getPayouts));

// ============================================
// PROMOTIONS
// ============================================

router.get('/promotions', asyncHandler(supplierController.getPromotions));
router.post('/promotions', asyncHandler(supplierController.createPromotion));
router.put('/promotions/:id', asyncHandler(supplierController.updatePromotion));
router.delete('/promotions/:id', asyncHandler(supplierController.deletePromotion));

// ============================================
// AD SETTINGS
// ============================================

router.get('/ad-settings', asyncHandler(supplierController.getAdSettings));

console.log('[Supplier Routes] ✅ v6.7 loaded successfully');

module.exports = router;