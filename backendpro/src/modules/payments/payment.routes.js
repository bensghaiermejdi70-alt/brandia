// ============================================
// PAYMENT ROUTES - Endpoints Stripe Connect
// ============================================

const express = require('express');
const router = express.Router();
const PaymentController = require('./payment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Routes protégées (fournisseurs uniquement)
router.post('/connect/account', authMiddleware, PaymentController.createConnectAccount);
router.post('/connect/onboarding', authMiddleware, PaymentController.createOnboardingLink);

// Routes pour les paiements (clients)
router.post('/create-intent', authMiddleware, PaymentController.createPaymentIntent);
router.get('/status/:paymentIntentId', authMiddleware, PaymentController.getPaymentStatus);

// Webhook Stripe (public, pas d'auth - Stripe signe la requête)
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.webhook);

module.exports = router;