// ============================================
// SUPPLIER ROUTES - v5.4 CORRIGÉ
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../../config/db');

console.log('[Supplier Routes] Loading v5.4...');

// Import du controller
let supplierController;
try {
    supplierController = require('./supplier.controller');
    console.log('[Supplier Routes] Controller loaded');
} catch (err) {
    console.error('[Supplier Routes] FAILED to load controller:', err.message);
    module.exports = router;
    return;
}

// Import middlewares
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// ============================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================
router.get('/public/campaigns', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// ============================================
// ROUTE PUBLIQUE AD SETTINGS - À AJOUTER DANS supplier.routes.js
// ============================================

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

        // 🔥 Vérifier que db est disponible
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
        // En cas d'erreur, retourner les valeurs par défaut (ne pas bloquer l'affichage)
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
// MIDDLEWARES D'AUTHENTIFICATION
// ============================================
router.use(authenticate);
router.use(requireRole('supplier'));

// ============================================
// ROUTES PROTÉGÉES FOURNISSEUR
// ============================================

// Stats
router.get('/stats', supplierController.getStats);

// Products
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// 🔥 Uploads - Les middlewares sont maintenant des fonctions valides
router.post('/upload-image', supplierController.uploadImageMiddleware, supplierController.uploadImage);
router.post('/upload-video', supplierController.uploadVideoMiddleware, supplierController.uploadCampaignVideo);

// Orders
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// Payments
router.get('/payments', supplierController.getPayments);
router.post('/payouts', supplierController.requestPayout);
router.get('/payouts', supplierController.getPayouts);

// Promotions
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);
router.put('/promotions/:id', supplierController.updatePromotion);
router.delete('/promotions/:id', supplierController.deletePromotion);

// Paramètres publicité (lecture seule pour le fournisseur)
router.get('/ad-settings', supplierController.getAdSettings);

// Campaigns
router.get('/campaigns', supplierController.getCampaigns);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);
router.put('/campaigns/:id/status', supplierController.toggleCampaignStatus);

console.log('[Supplier Routes] All routes registered successfully');

module.exports = router;