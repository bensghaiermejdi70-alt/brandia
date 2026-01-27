// ============================================
// PRODUCT ROUTES - Endpoints CRUD Produits
// ============================================

const express = require('express');
const router = express.Router();
const ProductController = require('./product.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Routes publiques (pas besoin d'authentification)
router.get('/', ProductController.list);
router.get('/featured', ProductController.featured);
router.get('/slug/:slug', ProductController.detailBySlug);
router.get('/:id', ProductController.detail);

// Routes protégées (fournisseurs uniquement)
router.post('/', authMiddleware, ProductController.create);
router.put('/:id', authMiddleware, ProductController.update);
router.delete('/:id', authMiddleware, ProductController.delete);

module.exports = router;