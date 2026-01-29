// backendpro/src/modules/products/product.model.js
const { query } = require('../../config/db');

const ProductModel = {
    // Liste tous les produits
    findAll: async ({ category, search, limit = 20, offset = 0 } = {}) => {
        let sql = `
            SELECT p.*, u.first_name as supplier_name, s.company_name as supplier_company
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

    // Détail par ID
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

    // Détail par slug - CORRIGÉ pour ta structure
    findBySlug: async (slug) => {
        const sql = `
            SELECT p.*, u.first_name as supplier_name, s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE p.slug = $1 AND p.is_active = true
        `;
        const result = await query(sql, [slug]);
        return result.rows[0];
    },

    // Produits en vedette
    findFeatured: async (limit = 8) => {
        const sql = `
            SELECT p.*, u.first_name as supplier_name, s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE p.is_featured = true AND p.is_active = true
            ORDER BY p.created_at DESC
            LIMIT $1
        `;
        const result = await query(sql, [limit]);
        return result.rows;
    },

    // Créer un produit
    create: async (data) => {
        const {
            supplier_id, name, slug, description, short_description,
            price, compare_price, stock_quantity, category_slug, main_image_url
        } = data;

        const sql = `
            INSERT INTO products (
                supplier_id, name, slug, description, short_description,
                price, compare_price, stock_quantity, category_slug,
                main_image_url, is_active, is_featured
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false)
            RETURNING *
        `;
        const result = await query(sql, [
            supplier_id, name, slug, description, short_description,
            price, compare_price, stock_quantity || 100, category_slug, main_image_url
        ]);
        return result.rows[0];
    },

    // Mettre à jour
    update: async (id, updates) => {
        const allowedFields = ['name', 'description', 'short_description', 'price', 'compare_price', 'stock_quantity', 'main_image_url', 'is_active', 'is_featured'];
        const fields = [];
        const values = [];
        let paramCount = 0;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                paramCount++;
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        paramCount++;
        const sql = `
            UPDATE products 
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $${paramCount} 
            RETURNING *
        `;
        values.push(id);

        const result = await query(sql, values);
        return result.rows[0];
    },

    // Soft delete
    delete: async (id) => {
        const sql = `UPDATE products SET is_active = false WHERE id = $1 RETURNING id`;
        const result = await query(sql, [id]);
        return result.rows[0];
    }
};

module.exports = ProductModel;