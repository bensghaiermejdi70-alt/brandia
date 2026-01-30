const { query } = require('../../config/db');

const ProductModel = {
    findAll: async (options = {}) => {
        const { category, search, limit = 20, offset = 0 } = options;
        let sql = 'SELECT * FROM products WHERE is_active = true';
        const params = [];
        
        if (category) {
            sql += ' AND category_slug = $1';
            params.push(category);
        }
        
        if (search) {
            sql += ` AND (name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }
        
        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await query(sql, params);
        return result.rows;
    },
    
    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [id]);
        return result.rows[0];
    },
    
    findFeatured: async (limit = 8) => {
        const result = await query('SELECT * FROM products WHERE is_featured = true AND is_active = true LIMIT $1', [limit]);
        return result.rows;
    }
};

module.exports = ProductModel;