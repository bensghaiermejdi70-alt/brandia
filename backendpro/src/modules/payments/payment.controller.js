// ============================================
// PAYMENT CONTROLLER - Stripe Connect
// ============================================

const stripe = require('../../config/stripe');
const logger = require('../../utils/logger');

const PaymentController = {
    // Créer un compte Stripe Connect pour un fournisseur
    createConnectAccount: async (req, res) => {
        try {
            const { email, country = 'FR' } = req.body;

            const account = await stripe.accounts.create({
                type: 'express',
                country: country,
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                business_type: 'individual',
                settings: {
                    payouts: {
                        schedule: { interval: 'manual' }
                    }
                }
            });

            logger.info(`✅ Compte Stripe Connect créé: ${account.id}`);

            res.json({
                success: true,
                data: { accountId: account.id, type: 'express' }
            });

        } catch (error) {
            logger.error('❌ Erreur création compte Stripe:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Générer un lien d'onboarding pour le fournisseur
    createOnboardingLink: async (req, res) => {
        try {
            const { accountId } = req.body;

            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: `${process.env.FRONTEND_URL}/supplier/onboarding/refresh`,
                return_url: `${process.env.FRONTEND_URL}/supplier/onboarding/success`,
                type: 'account_onboarding'
            });

            res.json({ success: true, data: { url: accountLink.url } });

        } catch (error) {
            logger.error('❌ Erreur lien onboarding:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Créer un paiement (avec ou sans split selon le compte fournisseur)
    createPaymentIntent: async (req, res) => {
        try {
            const { 
                amount, 
                currency = 'eur', 
                supplierAccountId, 
                platformFeePercent = 15,
                customerEmail,
                metadata = {}
            } = req.body;

            const platformFee = Math.round(amount * platformFeePercent / 100);
            const supplierAmount = amount - platformFee;

            let paymentIntentData = {
                amount: amount * 100,
                currency: currency,
                automatic_payment_methods: { enabled: true },
                receipt_email: customerEmail,
                metadata: {
                    ...metadata,
                    platform: 'brandia',
                    platform_fee: platformFee,
                    supplier_amount: supplierAmount
                }
            };

            // Si supplierAccountId fourni ET valide, on fait le split
            if (supplierAccountId) {
                try {
                    // Vérifier si le compte peut recevoir des transferts
                    const account = await stripe.accounts.retrieve(supplierAccountId);
                    
                    if (account.capabilities?.transfers === 'active') {
                        // Split paiement activé
                        paymentIntentData.transfer_data = {
                            destination: supplierAccountId,
                            amount: supplierAmount * 100
                        };
                        paymentIntentData.application_fee_amount = platformFee * 100;
                        
                        logger.info(`✅ Split paiement activé pour ${supplierAccountId}`);
                    } else {
                        logger.warn(`⚠️ Compte ${supplierAccountId} pas encore prêt pour les transferts`);
                    }
                } catch (err) {
                    logger.warn(`⚠️ Compte ${supplierAccountId} invalide ou non vérifié: ${err.message}`);
                }
            }

            const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

            logger.info(`✅ PaymentIntent créé: ${paymentIntent.id} | Montant: ${amount}€ | Commission: ${platformFee}€`);

            res.json({
                success: true,
                data: {
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id,
                    amount: amount,
                    platformFee: platformFee,
                    supplierAmount: supplierAmount,
                    splitEnabled: !!paymentIntentData.transfer_data
                }
            });

        } catch (error) {
            logger.error('❌ Erreur création paiement:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Vérifier le statut d'un paiement
    getPaymentStatus: async (req, res) => {
        try {
            const { paymentIntentId } = req.params;
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            res.json({
                success: true,
                data: {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount / 100,
                    currency: paymentIntent.currency,
                    created: new Date(paymentIntent.created * 1000)
                }
            });

        } catch (error) {
            logger.error('❌ Erreur récupération statut:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Webhook Stripe
    webhook: async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            logger.error(`❌ Webhook invalide: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'payment_intent.succeeded':
                logger.info(`✅ Paiement réussi: ${event.data.object.id}`);
                break;
            case 'payment_intent.payment_failed':
                logger.error(`❌ Paiement échoué: ${event.data.object.id}`);
                break;
            case 'account.updated':
                logger.info(`📝 Compte mis à jour: ${event.data.object.id}`);
                break;
            default:
                logger.info(`ℹ️ Événement: ${event.type}`);
        }

        res.json({ received: true });
    }
};

module.exports = PaymentController;