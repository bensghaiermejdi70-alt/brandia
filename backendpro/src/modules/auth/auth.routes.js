// ============================================
// AUTH ROUTES - v2.2 CORRIGÉ (Appels méthodes corrects)
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import du contrôleur (objet avec méthodes)
const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

console.log('[Auth Routes] Loading v2.2...');
console.log('[Auth Routes] Controller type:', typeof authController);
console.log('[Auth Routes] Available methods:', Object.keys(authController));

// ============================================
// ROUTES PUBLIQUES (pas d'authentification)
// ============================================

// Inscription
// 🔥 CORRECTION : authController.register (pas juste authController)
router.post('/register', async (req, res, next) => {
    try {
        console.log('[Auth Routes] POST /register');
        await authController.register(req, res);
    } catch (error) {
        next(error);
    }
});

// Connexion
// 🔥 CORRECTION : authController.login
router.post('/login', async (req, res, next) => {
    try {
        console.log('[Auth Routes] POST /login');
        await authController.login(req, res);
    } catch (error) {
        next(error);
    }
});

// Rafraîchir token
// 🔥 CORRECTION : authController.refresh
router.post('/refresh', async (req, res, next) => {
    try {
        console.log('[Auth Routes] POST /refresh');
        await authController.refresh(req, res);
    } catch (error) {
        next(error);
    }
});

// Google OAuth (placeholder)
router.post('/google', async (req, res) => {
    console.log('[Auth Routes] POST /google - Not implemented');
    res.status(501).json({ 
        success: false, 
        message: 'Google OAuth not implemented yet' 
    });
});

// ============================================
// ROUTES PROTÉGÉES (avec authentification)
// ============================================

// Profil utilisateur connecté
// 🔥 CORRECTION : authController.getMe (méthode spécifique)
router.get('/me', authenticate, async (req, res, next) => {
    try {
        console.log('[Auth Routes] GET /me - User:', req.user?.userId);
        await authController.getMe(req, res);
    } catch (error) {
        next(error);
    }
});

// Déconnexion
// 🔥 CORRECTION : authController.logout
router.post('/logout', authenticate, async (req, res, next) => {
    try {
        console.log('[Auth Routes] POST /logout - User:', req.user?.userId);
        await authController.logout(req, res);
    } catch (error) {
        next(error);
    }
});

console.log('[Auth Routes] ✅ All routes registered successfully');

module.exports = router;