// ============================================
// PRODUCT MODEL - Requêtes SQL Produits
// ============================================

const { query } = require('../../config/db');
const logger = require('../../utils/logger');

const ProductModel = {
   findAll: async (options = {}) => {
    try {
        const { category, search, limit = 20, offset = 0 } = options;
        
        // ✅ REQUÊTE SIMPLIFIÉE avec seulement les colonnes qui existent sûrement
        let sql = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.price,
                p.stock_quantity,
                p.main_image_url,
                p.image,
                p.supplier_id,
                p.is_active,
                p.created_at,
                u.first_name as supplier_name,
                s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
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

        paramCount++;
        sql += ` ORDER BY p.created_at DESC LIMIT $${paramCount}`;
        params.push(parseInt(limit) || 20);

        if (offset > 0) {
            paramCount++;
            sql += ` OFFSET $${paramCount}`;
            params.push(parseInt(offset));
        }

        console.log('[ProductModel] SQL:', sql.replace(/\s+/g, ' ').trim());
        
        const result = await query(sql, params);
        console.log(`[ProductModel] ${result.rows.length} produits trouvés`);
        
        return result.rows;

    } catch (error) {
        console.error('❌ [ProductModel] Erreur findAll:', error.message);
        throw error;
    }
},

    // Produits en vedette - VERSION SIMPLIFIÉE
    findFeatured: async (limit = 8) => {
        try {
            // ✅ SANS colonnes qui n'existent peut-être pas
            const sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.price,
                    p.main_image_url,
                    p.image,
                    p.supplier_id,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
                ORDER BY p.created_at DESC
                LIMIT $1
            `;
            
            console.log('[ProductModel] findFeatured - limit:', limit);
            
            const result = await query(sql, [parseInt(limit)]);
            console.log(`[ProductModel] ${result.rows.length} produits en vedette`);
            
            return result.rows;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findFeatured:', error.message);
            throw error;
        }
    },

    // Détail par ID - VERSION SIMPLIFIÉE
    findById: async (id) => {
        try {
            const sql = `
                SELECT 
                    p.*,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.id = $1 
                AND (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const result = await query(sql, [id]);
            return result.rows[0] || null;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findById:', error.message);
            throw error;
        }
    },

    // Détail par slug - VERSION SIMPLIFIÉE
    findBySlug: async (slug) => {
        try {
            // Si slug n'existe pas en DB, chercher par id ou name
            const sql = `
                SELECT 
                    p.*,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE (p.slug = $1 OR p.id::text = $1 OR p.name ILIKE $1)
                AND (p.is_active = true OR p.is_active IS NULL)
                LIMIT 1
            `;
            
            const result = await query(sql, [slug]);
            return result.rows[0] || null;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findBySlug:', error.message);
            throw error;
        }
    },

    // Créer un produit - VERSION SIMPLIFIÉE
    create: async (productData) => {
        try {
            const { supplier_id, name, description, price, stock_quantity, main_image_url } = productData;
            
            const sql = `
                INSERT INTO products 
                (supplier_id, name, description, price, stock_quantity, main_image_url, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
                RETURNING *
            `;
            
            const result = await query(sql, [supplier_id, name, description, price, stock_quantity, main_image_url]);
            console.log(`✅ [ProductModel] Produit créé: ${name}`);
            return result.rows[0];

        } catch (error) {
            console.error('❌ [ProductModel] Erreur create:', error.message);
            throw error;
        }
    },
    
    // Mettre à jour - VERSION SIMPLIFIÉE
    update: async (id, updates) => {
        try {
            const allowedFields = ['name', 'description', 'price', 'stock_quantity', 'main_image_url', 'is_active'];
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
            
            if (setClause.length === 0) return null;

            const sql = `UPDATE products SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`;
            values.push(id);

            const result = await query(sql, values);
            return result.rows[0];

        } catch (error) {
            console.error('❌ [ProductModel] Erreur update:', error.message);
            throw error;
        }
    },
    
    // Supprimer
    delete: async (id) => {
        try {
            const result = await query('DELETE FROM products WHERE id = $1 RETURNING id, name', [id]);
            return result.rows[0];
        } catch (error) {
            console.error('❌ [ProductModel] Erreur delete:', error.message);
            throw error;
        }
    }
};

module.exports = ProductModel;