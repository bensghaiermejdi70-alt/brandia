// ============================================
// PRODUCT MODEL - Requêtes SQL Produits
// ============================================

// ✅ CORRECTION CRITIQUE : Utiliser pool.query
const { pool } = require('../../config/db');
const logger = require('../../utils/logger');

const ProductModel = {
    // Liste tous les produits (avec filtres)
    findAll: async (options = {}) => {
        try {
            const { category, search, limit = 20, offset = 0 } = options;
            
            // ✅ COLONNES EXPLICITES pour éviter les erreurs SQL
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

            // Filtre par catégorie
            if (category) {
                paramCount++;
                const catId = parseInt(category);
                if (!isNaN(catId)) {
                    sql += ` AND p.category_id = $${paramCount}`;
                } else {
                    sql += ` AND p.category_slug = $${paramCount}`;
                }
                params.push(category);
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
            params.push(parseInt(limit) || 20);

            if (offset > 0) {
                paramCount++;
                sql += ` OFFSET $${paramCount}`;
                params.push(parseInt(offset));
            }

            console.log('[ProductModel] SQL:', sql.replace(/\s+/g, ' ').trim());
            console.log('[ProductModel] Params:', params);

            // ✅ UTILISATION CORRECTE : pool.query
            const result = await pool.query(sql, params);
            console.log(`[ProductModel] ${result.rows.length} produits trouvés`);
            
            return result.rows;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findAll:', error.message);
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
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.is_featured = true 
                AND (p.is_active = true OR p.is_active IS NULL)
                ORDER BY p.created_at DESC
                LIMIT $1
            `;
            
            console.log('[ProductModel] findFeatured - limit:', limit);
            
            // ✅ pool.query
            const result = await pool.query(sql, [parseInt(limit)]);
            console.log(`[ProductModel] ${result.rows.length} produits en vedette trouvés`);
            
            return result.rows;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findFeatured:', error.message);
            throw error;
        }
    },

    // Détail par ID
    findById: async (id) => {
        try {
            const sql = `
                SELECT 
                    p.*,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company,
                    s.description as supplier_description
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.id = $1 
                AND (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const result = await pool.query(sql, [id]);
            return result.rows[0] || null;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findById:', error.message);
            throw error;
        }
    },

    // Détail par slug
    findBySlug: async (slug) => {
        try {
            const sql = `
                SELECT 
                    p.*,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.slug = $1 
                AND (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const result = await pool.query(sql, [slug]);
            return result.rows[0] || null;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findBySlug:', error.message);
            throw error;
        }
    },

    // Créer un produit
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
                is_active = true,
                is_featured = false,
                available_countries
            } = productData;

            const sql = `
                INSERT INTO products (
                    supplier_id, name, slug, description, short_description,
                    price, compare_price, stock_quantity, category_id, category_slug,
                    main_image_url, is_active, is_featured, available_countries,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
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
                is_active,
                is_featured,
                available_countries ? JSON.stringify(available_countries) : null
            ];

            const result = await pool.query(sql, values);
            console.log(`✅ [ProductModel] Produit créé: ${name}`);
            
            return result.rows[0];

        } catch (error) {
            console.error('❌ [ProductModel] Erreur create:', error.message);
            throw error;
        }
    },

    // Mettre à jour
    update: async (id, updates) => {
        try {
            const allowedFields = [
                'name', 'description', 'short_description', 'price',
                'compare_price', 'stock_quantity', 'category_id', 'category_slug',
                'main_image_url', 'is_active', 'is_featured'
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

            setClause.push(`updated_at = NOW()`);

            const sql = `
                UPDATE products 
                SET ${setClause.join(', ')}
                WHERE id = $${paramCount}
                RETURNING *
            `;

            values.push(id);

            const result = await pool.query(sql, values);
            return result.rows[0];

        } catch (error) {
            console.error('❌ [ProductModel] Erreur update:', error.message);
            throw error;
        }
    },

    // Supprimer
    delete: async (id) => {
        try {
            const sql = `DELETE FROM products WHERE id = $1 RETURNING id, name`;
            const result = await pool.query(sql, [id]);
            return result.rows[0];

        } catch (error) {
            console.error('❌ [ProductModel] Erreur delete:', error.message);
            throw error;
        }
    }
};

module.exports = ProductModel;