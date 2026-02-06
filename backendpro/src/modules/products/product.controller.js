// ============================================
// PRODUCT CONTROLLER - Logique CRUD Produits (AVEC PROMOTIONS)
// ============================================

const ProductModel = require('./product.model');
const logger = require('../../utils/logger');

// Générer un slug à partir du nom
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + '-' + Date.now();
};

const ProductController = {
    // Liste des produits (public) - VERSION CLASSIQUE (sans promo pour compatibilité)
    list: async (req, res) => {
        try {
            const { category, search, limit, offset } = req.query;
            
            console.log('[CONTROLLER] Query params reçus:', req.query);
            console.log('[CONTROLLER] Category reçue:', category);

            const products = await ProductModel.findAll({
                category,
                search,
                limit: parseInt(limit) || 20,
                offset: parseInt(offset) || 0
            });

            console.log('[CONTROLLER] Nombre produits retournés:', products.length);

            res.json({
                success: true,
                count: products.length,
                data: { products }
            });

        } catch (error) {
            logger.error('❌ Erreur liste produits:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // ==========================================
    // NOUVEAU: Liste avec promotions intégrées
    // ==========================================
    listWithPromotions: async (req, res) => {
        try {
            const { category, search, limit, offset } = req.query;
            
            console.log('[CONTROLLER] listWithPromotions - params:', req.query);

            const products = await ProductModel.findAllWithPromotions({
                category,
                search,
                limit: parseInt(limit) || 20,
                offset: parseInt(offset) || 0
            });

            // Calculer stats des promotions
            const promoCount = products.filter(p => p.has_promotion).length;
            
            console.log(`[CONTROLLER] ${products.length} produits, ${promoCount} en promotion`);

            res.json({
                success: true,
                count: products.length,
                promo_count: promoCount,
                data: { products }
            });

        } catch (error) {
            logger.error('❌ Erreur liste produits avec promotions:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Détail d'un produit (public) - VERSION CLASSIQUE
    detail: async (req, res) => {
        try {
            const { id } = req.params;
            
            const product = await ProductModel.findById(id);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            res.json({
                success: true,
                data: { product }
            });

        } catch (error) {
            logger.error('❌ Erreur détail produit:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // ==========================================
    // NOUVEAU: Détail avec promotion
    // ==========================================
    detailWithPromotion: async (req, res) => {
        try {
            const { id } = req.params;
            
            const product = await ProductModel.findByIdWithPromotion(id);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            res.json({
                success: true,
                data: { product }
            });

        } catch (error) {
            logger.error('❌ Erreur détail produit avec promotion:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Détail par slug (public)
    detailBySlug: async (req, res) => {
        try {
            const { slug } = req.params;
            
            const product = await ProductModel.findBySlug(slug);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            res.json({
                success: true,
                data: { product }
            });

        } catch (error) {
            logger.error('❌ Erreur détail produit:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Créer un produit (fournisseur uniquement)
    create: async (req, res) => {
        try {
            if (req.user.role !== 'supplier') {
                return res.status(403).json({
                    success: false,
                    message: 'Accès réservé aux fournisseurs'
                });
            }

            const {
                name, description, short_description, price,
                compare_price, stock_quantity, category_id,
                main_image_url, category_slug, available_countries
            } = req.body;

            if (!name || !price || !category_slug) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom, prix et catégorie sont requis'
                });
            }

            const supplier_id = req.user.id;
            const slug = generateSlug(name);

            const product = await ProductModel.create({
                supplier_id,
                name,
                slug,
                description,
                short_description,
                price,
                compare_price,
                stock_quantity: stock_quantity || 0,
                category_id,
                main_image_url,
                category_slug,
                available_countries: available_countries ? JSON.stringify(available_countries) : null
            });

            logger.info(`✅ Produit créé: ${name} par fournisseur ${supplier_id}`);

            res.status(201).json({
                success: true,
                message: 'Produit créé avec succès',
                data: { product }
            });

        } catch (error) {
            logger.error('❌ Erreur création produit:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Mettre à jour un produit (fournisseur uniquement)
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const existing = await ProductModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            if (existing.supplier_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous ne pouvez modifier que vos propres produits'
                });
            }

            const product = await ProductModel.update(id, updates);

            logger.info(`✅ Produit mis à jour: ${id}`);

            res.json({
                success: true,
                message: 'Produit mis à jour',
                data: { product }
            });

        } catch (error) {
            logger.error('❌ Erreur mise à jour produit:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Supprimer un produit (fournisseur uniquement)
    delete: async (req, res) => {
        try {
            const { id } = req.params;

            const existing = await ProductModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            if (existing.supplier_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous ne pouvez supprimer que vos propres produits'
                });
            }

            await ProductModel.delete(id);

            logger.info(`✅ Produit supprimé: ${id}`);

            res.json({
                success: true,
                message: 'Produit supprimé'
            });

        } catch (error) {
            logger.error('❌ Erreur suppression produit:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // Produits en vedette (public) - VERSION CLASSIQUE
    featured: async (req, res) => {
        try {
            const { limit } = req.query;
            
            const products = await ProductModel.findFeatured(parseInt(limit) || 8);

            res.json({
                success: true,
                count: products.length,
                data: { products }
            });

        } catch (error) {
            logger.error('❌ Erreur produits en vedette:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    },

    // ==========================================
    // NOUVEAU: Produits en vedette avec promotions
    // ==========================================
    featuredWithPromotions: async (req, res) => {
        try {
            const { limit } = req.query;
            
            const products = await ProductModel.findFeaturedWithPromotions(parseInt(limit) || 8);
            
            const promoCount = products.filter(p => p.has_promotion).length;

            res.json({
                success: true,
                count: products.length,
                promo_count: promoCount,
                data: { products }
            });

        } catch (error) {
            logger.error('❌ Erreur produits en vedette avec promotions:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }
};

module.exports = ProductController;