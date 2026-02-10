// ============================================
// PAYMENT CONTROLLER - Stripe Connect
// ============================================

const stripe = require('../../config/stripe');
const db = require('../../config/db');
const logger = require('../../utils/logger');

const PaymentController = {
    
    // 🔥 Webhook Stripe (public)
    webhook: async (req, res) => {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            logger.error(`Webhook Error: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Gérer les événements
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                logger.info(`PaymentIntent was successful! ${paymentIntent.id}`);
                // Mettre à jour la commande comme payée
                break;
            
            case 'account.updated':
                const account = event.data.object;
                logger.info(`Connect account updated: ${account.id}`);
                break;
            
            default:
                logger.info(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    },

    // 🔥 Créer un compte Connect pour le fournisseur
    createConnectAccount: async (req, res) => {
        try {
            const userId = req.user.userId;

            // Vérifier si le fournisseur a déjà un compte
            const supplierResult = await db.query(
                'SELECT stripe_account_id FROM suppliers WHERE user_id = $1',
                [userId]
            );

            if (supplierResult.rows[0]?.stripe_account_id) {
                return res.json({
                    success: true,
                    message: 'Compte déjà existant',
                    account_id: supplierResult.rows[0].stripe_account_id
                });
            }

            // Créer le compte Connect Express
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'FR',
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                }
            });

            // Sauvegarder l'ID du compte
            await db.query(
                'UPDATE suppliers SET stripe_account_id = $1, stripe_account_status = $2 WHERE user_id = $3',
                [account.id, 'pending', userId]
            );

            res.json({
                success: true,
                account_id: account.id
            });

        } catch (error) {
            logger.error('[Payment] Create Connect account error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 🔥 Lien onboarding Stripe Connect
    getOnboardingLink: async (req, res) => {
        try {
            const userId = req.user.userId;

            const supplierResult = await db.query(
                'SELECT stripe_account_id FROM suppliers WHERE user_id = $1',
                [userId]
            );

            if (!supplierResult.rows[0]?.stripe_account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Compte Connect non créé'
                });
            }

            const accountLink = await stripe.accountLinks.create({
                account: supplierResult.rows[0].stripe_account_id,
                refresh_url: `${process.env.FRONTEND_URL}/supplier/dashboard?stripe=refresh`,
                return_url: `${process.env.FRONTEND_URL}/supplier/dashboard?stripe=success`,
                type: 'account_onboarding'
            });

            res.json({
                success: true,
                url: accountLink.url
            });

        } catch (error) {
            logger.error('[Payment] Onboarding link error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 🔥 Créer un PaymentIntent
    createPaymentIntent: async (req, res) => {
        try {
            const { amount, currency = 'eur', order_id } = req.body;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convertir en centimes
                currency: currency,
                automatic_payment_methods: { enabled: true },
                metadata: {
                    order_id: order_id?.toString(),
                    user_id: req.user.userId.toString()
                }
            });

            res.json({
                success: true,
                client_secret: paymentIntent.client_secret,
                payment_intent_id: paymentIntent.id
            });

        } catch (error) {
            logger.error('[Payment] Create intent error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 🔥 Statut d'un paiement
    getPaymentStatus: async (req, res) => {
        try {
            const { id } = req.params;

            const paymentIntent = await stripe.paymentIntents.retrieve(id);

            res.json({
                success: true,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency
            });

        } catch (error) {
            logger.error('[Payment] Get status error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 🔥 Confirmer un paiement (webhook ou manuel)
    confirmPayment: async (req, res) => {
        try {
            const { payment_intent_id, order_id } = req.body;

            // Mettre à jour la commande comme payée
            await db.query(
                "UPDATE orders SET status = 'paid', payment_status = 'paid', paid_at = NOW() WHERE id = $1",
                [order_id]
            );

            res.json({
                success: true,
                message: 'Paiement confirmé'
            });

        } catch (error) {
            logger.error('[Payment] Confirm error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = PaymentController;