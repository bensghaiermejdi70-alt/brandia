// ============================================
// PRODUCT ROUTES - v3.1 CORRIGÉ ET COMPLET
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import du middleware (UNIQUEMENT pour routes protégées)
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// 🔥 Import du contrôleur
const productController = require('./product.controller');

// Debug - vérifier le contrôleur
console.log('[Product Routes] Controller loaded:', typeof productController);
console.log('[Product Routes] Available methods:', Object.keys(productController || {}));

// ============================================
// ROUTES PUBLIQUES (SANS AUTHENTIFICATION)
// ============================================

/**
 * GET /api/products
 * Liste tous les produits avec filtres
 */
router.get('/', async (req, res, next) => {
    try {
        await productController.getAll(req, res);
    } catch (error) {
        console.error('[Product Routes] Error in GET /:', error);
        next(error);
    }
});

/**
 * GET /api/products/featured
 * Produits en vedette
 */
router.get('/featured', async (req, res, next) => {
    try {
        await productController.getFeatured(req, res);
    } catch (error) {
        console.error('[Product Routes] Error in GET /featured:', error);
        next(error);
    }
});

/**
 * GET /api/products/with-promotions
 * Tous les produits avec promotions
 */
router.get('/with-promotions', async (req, res, next) => {
    try {
        await productController.getAllWithPromotions(req, res);
    } catch (error) {
        console.error('[Product Routes] Error in GET /with-promotions:', error);
        next(error);
    }
});

/**
 * GET /api/products/featured-with-promotions
 * Produits vedette avec promotions
 */
router.get('/featured-with-promotions', async (req, res, next) => {
    try {
        await productController.getFeaturedWithPromotions(req, res);
    } catch (error) {
        console.error('[Product Routes] Error in GET /featured-with-promotions:', error);
        next(error);
    }
});

// ============================================
// 🔥 ROUTES DYNAMIQUES /:id (DOIVENT ÊTRE APRÈS LES ROUTES SPÉCIFIQUES)
// ============================================

/**
 * GET /api/products/:id/with-promotion
 * Détail produit avec promotion active
 */
router.get('/:id/with-promotion', async (req, res, next) => {
    try {
        // Validation ID
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID produit invalide'
            });
        }
        
        await productController.getByIdWithPromotion(req, res);
    } catch (error) {
        console.error('[Product Routes] Error in GET /:id/with-promotion:', error);
        next(error);
    }
});

/**
 * GET /api/products/:id
 * Détail d'un produit (DOIT ÊTRE DERNIER parmi les GET /:id/*)
 */
router.get('/:id', async (req, res, next) => {
    try {
        // Validation ID
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID produit invalide'
            });
        }
        
        console.log('[Product Routes] Public access to product:', id);
        await productController.getById(req, res);
    } catch (error) {
        console.error('[Product Routes] Error in GET /:id:', error);
        next(error);
    }
});

// ============================================
// ROUTES PROTÉGÉES (AVEC AUTHENTIFICATION)
// ============================================

/**
 * POST /api/products
 * Créer un produit (supplier uniquement)
 */
router.post('/', 
    authenticate,
    requireRole('supplier'),
    async (req, res, next) => {
        try {
            await productController.create(req, res);
        } catch (error) {
            console.error('[Product Routes] Error in POST /:', error);
            next(error);
        }
    }
);

/**
 * PUT /api/products/:id
 * Modifier un produit (supplier uniquement)
 */
router.put('/:id',
    authenticate,
    requireRole('supplier'),
    async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID produit invalide'
                });
            }
            
            await productController.update(req, res);
        } catch (error) {
            console.error('[Product Routes] Error in PUT /:id:', error);
            next(error);
        }
    }
);

/**
 * DELETE /api/products/:id
 * Supprimer un produit (supplier uniquement)
 */
router.delete('/:id',
    authenticate,
    requireRole('supplier'),
    async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID produit invalide'
                });
            }
            
            await productController.delete(req, res);
        } catch (error) {
            console.error('[Product Routes] Error in DELETE /:id:', error);
            next(error);
        }
    }
);

module.exports = router;