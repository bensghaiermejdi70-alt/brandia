// ============================================
// PRODUCT CONTROLLER - Logique CRUD Produits
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
    // Liste des produits (public)
    list: async (req, res) => {
        try {
            const { category, search, limit, offset } = req.query;
            
            const products = await ProductModel.findAll({
                category,
                search,
                limit: parseInt(limit) || 20,
                offset: parseInt(offset) || 0
            });

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

    // Détail d'un produit (public)
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
            // Vérifier que l'utilisateur est un fournisseur
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

            // Validation
            if (!name || !price || !category_slug) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom, prix et catégorie sont requis'
                });
            }

            // TODO: Récupérer le supplier_id depuis le profil du fournisseur connecté
            // Pour l'instant, on utilise une valeur fixe pour le test
            const supplier_id = req.user.supplierId || 1;

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

            // Vérifier que le produit existe
            const existing = await ProductModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            // Vérifier que le fournisseur est propriétaire du produit
            // TODO: Vérifier supplier_id vs req.user.supplierId

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

            // Vérifier que le produit existe
            const existing = await ProductModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            // Vérifier que le fournisseur est propriétaire
            // TODO: Vérifier supplier_id vs req.user.supplierId

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

    // Produits en vedette (public)
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
    }
};

module.exports = ProductController;