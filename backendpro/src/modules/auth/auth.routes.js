// ============================================
// AUTH ROUTES - Endpoints Register/Login
// ============================================

const express = require('express');
const router = express.Router();
const AuthController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// Protected routes (nécessite un token JWT valide)
router.get('/me', authMiddleware, AuthController.me);

module.exports = router;