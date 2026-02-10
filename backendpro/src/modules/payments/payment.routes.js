// ============================================
// PAYMENT ROUTES - Routes paiements Stripe
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import du middleware
const { authenticate } = require('../../middlewares/auth.middleware');

// 🔥 Import du contrôleur
const paymentController = require('./payment.controller');

// Debug
console.log('[Payment Routes] Controller loaded:', typeof paymentController);
console.log('[Payment Routes] Controller methods:', Object.keys(paymentController || {}));

// ============================================
// ROUTES PUBLIQUES (webhook Stripe)
// ============================================

// Webhook Stripe (doit être public, pas d'authentification)
router.post('/webhook', express.raw({ type: 'application/json' }), 
    paymentController.webhook || ((req, res) => {
        res.status(500).json({ success: false, message: 'Webhook not implemented' });
    })
);

// ============================================
// ROUTES PROTÉGÉES (avec auth)
// ============================================

// Créer un compte Connect pour le fournisseur
router.post('/connect/account', authenticate, 
    paymentController.createConnectAccount || ((req, res) => {
        res.status(500).json({ success: false, message: 'Not implemented' });
    })
);

// Lien onboarding Stripe Connect
router.post('/connect/onboarding', authenticate, 
    paymentController.getOnboardingLink || ((req, res) => {
        res.status(500).json({ success: false, message: 'Not implemented' });
    })
);

// Créer un PaymentIntent
router.post('/create-intent', authenticate, 
    paymentController.createPaymentIntent || ((req, res) => {
        res.status(500).json({ success: false, message: 'Not implemented' });
    })
);

// Statut d'un paiement
router.get('/status/:id', authenticate, 
    paymentController.getPaymentStatus || ((req, res) => {
        res.status(500).json({ success: false, message: 'Not implemented' });
    })
);

// Confirmer un paiement
router.post('/confirm', authenticate, 
    paymentController.confirmPayment || ((req, res) => {
        res.status(500).json({ success: false, message: 'Not implemented' });
    })
);

module.exports = router;