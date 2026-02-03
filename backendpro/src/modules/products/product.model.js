// ============================================
// PRODUCT MODEL - Requêtes SQL Produits
// ============================================

const { pool } = require('../../config/db');
const logger = require('../../utils/logger');

const ProductModel = {
    // Liste tous les produits (avec filtres)
    findAll: async (options = {}) => {
        try {
            const { category, search, limit = 20, offset = 0 } = options;
            
            // ✅ COLONNES EXPLICITES pour éviter l'erreur "column does not exist"
            let sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.description,
                    p.short_description,
                    p.price,
                    p.compare_price,
                    p.stock_quantity,
                    p.main_image_url,
                    p.image,
                    p.category_id,
                    p.category_slug,
                    p.supplier_id,
                    p.is_active,
                    p.is_featured,
                    p.available_countries,
                    p.created_at,
                    p.updated_at,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const params = [];
            let paramCount = 0;

            // Filtre par catégorie (slug ou ID)
            if (category) {
                paramCount++;
                const catId = parseInt(category);
                if (!isNaN(catId)) {
                    sql += ` AND p.category_id = $${paramCount}`;
                } else {
                    sql += ` AND p.category_slug = $${paramCount}`;
                }
                params.push(category);
                console.log(`[DB] Filtre category ajouté: ${category}`);
            }

            // Filtre recherche
            if (search) {
                paramCount++;
                sql += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            // Pagination
            paramCount++;
            sql += ` ORDER BY p.is_featured DESC, p.created_at DESC LIMIT $${paramCount}`;
            params.push(limit);

            // Offset si fourni
            if (offset > 0) {
                paramCount++;
                sql += ` OFFSET $${paramCount}`;
                params.push(offset);
            }

            console.log('[DB] SQL final:', sql);
            console.log('[DB] Params:', params);

            // ✅ Utilisation de pool.query au lieu de query
            const result = await pool.query(sql, params);
            console.log(`[DB] ${result.rows.length} produits trouvés`);
            
            return result.rows;

        } catch (error) {
            logger.error('❌ Erreur SQL findAll:', error);
            throw error;
        }
    },

    // Détail d'un produit par ID
    findById: async (id) => {
        try {
            const sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.description,
                    p.short_description,
                    p.price,
                    p.compare_price,
                    p.stock_quantity,
                    p.main_image_url,
                    p.image,
                    p.category_id,
                    p.category_slug,
                    p.supplier_id,
                    p.is_active,
                    p.is_featured,
                    p.available_countries,
                    p.created_at,
                    p.updated_at,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company,
                    s.description as supplier_description,
                    s.logo_url as supplier_logo
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.id = $1 AND (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const result = await pool.query(sql, [id]);
            return result.rows[0] || null;

        } catch (error) {
            logger.error('❌ Erreur SQL findById:', error);
            throw error;
        }
    },

    // Détail par slug
    findBySlug: async (slug) => {
        try {
            const sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.description,
                    p.short_description,
                    p.price,
                    p.compare_price,
                    p.stock_quantity,
                    p.main_image_url,
                    p.image,
                    p.category_id,
                    p.category_slug,
                    p.supplier_id,
                    p.is_active,
                    p.is_featured,
                    p.available_countries,
                    p.created_at,
                    p.updated_at,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company,
                    s.description as supplier_description,
                    s.logo_url as supplier_logo,
                    s.id as supplier_id_ref
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.slug = $1 AND (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const result = await pool.query(sql, [slug]);
            return result.rows[0] || null;

        } catch (error) {
            logger.error('❌ Erreur SQL findBySlug:', error);
            throw error;
        }
    },

    // Produits en vedette
    findFeatured: async (limit = 8) => {
        try {
            const sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.price,
                    p.main_image_url,
                    p.image,
                    p.category_slug,
                    p.is_featured,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.is_featured = true AND (p.is_active = true OR p.is_active IS NULL)
                ORDER BY p.created_at DESC
                LIMIT $1
            `;
            
            const result = await pool.query(sql, [limit]);
            return result.rows;

        } catch (error) {
            logger.error('❌ Erreur SQL findFeatured:', error);
            throw error;
        }
    },

    // ✅ CRÉER UN PRODUIT (manquant dans ton fichier)
    create: async (productData) => {
        try {
            const {
                supplier_id,
                name,
                slug,
                description,
                short_description,
                price,
                compare_price,
                stock_quantity,
                category_id,
                category_slug,
                main_image_url,
                image,
                is_active = true,
                is_featured = false,
                available_countries
            } = productData;

            // Validation minimale
            if (!name || price === undefined) {
                throw new Error('Nom et prix sont requis');
            }

            const sql = `
                INSERT INTO products (
                    supplier_id,
                    name,
                    slug,
                    description,
                    short_description,
                    price,
                    compare_price,
                    stock_quantity,
                    category_id,
                    category_slug,
                    main_image_url,
                    image,
                    is_active,
                    is_featured,
                    available_countries,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
                RETURNING *
            `;

            const values = [
                supplier_id,
                name,
                slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
                description,
                short_description,
                price,
                compare_price || null,
                stock_quantity || 0,
                category_id,
                category_slug,
                main_image_url,
                image,
                is_active,
                is_featured,
                available_countries ? JSON.stringify(available_countries) : null
            ];

            const result = await pool.query(sql, values);
            logger.info(`✅ Produit créé: ${name} (ID: ${result.rows[0].id})`);
            
            return result.rows[0];

        } catch (error) {
            logger.error('❌ Erreur SQL create:', error);
            throw error;
        }
    },

    // ✅ METTRE À JOUR UN PRODUIT (manquant)
    update: async (id, updates) => {
        try {
            const allowedFields = [
                'name', 'description', 'short_description', 'price',
                'compare_price', 'stock_quantity', 'category_id', 'category_slug',
                'main_image_url', 'image', 'is_active', 'is_featured'
            ];

            const setClause = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('Aucun champ valide à mettre à jour');
            }

            // Ajouter updated_at
            setClause.push(`updated_at = NOW()`);

            const sql = `
                UPDATE products 
                SET ${setClause.join(', ')}
                WHERE id = $${paramCount}
                RETURNING *
            `;

            values.push(id);

            const result = await pool.query(sql, values);
            
            if (result.rows.length === 0) {
                throw new Error('Produit non trouvé');
            }

            logger.info(`✅ Produit mis à jour: ID ${id}`);
            return result.rows[0];

        } catch (error) {
            logger.error('❌ Erreur SQL update:', error);
            throw error;
        }
    },

    // ✅ SUPPRIMER UN PRODUIT (manquant)
    delete: async (id) => {
        try {
            const sql = `
                DELETE FROM products 
                WHERE id = $1 
                RETURNING id, name
            `;
            
            const result = await pool.query(sql, [id]);
            
            if (result.rows.length === 0) {
                throw new Error('Produit non trouvé');
            }

            logger.info(`✅ Produit supprimé: ${result.rows[0].name} (ID: ${id})`);
            return result.rows[0];

        } catch (error) {
            logger.error('❌ Erreur SQL delete:', error);
            throw error;
        }
    },

    // ✅ RECHERCHE DE PRODUITS (manquant)
    search: async (searchQuery, limit = 20) => {
        try {
            const sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.price,
                    p.main_image_url,
                    p.image,
                    p.category_slug,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE (p.name ILIKE $1 OR p.description ILIKE $1)
                AND (p.is_active = true OR p.is_active IS NULL)
                ORDER BY p.is_featured DESC, p.created_at DESC
                LIMIT $2
            `;
            
            const result = await pool.query(sql, [`%${searchQuery}%`, limit]);
            return result.rows;

        } catch (error) {
            logger.error('❌ Erreur SQL search:', error);
            throw error;
        }
    },

    // Compte le nombre total de produits (pour pagination)
    count: async (options = {}) => {
        try {
            const { category, search } = options;
            
            let sql = `
                SELECT COUNT(*) as total
                FROM products p
                WHERE (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const params = [];
            let paramCount = 0;

            if (category) {
                paramCount++;
                sql += ` AND p.category_slug = $${paramCount}`;
                params.push(category);
            }

            if (search) {
                paramCount++;
                sql += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            const result = await pool.query(sql, params);
            return parseInt(result.rows[0].total);

        } catch (error) {
            logger.error('❌ Erreur SQL count:', error);
            throw error;
        }
    }
};

module.exports = ProductModel;