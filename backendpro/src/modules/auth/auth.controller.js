// ============================================
// AUTH CONTROLLER - Logique Register/Login
// ============================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const AuthModel = require('./auth.model');
const logger = require('../../utils/logger');

// Générer les tokens JWT
const generateTokens = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role
    };

    const accessToken = jwt.sign(payload, env.JWT.SECRET, {
        expiresIn: env.JWT.ACCESS_EXPIRES_IN
    });

    const refreshToken = jwt.sign(payload, env.JWT.REFRESH_SECRET, {
        expiresIn: env.JWT.REFRESH_EXPIRES_IN
    });

    return { accessToken, refreshToken };
};

const AuthController = {
    // Inscription
    register: async (req, res) => {
        try {
            const { email, password, first_name, last_name, country_code } = req.body;

            // Validation
            if (!email || !password || !first_name || !last_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Tous les champs sont requis'
                });
            }

            // Vérifier si l'email existe déjà
            const existingUser = await AuthModel.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Cet email est déjà utilisé'
                });
            }

            // Hasher le mot de passe
            const password_hash = await bcrypt.hash(password, 10);

            // Créer l'utilisateur
            const user = await AuthModel.createUser({
                email,
                password_hash,
                first_name,
                last_name,
                country_code: country_code || 'FR'
            });

            // Générer les tokens
            const tokens = generateTokens(user);

            logger.info(`✅ Nouvel utilisateur inscrit: ${email}`);

            res.status(201).json({
                success: true,
                message: 'Inscription réussie',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: user.role
                    },
                    ...tokens
                }
            });

        } catch (error) {
            logger.error('❌ Erreur inscription:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Connexion
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email et mot de passe requis'
                });
            }

            // Trouver l'utilisateur
            const user = await AuthModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            // Vérifier le mot de passe
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            // Générer les tokens
            const tokens = generateTokens(user);

            logger.info(`✅ Connexion réussie: ${email}`);

            res.json({
                success: true,
                message: 'Connexion réussie',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: user.role
                    },
                    ...tokens
                }
            });

        } catch (error) {
            logger.error('❌ Erreur connexion:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Rafraîchir le token
    refresh: async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token manquant'
                });
            }

            // Vérifier le refresh token
            const decoded = jwt.verify(refreshToken, env.JWT.REFRESH_SECRET);
            
            // Vérifier que l'utilisateur existe toujours
            const user = await AuthModel.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            // Générer un nouveau access token
            const tokens = generateTokens(user);

            res.json({
                success: true,
                data: tokens
            });

        } catch (error) {
            logger.error('❌ Erreur refresh token:', error);
            res.status(401).json({
                success: false,
                message: 'Refresh token invalide'
            });
        }
    },

    // Profil utilisateur connecté
    me: async (req, res) => {
        try {
            const user = await AuthModel.findById(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            res.json({
                success: true,
                data: { user }
            });

        } catch (error) {
            logger.error('❌ Erreur profil:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }
};

module.exports = AuthController;