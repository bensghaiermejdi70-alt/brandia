// ============================================
// PRODUCT ROUTES - Routes produits
// ============================================

const express = require('express');
const router = express.Router();

// 🔥 CORRECTION : Import du middleware avec la nouvelle structure
const { authenticate } = require('../../middlewares/auth.middleware');
const productController = require('./product.controller');

// ============================================
// ROUTES PUBLIQUES (sans auth)
// ============================================

// Liste tous les produits
router.get('/', productController.getAll);

// Produits en vedette
router.get('/featured', productController.getFeatured);

// Produits avec promotions
router.get('/with-promotions', productController.getAllWithPromotions);
router.get('/featured-with-promotions', productController.getFeaturedWithPromotions);

// Détail d'un produit
router.get('/:id', productController.getById);
router.get('/:id/with-promotion', productController.getByIdWithPromotion);

// ============================================
// ROUTES PROTÉGÉES (avec auth)
// ============================================

// Créer un produit (fournisseur uniquement)
router.post('/', authenticate, productController.create);

// Modifier un produit
router.put('/:id', authenticate, productController.update);

// Supprimer un produit
router.delete('/:id', authenticate, productController.remove);

module.exports = router;