// ============================================
// PRODUCT ROUTES - v3.2 CORRIGÉ (100% PUBLIQUE pour GET)
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import du middleware UNIQUEMENT pour routes protégées
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

// 🔥 Import du contrôleur
const productController = require('./product.controller');

console.log('[Product Routes] Loading v3.2...');
console.log('[Product Routes] Controller methods:', Object.keys(productController));

// ============================================
// ROUTES PUBLIQUES (SANS AUTHENTIFICATION)
// ============================================

// Liste tous les produits
router.get('/', async (req, res, next) => {
    try {
        await productController.getAll(req, res);
    } catch (error) {
        next(error);
    }
});

// Produits en vedette
router.get('/featured', async (req, res, next) => {
    try {
        await productController.getFeatured(req, res);
    } catch (error) {
        next(error);
    }
});

// Avec promotions
router.get('/with-promotions', async (req, res, next) => {
    try {
        await productController.getAllWithPromotions(req, res);
    } catch (error) {
        next(error);
    }
});

router.get('/featured-with-promotions', async (req, res, next) => {
    try {
        await productController.getFeaturedWithPromotions(req, res);
    } catch (error) {
        next(error);
    }
});

// 🔥🔥🔥 ROUTES /:id - DANS LE BON ORDRE ! 🔥🔥🔥

// D'abord la route spécifique /:id/with-promotion
router.get('/:id/with-promotion', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID produit invalide'
            });
        }
        await productController.getByIdWithPromotion(req, res);
    } catch (error) {
        next(error);
    }
});

// Ensuite la route générique /:id (DOIT ÊTRE DERNIER)
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID produit invalide'
            });
        }
        console.log('[Product Routes] GET /:id - Public access to product:', id);
        await productController.getById(req, res);
    } catch (error) {
        next(error);
    }
});

// ============================================
// ROUTES PROTÉGÉES (AVEC AUTHENTIFICATION)
// ============================================

// Créer (supplier uniquement)
router.post('/', 
    authenticate,
    requireRole('supplier'),
    async (req, res, next) => {
        try {
            await productController.create(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Modifier (supplier uniquement)
router.put('/:id',
    authenticate,
    requireRole('supplier'),
    async (req, res, next) => {
        try {
            await productController.update(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Supprimer (supplier uniquement)
router.delete('/:id',
    authenticate,
    requireRole('supplier'),
    async (req, res, next) => {
        try {
            await productController.delete(req, res);
        } catch (error) {
            next(error);
        }
    }
);

console.log('[Product Routes] ✅ Loaded successfully');

module.exports = router;