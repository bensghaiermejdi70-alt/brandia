const { query } = require('../../config/db');

const ProductModel = {
    findAll: async (options = {}) => {
        const { category, search, limit = 20, offset = 0 } = options;
        let sql = 'SELECT * FROM products WHERE is_active = true';
        const params = [];
        
        if (category) {
            params.push(category);
            sql += ` AND category_slug = $${params.length}`;
        }
        
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
        }
        
        // Ajout LIMIT et OFFSET avec bons indices
        params.push(limit, offset);
        sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
        
        const result = await query(sql, params);
        return result.rows;
    },
    
    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [id]);
        return result.rows[0];
    },
    
    findFeatured: async (limit = 8) => {
        const result = await query('SELECT * FROM products WHERE is_featured = true AND is_active = true ORDER BY created_at DESC LIMIT $1', [limit]);
        return result.rows;
    }
};

module.exports = ProductModel;