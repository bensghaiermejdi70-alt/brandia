// ============================================
// AUTH MIDDLEWARE - Vérification JWT
// ============================================

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const authMiddleware = (req, res, next) => {
    try {
        // Récupérer le token du header Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token manquant ou invalide'
            });
        }

        const token = authHeader.split(' ')[1];

        // Vérifier le token
        const decoded = jwt.verify(token, env.JWT.SECRET);
        
        // Ajouter les infos utilisateur à la requête
        req.user = decoded;

        next();

    } catch (error) {
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

module.exports = authMiddleware;