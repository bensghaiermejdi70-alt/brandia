// ============================================
// PRODUCT ROUTES - API Produits (AVEC PROMOTIONS)
// ============================================

const express = require('express');
const router = express.Router();
const ProductController = require('./product.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// ==========================================
// ROUTES PUBLIQUES (sans auth)
// ==========================================

// Liste classique (compatibilité)
router.get('/', ProductController.list);

// ==========================================
// NOUVEAU: Routes avec promotions intégrées
// ==========================================
router.get('/with-promotions', ProductController.listWithPromotions);
router.get('/featured-with-promotions', ProductController.featuredWithPromotions);
router.get('/:id/with-promotion', ProductController.detailWithPromotion);

// Produits en vedette (classique)
router.get('/featured', ProductController.featured);

// Détail par ID (classique)
router.get('/:id', ProductController.detail);

// Détail par slug
router.get('/slug/:slug', ProductController.detailBySlug);

// ==========================================
// ROUTES PROTÉGÉES (fournisseurs)
// ==========================================
router.use(authMiddleware);

// Créer un produit (fournisseur uniquement)
router.post('/', ProductController.create);

// Mettre à jour un produit
router.put('/:id', ProductController.update);

// Supprimer un produit
router.delete('/:id', ProductController.delete);

module.exports = router;