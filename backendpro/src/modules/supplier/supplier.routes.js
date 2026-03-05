// ============================================
// SUPPLIER.ROUTES.JS - v8.2 PRODUCTION
// Fix: JWT token structure validation, flexible ID field
// ============================================

const express = require('express');
const router = express.Router();

const supplierController = require('./supplier.controller');

// ============================================
// AUTH MIDDLEWARE - VERSION ROBUSTE
// ============================================

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('[Auth] ❌ No authorization header');
      return res.status(401).json({ 
        success: false, 
        message: 'Token manquant',
        code: 'NO_TOKEN'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('[Auth] ❌ Invalid authorization format:', authHeader.substring(0, 30));
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
    
    console.log('[Auth] Token decoded:', JSON.stringify(decoded, null, 2));
    
    // 🔥 CORRECTION: Accepter plusieurs formats de token
    // Certains tokens ont 'id', d'autres ont 'userId', d'autres ont '_id'
    const userId = decoded.id || decoded.userId || decoded._id || decoded.sub;
    
    if (!userId) {
      console.error('[Auth] ❌ No ID found in token. Available fields:', Object.keys(decoded));
      return res.status(401).json({
        success: false,
        message: 'Token invalide: ID manquant',
        code: 'INVALID_TOKEN',
        debug: isDev ? { availableFields: Object.keys(decoded) } : undefined
      });
    }
    
    // Normaliser le token pour les contrôleurs
    req.user = {
      id: userId,
      email: decoded.email,
      role: decoded.role,
      // Garder les champs originaux aussi
      ...decoded
    };
    
    console.log('[Auth] ✅ Authenticated user:', userId, 'Role:', decoded.role);
    
    next();
    
  } catch (error) {
    console.error('[Auth] ❌ Token verification failed:', error.message);
    
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

const isDev = process.env.NODE_ENV === 'development';

// ============================================
// 🔥 ROUTES PUBLIQUES (Ad Engine - PAS D'AUTH)
// ============================================

router.get('/public/campaigns', supplierController.getPublicCampaigns);
router.get('/public/campaigns/active', supplierController.getActiveCampaignForProduct);
router.post('/public/campaigns/view', supplierController.trackCampaignView);
router.post('/public/campaigns/click', supplierController.trackCampaignClick);
router.get('/public/ad-settings', supplierController.getPublicAdSettings);

console.log('[Supplier Routes] ✅ Public routes registered');

// ============================================
// 🔥 ROUTES PROTÉGÉES (Dashboard Fournisseur)
// ============================================

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

// --- CAMPAIGNS ---
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