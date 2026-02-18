// ============================================
// AUTH CONTROLLER - v2.4 CORRIGÉ
// ============================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const AuthModel = require('./auth.model');
const logger = require('../../utils/logger');
const db = require('../../config/db');

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

            if (!email || !password || !first_name || !last_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Tous les champs sont requis'
                });
            }

            const existingUser = await AuthModel.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Cet email est déjà utilisé'
                });
            }

            const password_hash = await bcrypt.hash(password, 10);

            const user = await AuthModel.createUser({
                email: email.toLowerCase(),
                password_hash,
                first_name,
                last_name,
                country_code: country_code || 'FR',
                role
            });

            if (role === 'supplier') {
                try {
                    await db.query(
                        `INSERT INTO suppliers (user_id, company_name, created_at, updated_at)
                         VALUES ($1, $2, NOW(), NOW())`,
                        [user.id, first_name || 'Ma Société']
                    );
                } catch (supplierError) {
                    logger.warn('⚠️ Impossible de créer le profil supplier:', supplierError.message);
                }
            }

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
                message: 'Erreur serveur: ' + error.message
            });
        }
    },

    // ==========================================
    // CONNEXION
    // ==========================================
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email et mot de passe requis'
                });
            }

            const user = await AuthModel.findByEmail(email.toLowerCase());
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            if (user.is_active === false) {
                return res.status(401).json({
                    success: false,
                    message: 'Compte désactivé'
                });
            }

            let supplierInfo = { supplier_id: null, supplier_company: null };
            try {
                const supplierResult = await db.query(
                    `SELECT id as supplier_id, company_name as supplier_company 
                     FROM suppliers 
                     WHERE user_id = $1 
                     LIMIT 1`,
                    [user.id]
                );
                if (supplierResult.rows.length > 0) {
                    supplierInfo = supplierResult.rows[0];
                }
            } catch (supplierErr) {
                logger.warn('⚠️ Erreur récupération supplier:', supplierErr.message);
            }

            try {
                await db.query(
                    'UPDATE users SET last_login = NOW() WHERE id = $1',
                    [user.id]
                );
            } catch (updateErr) {
                logger.warn('⚠️ Impossible de mettre à jour last_login:', updateErr.message);
            }

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
                        supplier_id: supplierInfo.supplier_id,
                        supplier_company: supplierInfo.supplier_company
                    },
                    ...tokens
                }
            });

        } catch (error) {
            logger.error('❌ Erreur connexion:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur: ' + error.message
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

            const decoded = jwt.verify(refreshToken, env.JWT.REFRESH_SECRET);
            
            const user = await AuthModel.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

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

    refreshToken: async (req, res) => {
        return AuthController.refresh(req, res);
    },

    // ==========================================
    // PROFIL UTILISATEUR
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
                message: 'Erreur serveur: ' + error.message
            });
        }
    },

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

module.exports = AuthController;