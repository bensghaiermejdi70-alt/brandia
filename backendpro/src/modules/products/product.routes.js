// ============================================
// PRODUCT ROUTES - v3.3 CORRIGÉ (100% PUBLIQUE pour GET)
// ============================================

const express = require('express');
const router = express.Router();

const { authenticate, requireRole } = require('../../middlewares/auth.middleware');
const productController = require('./product.controller');

console.log('[Product Routes] Loading v3.3...');
console.log('[Product Routes] Controller methods:', Object.keys(productController));

// ============================================
// WRAPPER pour gestion async des erreurs
// ============================================
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// ROUTES PUBLIQUES (SANS AUTHENTIFICATION)
// ============================================

// Liste tous les produits
router.get('/', asyncHandler(async (req, res) => {
    console.log('[Product Routes] GET /', req.query);
    await productController.getAll(req, res);
}));

// Produits en vedette
router.get('/featured', asyncHandler(async (req, res) => {
    console.log('[Product Routes] GET /featured');
    await productController.getFeatured(req, res);
}));

// Avec promotions - 🔥 CORRIGÉ avec meilleur logging
router.get('/with-promotions', asyncHandler(async (req, res) => {
    console.log('[Product Routes] GET /with-promotions', req.query);
    await productController.getAllWithPromotions(req, res);
}));

router.get('/featured-with-promotions', asyncHandler(async (req, res) => {
    console.log('[Product Routes] GET /featured-with-promotions');
    await productController.getFeaturedWithPromotions(req, res);
}));

// 🔥 ROUTES /:id - DANS LE BON ORDRE !

// D'abord la route spécifique /:id/with-promotion
router.get('/:id/with-promotion', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    console.log('[Product Routes] GET /:id/with-promotion', id);
    
    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID produit invalide'
        });
    }
    await productController.getByIdWithPromotion(req, res);
}));

// Ensuite la route générique /:id (DOIT ÊTRE DERNIER)
router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    console.log('[Product Routes] GET /:id', id);
    
    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID produit invalide'
        });
    }
    await productController.getById(req, res);
}));

// ============================================
// ROUTES PROTÉGÉES (AVEC AUTHENTIFICATION)
// ============================================

// Créer (supplier uniquement)
router.post('/', 
    authenticate,
    requireRole('supplier'),
    asyncHandler(async (req, res) => {
        console.log('[Product Routes] POST /');
        await productController.create(req, res);
    })
);

// Modifier (supplier uniquement)
router.put('/:id',
    authenticate,
    requireRole('supplier'),
    asyncHandler(async (req, res) => {
        console.log('[Product Routes] PUT /:id', req.params.id);
        await productController.update(req, res);
    })
);

// Supprimer (supplier uniquement)
router.delete('/:id',
    authenticate,
    requireRole('supplier'),
    asyncHandler(async (req, res) => {
        console.log('[Product Routes] DELETE /:id', req.params.id);
        await productController.delete(req, res);
    })
);

console.log('[Product Routes] ✅ Loaded successfully');

module.exports = router;