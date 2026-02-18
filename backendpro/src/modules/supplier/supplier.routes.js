// ============================================
// SUPPLIER ROUTES - v5.7 PRODUCTION READY
// ============================================

const express = require('express');
const router = express.Router();

console.log('[Supplier Routes] Loading v5.7...');

// ============================================
// IMPORTS
// ============================================

const supplierController = require('./supplier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { authenticate, requireRole } = authMiddleware;

// ============================================
// WRAPPER pour gestion async des erreurs
// ============================================

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================

// 🔥 CAMPAIGNS PUBLIQUES - Doivent être AVANT le middleware auth
router.get('/public/campaigns', asyncHandler(async (req, res) => {
    const { supplier, product } = req.query;
    
    if (!supplier || !product) {
        return res.status(400).json({ 
            success: false, 
            message: 'supplier et product sont requis' 
        });
    }

    await supplierController.getActiveCampaignForProduct(req, res);
}));

router.post('/public/campaigns/view', asyncHandler(async (req, res) => {
    await supplierController.trackCampaignView(req, res);
}));

router.post('/public/campaigns/click', asyncHandler(async (req, res) => {
    await supplierController.trackCampaignClick(req, res);
}));

router.get('/public/ad-settings', asyncHandler(async (req, res) => {
    const { supplier } = req.query;

    if (!supplier) {
        return res.status(400).json({ 
            success: false, 
            message: 'supplier required' 
        });
    }

    const db = require('../../config/db');
    
    const result = await db.query(`
        SELECT max_ads_per_session, priority, is_active
        FROM supplier_ad_settings
        WHERE supplier_id = $1 AND is_active = true
    `, [supplier]);

    if (result.rows.length === 0) {
        return res.json({
            success: true,
            data: { 
                max_ads_per_session: 1, 
                priority: 5,
                is_default: true
            }
        });
    }

    res.json({
        success: true,
        data: {
            max_ads_per_session: parseInt(result.rows[0].max_ads_per_session) || 1,
            priority: parseInt(result.rows[0].priority) || 5,
            is_default: false
        }
    });
}));

// ============================================
// MIDDLEWARES D'AUTHENTIFICATION (APRÈS les routes publiques)
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

console.log('[Supplier Routes] Auth middleware applied to protected routes');

// ============================================
// ROUTES PROTÉGÉES FOURNISSEUR
// ============================================

// Stats
router.get('/stats', asyncHandler(async (req, res) => {
    await supplierController.getStats(req, res);
}));

// Products
router.get('/products', asyncHandler(async (req, res) => {
    await supplierController.getProducts(req, res);
}));

router.post('/products', asyncHandler(async (req, res) => {
    await supplierController.createProduct(req, res);
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
    await supplierController.updateProduct(req, res);
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
    await supplierController.deleteProduct(req, res);
}));

// Uploads
router.post('/upload-image', supplierController.uploadImageMiddleware, asyncHandler(async (req, res) => {
    await supplierController.uploadImage(req, res);
}));

router.post('/upload-video', supplierController.uploadVideoMiddleware, asyncHandler(async (req, res) => {
    await supplierController.uploadCampaignVideo(req, res);
}));

// Orders
router.get('/orders', asyncHandler(async (req, res) => {
    await supplierController.getOrders(req, res);
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
    await supplierController.getOrderById(req, res);
}));

router.put('/orders/:id/status', asyncHandler(async (req, res) => {
    await supplierController.updateOrderStatus(req, res);
}));

// Payments
router.get('/payments', asyncHandler(async (req, res) => {
    await supplierController.getPayments(req, res);
}));

router.post('/payouts', asyncHandler(async (req, res) => {
    await supplierController.requestPayout(req, res);
}));

router.get('/payouts', asyncHandler(async (req, res) => {
    await supplierController.getPayouts(req, res);
}));

// Promotions
router.get('/promotions', asyncHandler(async (req, res) => {
    await supplierController.getPromotions(req, res);
}));

router.post('/promotions', asyncHandler(async (req, res) => {
    await supplierController.createPromotion(req, res);
}));

router.put('/promotions/:id', asyncHandler(async (req, res) => {
    await supplierController.updatePromotion(req, res);
}));

router.delete('/promotions/:id', asyncHandler(async (req, res) => {
    await supplierController.deletePromotion(req, res);
}));

// Campaigns (protégées)
router.get('/campaigns', asyncHandler(async (req, res) => {
    await supplierController.getCampaigns(req, res);
}));

router.post('/campaigns', asyncHandler(async (req, res) => {
    await supplierController.createCampaign(req, res);
}));

router.put('/campaigns/:id', asyncHandler(async (req, res) => {
    await supplierController.updateCampaign(req, res);
}));

router.delete('/campaigns/:id', asyncHandler(async (req, res) => {
    await supplierController.deleteCampaign(req, res);
}));

router.put('/campaigns/:id/status', asyncHandler(async (req, res) => {
    await supplierController.toggleCampaignStatus(req, res);
}));

// Ad Settings (protégées)
router.get('/ad-settings', asyncHandler(async (req, res) => {
    await supplierController.getAdSettings(req, res);
}));

console.log('[Supplier Routes] ✅ All routes registered successfully');

module.exports = router;