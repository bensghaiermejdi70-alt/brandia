// ============================================
// PRODUCT ROUTES - Routes produits
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 Import du middleware
const { authenticate } = require('../../middlewares/auth.middleware');

// 🔥 Import du contrôleur
const productController = require('./product.controller');

// Debug - vérifier ce qui est importé
console.log('[Product Routes] Controller loaded:', typeof productController);
console.log('[Product Routes] Controller methods:', Object.keys(productController || {}));

// Vérification que le contrôleur est bien défini
if (!productController || typeof productController !== 'object') {
    throw new Error('Product controller is not properly loaded');
}

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================

// Liste tous les produits
router.get('/', productController.getAll || productController.list || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

// Produits en vedette
router.get('/featured', productController.getFeatured || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

// Produits avec promotions
router.get('/with-promotions', productController.getAllWithPromotions || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

router.get('/featured-with-promotions', productController.getFeaturedWithPromotions || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

// Détail d'un produit
router.get('/:id', productController.getById || productController.getOne || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

router.get('/:id/with-promotion', productController.getByIdWithPromotion || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

// ============================================
// ROUTES PROTÉGÉES (avec auth)
// ============================================

// Créer un produit (fournisseur uniquement)
router.post('/', authenticate, productController.create || productController.createProduct || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

// Modifier un produit
router.put('/:id', authenticate, productController.update || productController.updateProduct || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

// Supprimer un produit
router.delete('/:id', authenticate, productController.remove || productController.delete || productController.deleteProduct || ((req, res) => {
    res.status(500).json({ success: false, message: 'Controller method not implemented' });
}));

module.exports = router;