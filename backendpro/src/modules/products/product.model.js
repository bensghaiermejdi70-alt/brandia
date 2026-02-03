// ============================================
// PRODUCT MODEL - Requêtes SQL Produits
// ============================================

const { query } = require('../../config/db');  // ✅ On garde query
const logger = require('../../utils/logger');

const ProductModel = {
   findAll: async (options = {}) => {
    const { category, search, limit = 20, offset = 0 } = options;
    
    let sql = `
        SELECT 
            p.id,
            p.name,
            p.slug,
            p.description,
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
    sql += ` ORDER BY p.is_featured DESC, p.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit) || 20);

    if (offset > 0) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));
    }

    console.log('[ProductModel] SQL:', sql.replace(/\s+/g, ' ').trim());
    
    // ✅ CORRECTION : utiliser query (pas pool.query)
    const result = await query(sql, params);
    console.log(`[ProductModel] ${result.rows.length} produits trouvés`);
    
    return result.rows;
},

    // Produits en vedette
    findFeatured: async (limit = 8) => {
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
        
        // ✅ CORRECTION : utiliser query (pas pool.query)
        const result = await query(sql, [parseInt(limit)]);
        console.log(`[ProductModel] ${result.rows.length} produits en vedette`);
        
        return result.rows;
    },

    // Détail par ID
    findById: async (id) => {
        const sql = `
            SELECT p.*,
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
    },

    // Détail par slug
    findBySlug: async (slug) => {
        const sql = `
            SELECT p.*,
                u.first_name as supplier_name,
                s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE p.slug = $1 
            AND (p.is_active = true OR p.is_active IS NULL)
        `;
        
        const result = await query(sql, [slug]);
        return result.rows[0] || null;
    },

    // Créer un produit
    create: async (productData) => {
        const { supplier_id, name, slug, description, price, stock_quantity, category_id, main_image_url } = productData;
        
        const sql = `
            INSERT INTO products (supplier_id, name, slug, description, price, stock_quantity, category_id, main_image_url, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
            RETURNING *
        `;
        
        const result = await query(sql, [supplier_id, name, slug, description, price, stock_quantity, category_id, main_image_url]);
        return result.rows[0];
    },
    
    update: async (id, updates) => {
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

        const sql = `UPDATE products SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
        values.push(id);

        const result = await query(sql, values);
        return result.rows[0];
    },
    
    delete: async (id) => {
        const result = await query('DELETE FROM products WHERE id = $1 RETURNING id, name', [id]);
        return result.rows[0];
    }
};

module.exports = ProductModel;