const { query } = require('../../config/db');

const ProductModel = {
    findAll: async () => {
        const result = await query('SELECT * FROM products WHERE is_active = true LIMIT 10');
        return result.rows;
    },
    findFeatured: async () => {
        const result = await query('SELECT * FROM products WHERE is_featured = true AND is_active = true LIMIT 8');
        return result.rows;
    },
    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [id]);
        return result.rows[0];
    }
};

module.exports = ProductModel;