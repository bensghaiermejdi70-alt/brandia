// ============================================
// AUTH CONTROLLER - v2.2 CORRIGÉ (Export compatible)
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
        expiresIn: env.JWT.ACCESS_EXPIRES_IN || '7d'
    });

    const refreshToken = jwt.sign(payload, env.JWT.REFRESH_SECRET, {
        expiresIn: env.JWT.REFRESH_EXPIRES_IN || '30d'
    });

    return { accessToken, refreshToken };
};

const AuthController = {
    // ==========================================
    // INSCRIPTION
    // ==========================================
    register: async (req, res) => {
        try {
            const { email, password, first_name, last_name, country_code, role = 'client' } = req.body;

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
                email: email.toLowerCase(),
                password_hash,
                first_name,
                last_name,
                country_code: country_code || 'FR',
                role
            });

            // Si c'est un fournisseur, créer le profil supplier
            if (role === 'supplier') {
                const db = require('../../config/db');
                await db.query(
                    `INSERT INTO suppliers (user_id, company_name, created_at, updated_at)
                     VALUES ($1, $2, NOW(), NOW())`,
                    [user.id, first_name || 'Ma Société']
                );
            }

            // Générer les tokens
            const tokens = generateTokens(user);

            logger.info(`✅ Nouvel utilisateur inscrit: ${email} (role: ${role})`);

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

    // ==========================================
    // CONNEXION
    // ==========================================
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

            // Trouver l'utilisateur avec infos supplier
            const db = require('../../config/db');
            const result = await db.query(
                `SELECT u.*, s.id as supplier_id, s.company_name as supplier_company
                 FROM users u
                 LEFT JOIN suppliers s ON s.user_id = u.id
                 WHERE u.email = $1 AND u.is_active = true
                 LIMIT 1`,
                [email.toLowerCase()]
            );

            const user = result.rows[0];

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

            // Mettre à jour last_login
            await db.query(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [user.id]
            );

            // Générer les tokens
            const tokens = generateTokens(user);

            logger.info(`✅ Connexion réussie: ${email} (role: ${user.role})`);

            res.json({
                success: true,
                message: 'Connexion réussie',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: user.role,
                        supplier_id: user.supplier_id || null,
                        supplier_company: user.supplier_company || null
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

    // ==========================================
    // RAFRAÎCHIR TOKEN
    // ==========================================
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

            // Générer de nouveaux tokens
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

    // Alias pour compatibilité
    refreshToken: async (req, res) => {
        return AuthController.refresh(req, res);
    },

    // ==========================================
    // PROFIL UTILISATEUR (getMe / me)
    // ==========================================
    getMe: async (req, res) => {
        try {
            const userId = req.user?.userId || req.user?.id;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID utilisateur manquant'
                });
            }

            const db = require('../../config/db');
            const result = await db.query(
                `SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
                        u.country_code, u.created_at, u.last_login,
                        s.id as supplier_id, s.company_name as supplier_company, 
                        s.logo_url as supplier_logo
                 FROM users u
                 LEFT JOIN suppliers s ON s.user_id = u.id
                 WHERE u.id = $1 AND u.is_active = true
                 LIMIT 1`,
                [userId]
            );

            const user = result.rows[0];
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            res.json({
                success: true,
                data: { 
                    user: {
                        id: user.id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: user.role,
                        country_code: user.country_code,
                        created_at: user.created_at,
                        last_login: user.last_login,
                        supplier_id: user.supplier_id || null,
                        supplier_company: user.supplier_company || null,
                        supplier_logo: user.supplier_logo || null
                    }
                }
            });

        } catch (error) {
            logger.error('❌ Erreur profil:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Alias pour compatibilité
    me: async (req, res) => {
        return AuthController.getMe(req, res);
    },

    // ==========================================
    // DÉCONNEXION
    // ==========================================
    logout: async (req, res) => {
        try {
            const userId = req.user?.userId || req.user?.id;
            logger.info(`✅ Déconnexion: ${userId}`);
            
            res.json({
                success: true,
                message: 'Déconnexion réussie'
            });

        } catch (error) {
            logger.error('❌ Erreur déconnexion:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }
};

// 🔥 EXPORT EXPLICITE - L'objet complet avec toutes les méthodes
module.exports = AuthController;