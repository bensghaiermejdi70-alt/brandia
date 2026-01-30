// backendpro/src/modules/products/product.model.js
const { query } = require('../../config/db');

const ProductModel = {
    // Liste tous les produits (accepte NULL pour is_active)
    findAll: async (options = {}) => {
        const { category, search, limit = 20, offset = 0 } = options;
        let sql = 'SELECT * FROM products WHERE is_active = true OR is_active IS NULL';
        const params = [];
        
        if (category) {
            params.push(category);
            sql += ` AND category_slug = $${params.length}`;
        }
        
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
        }
        
        params.push(limit, offset);
        sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
        
        const result = await query(sql, params);
        return result.rows;
    },
    
    // Détail par ID
    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1 AND (is_active = true OR is_active IS NULL)', [id]);
        return result.rows[0];
    },
    
    // Détail par slug
    findBySlug: async (slug) => {
        const result = await query('SELECT * FROM products WHERE slug = $1 AND (is_active = true OR is_active IS NULL)', [slug]);
        return result.rows[0];
    },
    
    // Produits en vedette
    findFeatured: async (limit = 8) => {
        const result = await query('SELECT * FROM products WHERE is_featured = true AND (is_active = true OR is_active IS NULL) ORDER BY created_at DESC LIMIT $1', [limit]);
        return result.rows;
    }
};

module.exports = ProductModel;