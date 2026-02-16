// ============================================
// SUPPLIER ROUTES - v5.5 CORRIGÉ ET COMPLET
// ============================================

const express = require('express');
const router = express.Router();

console.log('[Supplier Routes] Loading v5.5...');

// Import du controller
let supplierController;
try {
    supplierController = require('./supplier.controller');
    console.log('[Supplier Routes] ✅ Controller loaded');
} catch (err) {
    console.error('[Supplier Routes] ❌ FAILED to load controller:', err.message);
    // On continue pour ne pas bloquer tout le serveur, mais on log l'erreur
    supplierController = {};
}

// Import middlewares
let authMiddleware;
try {
    authMiddleware = require('../../middlewares/auth.middleware');
    console.log('[Supplier Routes] ✅ Auth middleware loaded');
} catch (err) {
    console.error('[Supplier Routes] ❌ FAILED to load auth middleware:', err.message);
    authMiddleware = { authenticate: (req, res, next) => next(), requireRole: () => (req, res, next) => next() };
}

const { authenticate, requireRole } = authMiddleware;

// ============================================
// ROUTES PUBLIQUES (sans authentification) - DOIVENT ÊTRE EN PREMIER
// ============================================

// 🔥 CRITIQUE : Ces routes doivent fonctionner sans auth
router.get('/public/campaigns', async (req, res) => {
    try {
        if (!supplierController.getActiveCampaignForProduct) {
            throw new Error('Controller method getActiveCampaignForProduct not available');
        }
        await supplierController.getActiveCampaignForProduct(req, res);
    } catch (err) {
        console.error('[Public Campaigns] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/public/campaigns/view', async (req, res) => {
    try {
        if (!supplierController.trackCampaignView) {
            throw new Error('Controller method trackCampaignView not available');
        }
        await supplierController.trackCampaignView(req, res);
    } catch (err) {
        console.error('[Track View] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/public/campaigns/click', async (req, res) => {
    try {
        if (!supplierController.trackCampaignClick) {
            throw new Error('Controller method trackCampaignClick not available');
        }
        await supplierController.trackCampaignClick(req, res);
    } catch (err) {
        console.error('[Track Click] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Paramètres publicitaires publics (quota par marque)
router.get('/public/ad-settings', async (req, res) => {
    try {
        const { supplier } = req.query;
    
        if (!supplier) {
            return res.status(400).json({ 
                success: false, 
                message: 'supplier required' 
            });
        }

        const db = require('../../config/db');
    
        // Récupérer les paramètres Brandia pour ce fournisseur
        const result = await db.query(`
            SELECT max_ads_per_session, priority, is_active
            FROM supplier_ad_settings
            WHERE supplier_id = $1 AND is_active = true
        `, [supplier]);

        if (result.rows.length === 0) {
            // Par défaut : 1 pub par session
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

    } catch (error) {
        console.error('[Public Ad Settings] Error:', error);
        res.json({ 
            success: true, 
            data: { 
                max_ads_per_session: 1, 
                priority: 5,
                is_default: true,
                error: 'database_error'
            }
        });
    }
});

// ============================================
// MIDDLEWARES D'AUTHENTIFICATION - TOUT CE QUI SUIT NÉCESSITE UN TOKEN
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

console.log('[Supplier Routes] Auth middleware applied to protected routes');

// ============================================
// ROUTES PROTÉGÉES FOURNISSEUR
// ============================================

// 🔥 STATS - La route qui manquait !
router.get('/stats', async (req, res) => {
    try {
        if (!supplierController.getStats) {
            throw new Error('Controller method getStats not available');
        }
        await supplierController.getStats(req, res);
    } catch (err) {
        console.error('[Stats] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Products
router.get('/products', async (req, res) => {
    try {
        await supplierController.getProducts(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        await supplierController.createProduct(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        await supplierController.updateProduct(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        await supplierController.deleteProduct(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Uploads
router.post('/upload-image', supplierController.uploadImageMiddleware || ((req, res, next) => {
    console.error('[Upload] Middleware not available');
    res.status(500).json({ success: false, message: 'Upload middleware not configured' });
}), async (req, res) => {
    try {
        await supplierController.uploadImage(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/upload-video', supplierController.uploadVideoMiddleware || ((req, res, next) => {
    console.error('[Upload] Middleware not available');
    res.status(500).json({ success: false, message: 'Upload middleware not configured' });
}), async (req, res) => {
    try {
        await supplierController.uploadCampaignVideo(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Orders
router.get('/orders', async (req, res) => {
    try {
        await supplierController.getOrders(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        await supplierController.getOrderById(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/orders/:id/status', async (req, res) => {
    try {
        await supplierController.updateOrderStatus(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Payments
router.get('/payments', async (req, res) => {
    try {
        await supplierController.getPayments(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/payouts', async (req, res) => {
    try {
        await supplierController.requestPayout(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/payouts', async (req, res) => {
    try {
        await supplierController.getPayouts(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Promotions
router.get('/promotions', async (req, res) => {
    try {
        await supplierController.getPromotions(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/promotions', async (req, res) => {
    try {
        await supplierController.createPromotion(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/promotions/:id', async (req, res) => {
    try {
        await supplierController.updatePromotion(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/promotions/:id', async (req, res) => {
    try {
        await supplierController.deletePromotion(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Paramètres publicité (lecture seule pour le fournisseur)
router.get('/ad-settings', async (req, res) => {
    try {
        await supplierController.getAdSettings(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Campaigns
router.get('/campaigns', async (req, res) => {
    try {
        await supplierController.getCampaigns(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/campaigns', async (req, res) => {
    try {
        await supplierController.createCampaign(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/campaigns/:id', async (req, res) => {
    try {
        await supplierController.updateCampaign(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/campaigns/:id', async (req, res) => {
    try {
        await supplierController.deleteCampaign(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/campaigns/:id/status', async (req, res) => {
    try {
        await supplierController.toggleCampaignStatus(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

console.log('[Supplier Routes] ✅ All routes registered successfully');

module.exports = router;