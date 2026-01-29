// backendpro/src/modules/products/product.model.js
const { query } = require('../../config/db');

const ProductModel = {
    findAll: async ({ category, search, limit = 20, offset = 0 } = {}) => {
        let sql = `
            SELECT 
                p.*, 
                u.first_name as supplier_name,
                s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE p.is_active = true
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

        sql += ` ORDER BY p.is_featured DESC, p.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    },

    findById: async (id) => {
        const sql = `
            SELECT p.*, u.first_name as supplier_name, s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE p.id = $1 AND p.is_active = true
        `;
        const result = await query(sql, [id]);
        return result.rows[0];
    },

    findFeatured: async (limit = 8) => {
        const sql = `
            SELECT p.*, u.first_name as supplier_name, s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE p.is_featured = true AND p.is_active = true
            ORDER BY p.created_at DESC LIMIT $1
        `;
        const result = await query(sql, [limit]);
        return result.rows;
    }
};

module.exports = ProductModel;