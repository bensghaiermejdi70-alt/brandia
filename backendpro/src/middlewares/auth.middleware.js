// ============================================
// AUTH MIDDLEWARE - Vérification JWT
// ============================================

const jwt = require('jsonwebtoken');

// Récupération variables env (fallback si env.js plante)
const JWT_SECRET = process.env.JWT_SECRET || require('../config/env').env?.JWT?.SECRET;

if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET non défini !');
}

// 🔥 Middleware principal d'authentification
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        console.log('[Auth] Header reçu:', authHeader ? 'Bearer ***' : 'Aucun');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token manquant ou invalide'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Configuration serveur invalide (JWT)'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log('[Auth] Token valide pour user:', decoded.userId, 'Role:', decoded.role);
        
        // ✅ CORRECTION CRITIQUE : Ajouter alias id pour compatibilité
        req.user = {
            ...decoded,
            id: decoded.userId  // Alias pour que req.user.id fonctionne partout
        };
        
        next();

    } catch (error) {
        console.error('[Auth] Erreur:', error.name);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expiré'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: 'Token invalide'
        });
    }
};

// 🔥 Middleware de vérification de rôle
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié'
            });
        }
        
        // Admin peut tout faire
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Vérifier le rôle spécifique
        if (req.user.role !== role) {
            return res.status(403).json({
                success: false,
                message: `Accès réservé aux ${role}s`
            });
        }
        
        next();
    };
};

// 🔥 Export des deux fonctions (compatibilité avec supplier.routes.js)
module.exports = {
    authenticate,
    requireRole
};