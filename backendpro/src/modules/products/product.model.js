// ============================================
// PRODUCT MODEL - Requêtes SQL Produits (AVEC PROMOTIONS)
// ============================================

const { query } = require('../../config/db');
const logger = require('../../utils/logger');

const ProductModel = {
    // ==========================================
    // Récupérer tous les produits (option catégorie / recherche / pagination)
    // ==========================================
    findAll: async (options = {}) => {
        try {
            const { category, search, limit = 20, offset = 0 } = options;

            let sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.price,
                    p.stock_quantity,
                    p.main_image_url,
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

            if (category && category !== 'null' && category !== 'undefined') {
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

    // ==========================================
    // Récupérer tous les produits avec promotions actives
    // ==========================================
    findAllWithPromotions: async (options = {}) => {
        try {
            const { category, search, limit = 20, offset = 0 } = options;

            let sql = `
                WITH active_promotions AS (
                    SELECT 
                        pp.product_id,
                        pr.id as promo_id,
                        pr.name as promo_name,
                        pr.type as promo_type,
                        pr.value as promo_value,
                        pr.code as promo_code,
                        CASE 
                            WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                            WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                            ELSE p.price
                        END as final_price,
                        CASE 
                            WHEN pr.type = 'percentage' THEN pr.value || '%'
                            ELSE pr.value || '€'
                        END as discount_display
                    FROM promotions pr
                    JOIN promotion_products pp ON pr.id = pp.promotion_id
                    JOIN products p ON pp.product_id = p.id
                    WHERE pr.status = 'active'
                        AND pr.start_date <= CURRENT_DATE 
                        AND pr.end_date >= CURRENT_DATE
                        AND (pr.max_usage IS NULL OR pr.usage_count < pr.max_usage)
                ),
                best_promotions AS (
                    SELECT DISTINCT ON (product_id) *
                    FROM active_promotions
                    ORDER BY product_id, final_price ASC
                )
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.price as original_price,
                    p.stock_quantity,
                    p.main_image_url,
                    p.supplier_id,
                    p.is_active,
                    p.created_at,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company,
                    COALESCE(bp.final_price, p.price) as price,
                    COALESCE(bp.final_price, p.price) as final_price,
                    bp.promo_id,
                    bp.promo_name,
                    bp.promo_type,
                    bp.promo_value,
                    bp.promo_code,
                    bp.discount_display,
                    CASE WHEN bp.promo_id IS NOT NULL THEN true ELSE false END as has_promotion
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN best_promotions bp ON p.id = bp.product_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
            `;

            const params = [];
            let paramCount = 0;

            if (category && category !== 'null' && category !== 'undefined') {
                paramCount++;
                sql += ` AND (p.category_slug = $${paramCount} OR p.category_id::text = $${paramCount})`;
                params.push(category);
            }

            if (search) {
                paramCount++;
                sql += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            paramCount++;
            sql += ` ORDER BY CASE WHEN bp.promo_id IS NOT NULL THEN 0 ELSE 1 END, p.created_at DESC LIMIT $${paramCount}`;
            params.push(parseInt(limit) || 20);

            if (offset > 0) {
                paramCount++;
                sql += ` OFFSET $${paramCount}`;
                params.push(parseInt(offset));
            }

            console.log('[ProductModel] SQL with promotions:', sql.substring(0, 200) + '...');

            const result = await query(sql, params);
            console.log(`[ProductModel] ${result.rows.length} produits avec promotions trouvés`);

            return result.rows;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findAllWithPromotions:', error.message);
            throw error;
        }
    },

    // ==========================================
    // Détail produit simple
    // ==========================================
    findById: async (id) => {
        try {
            const sql = `
                SELECT 
                    p.*,
                    u.first_name as supplier_name,
                    s.id as supplier_id,
                    s.company_name as supplier_company,
                    c.name as category_name,
                    c.slug as category_slug
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN categories c ON p.category_id = c.id
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

    // ==========================================
    // Détail produit avec promotion
    // ==========================================
    findByIdWithPromotion: async (id) => {
        try {
            const sql = `
                SELECT 
                    p.*,
                    u.first_name as supplier_name,
                    s.id as supplier_id,
                    s.company_name as supplier_company,
                    c.name as category_name,
                    c.slug as category_slug,
                    promo.id as promo_id,
                    promo.name as promo_name,
                    promo.type as promo_type,
                    promo.value as promo_value,
                    promo.code as promo_code,
                    promo.end_date as promo_end_date,
                    CASE 
                        WHEN promo.id IS NOT NULL AND promo.start_date <= NOW() AND promo.end_date >= NOW() 
                        THEN true 
                        ELSE false 
                    END as has_promotion,
                    CASE 
                        WHEN promo.type = 'percentage' THEN p.price * (1 - promo.value / 100)
                        WHEN promo.type = 'fixed' THEN GREATEST(0, p.price - promo.value)
                        ELSE p.price
                    END as final_price,
                    p.price as base_price
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN promotion_products pp ON p.id = pp.product_id
                LEFT JOIN promotions promo ON pp.promotion_id = promo.id 
                    AND promo.status = 'active' 
                    AND promo.start_date <= NOW() 
                    AND promo.end_date >= NOW()
                WHERE p.id = $1 
                AND (p.is_active = true OR p.is_active IS NULL)
            `;
            const result = await query(sql, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ [ProductModel] Erreur findByIdWithPromotion:', error.message);
            throw error;
        }
    },

    // ==========================================
    // Produits en vedette
    // ==========================================
    findFeatured: async (limit = 8) => {
        const sql = `
            SELECT 
                p.*,
                u.first_name as supplier_name,
                s.company_name as supplier_company
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            WHERE (p.is_active = true OR p.is_active IS NULL)
            ORDER BY p.created_at DESC
            LIMIT $1
        `;
        const result = await query(sql, [parseInt(limit)]);
        return result.rows;
    },

    findFeaturedWithPromotions: async (limit = 8) => {
        const sql = `
            WITH active_promotions AS (
                SELECT 
                    pp.product_id,
                    pr.id as promo_id,
                    pr.name as promo_name,
                    pr.type as promo_type,
                    pr.value as promo_value,
                    CASE 
                        WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                        WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                        ELSE p.price
                    END as final_price
                FROM promotions pr
                JOIN promotion_products pp ON pr.id = pp.promotion_id
                JOIN products p ON pp.product_id = p.id
                WHERE pr.status = 'active'
                    AND pr.start_date <= CURRENT_DATE 
                    AND pr.end_date >= CURRENT_DATE
            ),
            best_promotions AS (
                SELECT DISTINCT ON (product_id) *
                FROM active_promotions
                ORDER BY product_id, final_price ASC
            )
            SELECT 
                p.*,
                u.first_name as supplier_name,
                s.company_name as supplier_company,
                COALESCE(bp.final_price, p.price) as price,
                bp.promo_id,
                bp.promo_name,
                bp.promo_type,
                bp.promo_value,
                CASE WHEN bp.promo_id IS NOT NULL THEN true ELSE false END as has_promotion
            FROM products p
            LEFT JOIN users u ON p.supplier_id = u.id
            LEFT JOIN suppliers s ON u.id = s.user_id
            LEFT JOIN best_promotions bp ON p.id = bp.product_id
            WHERE (p.is_active = true OR p.is_active IS NULL)
            ORDER BY CASE WHEN bp.promo_id IS NOT NULL THEN 0 ELSE 1 END, p.created_at DESC
            LIMIT $1
        `;
        const result = await query(sql, [parseInt(limit)]);
        return result.rows;
    },

    // ==========================================
    // Création d’un produit
    // ==========================================
    create: async (productData) => {
        const { supplier_id, name, description, price, stock_quantity, main_image_url } = productData;
        const sql = `
            INSERT INTO products 
                (supplier_id, name, description, price, stock_quantity, main_image_url, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
            RETURNING *
        `;
        const result = await query(sql, [supplier_id, name, description, price, stock_quantity, main_image_url]);
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

        const sql = `UPDATE products SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`;
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
