// ============================================
// SUPPLIER.ROUTES.JS - v8.1 PRODUCTION
// Fix: Auth middleware placement, public routes first, better error handling
// ============================================

const express = require('express');
const router = express.Router();

const supplierController = require('./supplier.controller');

// ============================================
// AUTH MIDDLEWARE LOCAL - ROBUSTE
// ============================================

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('[Auth] No authorization header');
      return res.status(401).json({ 
        success: false, 
        message: 'Token manquant',
        code: 'NO_TOKEN'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('[Auth] Invalid authorization format:', authHeader.substring(0, 20));
      return res.status(401).json({ 
        success: false, 
        message: 'Format de token invalide (Bearer requis)',
        code: 'INVALID_FORMAT'
      });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token vide',
        code: 'EMPTY_TOKEN'
      });
    }

    // Vérifier la présence de JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET || 'brandia-secret-key';
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, jwtSecret);
    
    // Vérifier que c'est bien un fournisseur
    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide: ID manquant',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Stocker les infos utilisateur pour les contrôleurs
    req.user = decoded;
    console.log('[Auth] ✅ Authenticated user:', decoded.id, 'Role:', decoded.role);
    
    next();
    
  } catch (error) {
    console.error('[Auth] Token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
};

// ============================================
// 🔥 ROUTES PUBLIQUES (Ad Engine - PAS D'AUTH)
// ============================================

// Ces routes sont accessibles sans authentification pour l'affichage des publicités

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

console.log('[Supplier Routes] ✅ Public routes registered');

// ============================================
// 🔥 ROUTES PROTÉGÉES (Dashboard Fournisseur)
// ============================================

// Toutes les routes suivantes nécessitent authentification
// Le middleware authenticate est appliqué à toutes les routes suivantes

// --- STATS ---
router.get('/stats', authenticate, supplierController.getStats);

// --- PRODUCTS ---
router.get('/products', authenticate, supplierController.getProducts);
router.post('/products', authenticate, supplierController.createProduct);
router.put('/products/:id', authenticate, supplierController.updateProduct);
router.delete('/products/:id', authenticate, supplierController.deleteProduct);

// --- ORDERS ---
router.get('/orders', authenticate, supplierController.getOrders);
router.get('/orders/:id', authenticate, supplierController.getOrderById);
router.put('/orders/:id/status', authenticate, supplierController.updateOrderStatus);

// --- CAMPAIGNS (CRUD) ---
router.get('/campaigns', authenticate, supplierController.getCampaigns);
router.get('/campaigns/limit', authenticate, supplierController.getCampaignLimit);
router.post('/campaigns', authenticate, supplierController.createCampaign);
router.put('/campaigns/:id', authenticate, supplierController.updateCampaign);
router.delete('/campaigns/:id', authenticate, supplierController.deleteCampaign);
router.patch('/campaigns/:id/status', authenticate, supplierController.toggleCampaignStatus);

// --- UPLOAD ---
router.post('/upload/image', authenticate, supplierController.uploadImageMiddleware, supplierController.uploadImage);
router.post('/upload/video', authenticate, supplierController.uploadVideoMiddleware, supplierController.uploadVideo);

// --- PAYMENTS ---
router.get('/payments', authenticate, supplierController.getPayments);
router.get('/payments/payouts', authenticate, supplierController.getPayouts);
router.post('/payments/payouts', authenticate, supplierController.requestPayout);

// --- PROMOTIONS ---
router.get('/promotions', authenticate, supplierController.getPromotions);
router.post('/promotions', authenticate, supplierController.createPromotion);
router.put('/promotions/:id', authenticate, supplierController.updatePromotion);
router.delete('/promotions/:id', authenticate, supplierController.deletePromotion);

// --- SETTINGS ---
router.get('/ad-settings', authenticate, supplierController.getAdSettings);

console.log('[Supplier Routes] ✅ Protected routes registered');

module.exports = router;