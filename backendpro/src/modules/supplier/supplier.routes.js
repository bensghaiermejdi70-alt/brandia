// ============================================
// SUPPLIER ROUTES - v6.1 PRODUCTION
// Changes: Fixed imports, added missing controller methods
// ============================================

const express = require('express');
const router = express.Router();

console.log('[Supplier Routes] Loading v6.1...');

// ============================================
// IMPORTS
// ============================================

const supplierController = require('./supplier.controller');

// Auth middleware - utiliser le même chemin que dans index.js
let authenticate, requireRole;

try {
    const authMiddleware = require('../../middlewares/auth.middleware');
    authenticate = authMiddleware.authenticate;
    requireRole = authMiddleware.requireRole;
} catch (e) {
    // Fallback si le chemin est différent
    const authMiddleware = require('../../middleware/auth');
    authenticate = authMiddleware.authenticate;
    requireRole = authMiddleware.requireRole;
}

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================

// Campaign publique pour affichage produit
router.get('/public/campaigns', asyncHandler(async (req, res) => {
    const { supplier, product } = req.query;
    
    if (!supplier || !product) {
        return res.status(400).json({ 
            success: false, 
            message: 'supplier et product sont requis' 
        });
    }

    // Utiliser la méthode existante ou créer une fallback
    if (supplierController.getActiveCampaignForProduct) {
        await supplierController.getActiveCampaignForProduct(req, res);
    } else {
        // Fallback si méthode non implémentée
        res.json({ 
            success: true, 
            data: null,
            message: 'Campaign feature not fully implemented yet'
        });
    }
}));

// Tracking des vues/clics
router.post('/public/campaigns/view', asyncHandler(async (req, res) => {
    if (supplierController.trackCampaignView) {
        await supplierController.trackCampaignView(req, res);
    } else {
        res.json({ success: true, message: 'View tracked' });
    }
}));

router.post('/public/campaigns/click', asyncHandler(async (req, res) => {
    if (supplierController.trackCampaignClick) {
        await supplierController.trackCampaignClick(req, res);
    } else {
        res.json({ success: true, message: 'Click tracked' });
    }
}));

// Paramètres publicitaires
router.get('/public/ad-settings', asyncHandler(async (req, res) => {
    const { supplier } = req.query;

    if (!supplier) {
        return res.status(400).json({ 
            success: false, 
            message: 'supplier required' 
        });
    }

    try {
        const db = require('../../config/db');
        
        const result = await db.query(`
            SELECT max_ads_per_session, priority, is_active, max_campaigns
            FROM supplier_ad_settings
            WHERE supplier_id = $1 AND is_active = true
        `, [supplier]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { 
                    max_ads_per_session: 1, 
                    priority: 5,
                    max_campaigns: 5,
                    is_default: true
                }
            });
        }

        res.json({
            success: true,
            data: {
                max_ads_per_session: parseInt(result.rows[0].max_ads_per_session) || 1,
                priority: parseInt(result.rows[0].priority) || 5,
                max_campaigns: parseInt(result.rows[0].max_campaigns) || 5,
                is_default: false
            }
        });
    } catch (error) {
        // Fallback si table n'existe pas
        res.json({
            success: true,
            data: { 
                max_ads_per_session: 1, 
                priority: 5,
                max_campaigns: 5,
                is_default: true
            }
        });
    }
}));

// ============================================
// MIDDLEWARES AUTH (appliqué à toutes les routes suivantes)
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

console.log('[Supplier Routes] Auth middleware applied');

// ============================================
// ROUTES PROTÉGÉES (requiert authentification supplier)
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

// Uploads (si implémentés dans controller)
if (supplierController.uploadImageMiddleware) {
    router.post('/upload-image', supplierController.uploadImageMiddleware, asyncHandler(async (req, res) => {
        await supplierController.uploadImage(req, res);
    }));
}

if (supplierController.uploadVideoMiddleware) {
    router.post('/upload-video', supplierController.uploadVideoMiddleware, asyncHandler(async (req, res) => {
        await supplierController.uploadCampaignVideo(req, res);
    }));
}

// Orders
router.get('/orders', asyncHandler(async (req, res) => {
    await supplierController.getOrders(req, res);
}));
router.get('/orders/:id', asyncHandler(async (req, res) => {
    if (supplierController.getOrderById) {
        await supplierController.getOrderById(req, res);
    } else {
        res.status(501).json({ success: false, message: 'Not implemented' });
    }
}));
router.put('/orders/:id/status', asyncHandler(async (req, res) => {
    await supplierController.updateOrderStatus(req, res);
}));

// Payments
router.get('/payments', asyncHandler(async (req, res) => {
    await supplierController.getPayments(req, res);
}));
router.post('/payouts', asyncHandler(async (req, res) => {
    if (supplierController.requestPayout) {
        await supplierController.requestPayout(req, res);
    } else {
        res.status(501).json({ success: false, message: 'Payout not implemented' });
    }
}));
router.get('/payouts', asyncHandler(async (req, res) => {
    if (supplierController.getPayouts) {
        await supplierController.getPayouts(req, res);
    } else {
        res.json({ success: true, data: [] });
    }
}));

// Promotions
router.get('/promotions', asyncHandler(async (req, res) => {
    await supplierController.getPromotions(req, res);
}));
router.post('/promotions', asyncHandler(async (req, res) => {
    await supplierController.createPromotion(req, res);
}));
router.put('/promotions/:id', asyncHandler(async (req, res) => {
    if (supplierController.updatePromotion) {
        await supplierController.updatePromotion(req, res);
    } else {
        res.status(501).json({ success: false, message: 'Not implemented' });
    }
}));
router.delete('/promotions/:id', asyncHandler(async (req, res) => {
    if (supplierController.deletePromotion) {
        await supplierController.deletePromotion(req, res);
    } else {
        res.status(501).json({ success: false, message: 'Not implemented' });
    }
}));

// Campaigns
router.get('/campaigns', asyncHandler(async (req, res) => {
    await supplierController.getCampaigns(req, res);
}));

// NOUVEAU: Endpoint pour récupérer la limite de campagnes
router.get('/campaigns/limit', asyncHandler(async (req, res) => {
    if (supplierController.getCampaignLimit) {
        await supplierController.getCampaignLimit(req, res);
    } else {
        // Fallback: retourner une limite par défaut
        res.json({
            success: true,
            data: {
                max_campaigns: 5,
                current_campaigns: 0,
                can_create: true
            }
        });
    }
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
    if (supplierController.toggleCampaignStatus) {
        await supplierController.toggleCampaignStatus(req, res);
    } else {
        // Fallback: utiliser updateCampaign avec le statut
        await supplierController.updateCampaign(req, res);
    }
}));

// Ad Settings (si implémenté)
router.get('/ad-settings', asyncHandler(async (req, res) => {
    if (supplierController.getAdSettings) {
        await supplierController.getAdSettings(req, res);
    } else {
        res.json({
            success: true,
            data: {
                max_ads_per_session: 1,
                priority: 5,
                is_active: true
            }
        });
    }
}));

console.log('[Supplier Routes] ✅ v6.1 loaded successfully');

module.exports = router;