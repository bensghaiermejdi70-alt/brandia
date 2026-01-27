// ============================================
// PRODUCT MODEL - Requêtes DB pour les produits
// ============================================

const { query } = require('../../config/db');

const ProductModel = {
    // Créer un produit (fournisseur uniquement)
    create: async ({ supplier_id, name, slug, description, short_description, price, compare_price, stock_quantity, category_id, main_image_url, category_slug, available_countries }) => {
        const sql = `
            INSERT INTO products (
                supplier_id, name, slug, description, short_description, 
                price, compare_price, stock_quantity, category_id,
                main_image_url, category_slug, available_countries, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
            RETURNING *
        `;
        const result = await query(sql, [
            supplier_id, name, slug, description, short_description,
            price, compare_price, stock_quantity, category_id,
            main_image_url, category_slug, available_countries || JSON.stringify(['FR'])
        ]);
        return result.rows[0];
    },

    // Récupérer tous les produits (avec filtres)
    findAll: async ({ category, search, limit = 20, offset = 0 } = {}) => {
        let sql = `
            SELECT p.*, s.brand_name as supplier_name, s.slug as supplier_slug
            FROM products p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.is_active = true AND s.is_active = true
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

        sql += ` ORDER BY p.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    },

    // Récupérer un produit par ID
    findById: async (id) => {
        const sql = `
            SELECT p.*, s.brand_name as supplier_name, s.slug as supplier_slug, s.commission_rate
            FROM products p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = $1 AND p.is_active = true
        `;
        const result = await query(sql, [id]);
        return result.rows[0];
    },

    // Récupérer un produit par slug
    findBySlug: async (slug) => {
        const sql = `
            SELECT p.*, s.brand_name as supplier_name, s.slug as supplier_slug, s.commission_rate
            FROM products p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.slug = $1 AND p.is_active = true
        `;
        const result = await query(sql, [slug]);
        return result.rows[0];
    },

    // Mettre à jour un produit
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

    // Supprimer un produit (soft delete)
    delete: async (id) => {
        const sql = `UPDATE products SET is_active = false WHERE id = $1 RETURNING id`;
        const result = await query(sql, [id]);
        return result.rows[0];
    },

    // Produits en vedette
    findFeatured: async (limit = 8) => {
        const sql = `
            SELECT p.*, s.brand_name as supplier_name
            FROM products p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.is_featured = true AND p.is_active = true AND s.is_active = true
            ORDER BY p.created_at DESC
            LIMIT $1
        `;
        const result = await query(sql, [limit]);
        return result.rows;
    },

    // Produits par fournisseur
    findBySupplier: async (supplierId, limit = 20, offset = 0) => {
        const sql = `
            SELECT p.*, s.brand_name as supplier_name
            FROM products p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.supplier_id = $1 AND p.is_active = true
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await query(sql, [supplierId, limit, offset]);
        return result.rows;
    }
};

module.exports = ProductModel;