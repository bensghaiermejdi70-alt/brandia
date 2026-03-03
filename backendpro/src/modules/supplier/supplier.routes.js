// ============================================
// SUPPLIER.ROUTES.JS - v8.0 PRODUCTION
// Routes publiques (Ad Engine) + protégées (Dashboard)
// ============================================

const express = require('express');
const router = express.Router();

const supplierController = require('./supplier.controller');

// ============================================
// AUTH MIDDLEWARE LOCAL
// ============================================

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'Token manquant' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token invalide' });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'brandia-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }
};

// ============================================
// 🔥 ROUTES PUBLIQUES (Ad Engine - PAS D'AUTH)
// ============================================

// Récupérer toutes les campagnes actives (pour round-robin)
router.get('/public/campaigns', supplierController.getPublicCampaigns);

// Vérifier campagne active pour un produit spécifique
router.get('/public/campaigns/active', supplierController.getActiveCampaignForProduct);

// Tracking des vues (appelé après 3s de visionnage)
router.post('/public/campaigns/view', supplierController.trackCampaignView);

// Tracking des clics
router.post('/public/campaigns/click', supplierController.trackCampaignClick);

// Paramètres publics d'un fournisseur
router.get('/public/ad-settings', supplierController.getPublicAdSettings);

// ============================================
// 🔥 ROUTES PROTÉGÉES (Dashboard Fournisseur)
// ============================================

// Toutes les routes suivantes nécessitent authentification
router.use(authenticate);

// --- STATS ---
router.get('/stats', supplierController.getStats);

// --- PRODUCTS ---
router.get('/products', supplierController.getProducts);
router.post('/products', supplierController.createProduct);
router.put('/products/:id', supplierController.updateProduct);
router.delete('/products/:id', supplierController.deleteProduct);

// --- ORDERS ---
router.get('/orders', supplierController.getOrders);
router.get('/orders/:id', supplierController.getOrderById);
router.put('/orders/:id/status', supplierController.updateOrderStatus);

// --- CAMPAIGNS (CRUD) ---
router.get('/campaigns', supplierController.getCampaigns);
router.get('/campaigns/limit', supplierController.getCampaignLimit);
router.post('/campaigns', supplierController.createCampaign);
router.put('/campaigns/:id', supplierController.updateCampaign);
router.delete('/campaigns/:id', supplierController.deleteCampaign);
router.patch('/campaigns/:id/status', supplierController.toggleCampaignStatus);

// --- UPLOAD ---
router.post('/upload/image', supplierController.uploadImageMiddleware, supplierController.uploadImage);
router.post('/upload/video', supplierController.uploadVideoMiddleware, supplierController.uploadVideo);

// --- PAYMENTS ---
router.get('/payments', supplierController.getPayments);
router.get('/payments/payouts', supplierController.getPayouts);
router.post('/payments/payouts', supplierController.requestPayout);

// --- PROMOTIONS ---
router.get('/promotions', supplierController.getPromotions);
router.post('/promotions', supplierController.createPromotion);
router.put('/promotions/:id', supplierController.updatePromotion);
router.delete('/promotions/:id', supplierController.deletePromotion);

// --- SETTINGS ---
router.get('/ad-settings', supplierController.getAdSettings);

module.exports = router;