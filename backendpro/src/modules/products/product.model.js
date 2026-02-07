// ============================================
// PRODUCT MODEL - Requêtes SQL Produits (AVEC PROMOTIONS)
// ============================================

const { query } = require('../../config/db');
const logger = require('../../utils/logger');

const ProductModel = {
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
    // NOUVEAU: Récupérer produits avec promotions actives
    // ==========================================
    findAllWithPromotions: async (options = {}) => {
        try {
            const { category, search, limit = 20, offset = 0, country_code = 'FR' } = options;
            
            let sql = `
                WITH active_promotions AS (
                    SELECT 
                        pp.product_id,
                        pr.id as promo_id,
                        pr.name as promo_name,
                        pr.type as promo_type,
                        pr.value as promo_value,
                        pr.code as promo_code,
                        pr.applies_to,
                        CASE 
                            WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                            WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                            ELSE p.price
                        END as final_price,
                        CASE 
                            WHEN pr.type = 'percentage' THEN pr.value || '%'
                            ELSE pr.value || '€'
                        END as discount_display,
                        pr.end_date
                    FROM promotions pr
                    JOIN promotion_products pp ON pr.id = pp.promotion_id
                    JOIN products p ON pp.product_id = p.id
                    WHERE pr.status = 'active'
                        AND pr.start_date <= CURRENT_DATE 
                        AND pr.end_date >= CURRENT_DATE
                        AND (pr.max_usage IS NULL OR pr.usage_count < pr.max_usage)
                ),
                category_promotions AS (
                    SELECT 
                        p.id as product_id,
                        pr.id as promo_id,
                        pr.name as promo_name,
                        pr.type as promo_type,
                        pr.value as promo_value,
                        pr.code as promo_code,
                        pr.applies_to,
                        CASE 
                            WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                            WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                            ELSE p.price
                        END as final_price,
                        CASE 
                            WHEN pr.type = 'percentage' THEN pr.value || '%'
                            ELSE pr.value || '€'
                        END as discount_display,
                        pr.end_date
                    FROM promotions pr
                    JOIN products p ON p.category_id IN (
                        SELECT id FROM categories WHERE slug = pr.applies_to
                    )
                    WHERE pr.status = 'active'
                        AND pr.applies_to != 'all'
                        AND pr.start_date <= CURRENT_DATE 
                        AND pr.end_date >= CURRENT_DATE
                        AND (pr.max_usage IS NULL OR pr.usage_count < pr.max_usage)
                ),
                global_promotions AS (
                    SELECT 
                        p.id as product_id,
                        pr.id as promo_id,
                        pr.name as promo_name,
                        pr.type as promo_type,
                        pr.value as promo_value,
                        pr.code as promo_code,
                        'all' as applies_to,
                        CASE 
                            WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                            WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                            ELSE p.price
                        END as final_price,
                        CASE 
                            WHEN pr.type = 'percentage' THEN pr.value || '%'
                            ELSE pr.value || '€'
                        END as discount_display,
                        pr.end_date
                    FROM promotions pr
                    CROSS JOIN products p
                    WHERE pr.status = 'active'
                        AND pr.applies_to = 'all'
                        AND pr.start_date <= CURRENT_DATE 
                        AND pr.end_date >= CURRENT_DATE
                        AND (pr.max_usage IS NULL OR pr.usage_count < pr.max_usage)
                ),
                best_promotions AS (
                    SELECT DISTINCT ON (product_id)
                        product_id,
                        promo_id,
                        promo_name,
                        promo_type,
                        promo_value,
                        promo_code,
                        applies_to,
                        final_price,
                        discount_display,
                        end_date
                    FROM (
                        SELECT * FROM active_promotions
                        UNION ALL
                        SELECT * FROM category_promotions
                        UNION ALL
                        SELECT * FROM global_promotions
                    ) all_promos
                    ORDER BY product_id, 
                        CASE promo_type 
                            WHEN 'percentage' THEN promo_value * final_price / 100 
                            ELSE promo_value 
                        END DESC
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
                    p.category_id,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company,
                    c.name as category_name,
                    c.slug as category_slug,
                    COALESCE(bp.final_price, p.price) as price,
                    COALESCE(bp.final_price, p.price) as final_price,
                    p.price as base_price,
                    bp.promo_id,
                    bp.promo_name,
                    bp.promo_type,
                    bp.promo_value,
                    bp.promo_code,
                    bp.discount_display,
                    bp.applies_to,
                    bp.end_date as promo_end_date,
                    CASE WHEN bp.promo_id IS NOT NULL THEN true ELSE false END as has_promotion,
                    CASE 
                        WHEN bp.promo_type = 'percentage' THEN ROUND(((p.price - bp.final_price) / p.price * 100), 0) || '%'
                        WHEN bp.promo_type = 'fixed' THEN ROUND((p.price - bp.final_price), 2) || '€'
                        ELSE null
                    END as savings_display
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN best_promotions bp ON p.id = bp.product_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
            `;
            
            const params = [];
            let paramCount = 0;

            if (category && category !== 'null' && category !== 'undefined') {
                paramCount++;
                sql += ` AND (c.slug = $${paramCount} OR c.id::text = $${paramCount})`;
                params.push(category);
            }

            if (search) {
                paramCount++;
                sql += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            paramCount++;
            sql += ` ORDER BY 
                CASE WHEN bp.promo_id IS NOT NULL THEN 0 ELSE 1 END,
                p.created_at DESC 
                LIMIT $${paramCount}`;
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
    // NOUVEAU: Détail produit avec promotion
    // ==========================================
    findByIdWithPromotion: async (id) => {
        try {
            const sql = `
                WITH active_promotions AS (
                    SELECT 
                        pp.product_id,
                        pr.id as promo_id,
                        pr.name as promo_name,
                        pr.type as promo_type,
                        pr.value as promo_value,
                        pr.code as promo_code,
                        pr.applies_to,
                        pr.max_usage,
                        pr.usage_count,
                        CASE 
                            WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                            WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                            ELSE p.price
                        END as final_price,
                        CASE 
                            WHEN pr.type = 'percentage' THEN pr.value || '%'
                            ELSE pr.value || '€'
                        END as discount_display,
                        pr.end_date,
                        pr.start_date
                    FROM promotions pr
                    JOIN promotion_products pp ON pr.id = pp.promotion_id
                    JOIN products p ON pp.product_id = p.id
                    WHERE pp.product_id = $1
                        AND pr.status = 'active'
                        AND pr.start_date <= CURRENT_DATE 
                        AND pr.end_date >= CURRENT_DATE
                        AND (pr.max_usage IS NULL OR pr.usage_count < pr.max_usage)
                    UNION ALL
                    SELECT 
                        p.id as product_id,
                        pr.id as promo_id,
                        pr.name as promo_name,
                        pr.type as promo_type,
                        pr.value as promo_value,
                        pr.code as promo_code,
                        pr.applies_to,
                        pr.max_usage,
                        pr.usage_count,
                        CASE 
                            WHEN pr.type = 'percentage' THEN p.price * (1 - pr.value/100)
                            WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                            ELSE p.price
                        END as final_price,
                        CASE 
                            WHEN pr.type = 'percentage' THEN pr.value || '%'
                            ELSE pr.value || '€'
                        END as discount_display,
                        pr.end_date,
                        pr.start_date
                    FROM promotions pr
                    JOIN products p ON p.id = $1
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE pr.status = 'active'
                        AND pr.applies_to = 'all'
                        AND pr.start_date <= CURRENT_DATE 
                        AND pr.end_date >= CURRENT_DATE
                        AND (pr.max_usage IS NULL OR pr.usage_count < pr.max_usage)
                ),
                best_promotion AS (
                    SELECT *
                    FROM active_promotions
                    ORDER BY 
                        CASE promo_type 
                            WHEN 'percentage' THEN promo_value * final_price / 100 
                            ELSE promo_value 
                        END DESC
                    LIMIT 1
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
                    p.category_id,
                    u.first_name as supplier_name,
                    s.company_name as supplier_company,
                    s.description as supplier_description,
                    c.name as category_name,
                    c.slug as category_slug,
                    COALESCE(bp.final_price, p.price) as price,
                    COALESCE(bp.final_price, p.price) as final_price,
                    p.price as base_price,
                    bp.promo_id,
                    bp.promo_name,
                    bp.promo_type,
                    bp.promo_value,
                    bp.promo_code,
                    bp.max_usage,
                    bp.usage_count,
                    bp.discount_display,
                    bp.applies_to,
                    bp.start_date as promo_start_date,
                    bp.end_date as promo_end_date,
                    CASE WHEN bp.promo_id IS NOT NULL THEN true ELSE false END as has_promotion,
                    CASE 
                        WHEN bp.promo_type = 'percentage' THEN ROUND(((p.price - bp.final_price) / p.price * 100), 0) || '%'
                        WHEN bp.promo_type = 'fixed' THEN ROUND((p.price - bp.final_price), 2) || '€'
                        ELSE null
                    END as savings_display,
                    CASE 
                        WHEN bp.promo_type = 'percentage' THEN p.price * bp.promo_value/100
                        WHEN bp.promo_type = 'fixed' THEN bp.promo_value
                        ELSE 0
                    END as savings_amount
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN best_promotion bp ON true
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

    findFeatured: async (limit = 8) => {
        try {
            const sql = `
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

    // ==========================================
    // NOUVEAU: Produits en vedette avec promotions
    // ==========================================
    findFeaturedWithPromotions: async (limit = 8) => {
        try {
            const sql = `
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
                    p.price as base_price,
                    bp.promo_id,
                    bp.promo_name,
                    bp.promo_type,
                    bp.promo_value,
                    bp.discount_display,
                    CASE WHEN bp.promo_id IS NOT NULL THEN true ELSE false END as has_promotion,
                    CASE 
                        WHEN bp.promo_type = 'percentage' THEN ROUND(((p.price - bp.final_price) / p.price * 100), 0) || '%'
                        WHEN bp.promo_type = 'fixed' THEN ROUND((p.price - bp.final_price), 2) || '€'
                        ELSE null
                    END as savings_display
                FROM products p
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN best_promotions bp ON p.id = bp.product_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
                ORDER BY 
                    CASE WHEN bp.promo_id IS NOT NULL THEN 0 ELSE 1 END,
                    p.created_at DESC
                LIMIT $1
            `;
            
            const result = await query(sql, [parseInt(limit)]);
            console.log(`[ProductModel] ${result.rows.length} produits en vedette avec promotions`);
            
            return result.rows;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findFeaturedWithPromotions:', error.message);
            throw error;
        }
    },

    findById: async (id) => {
        try {
            const sql = `
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
                    s.company_name as supplier_company,
                    s.description as supplier_description
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

    findBySlug: async (slug) => {
        try {
            const sql = `
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
                WHERE (p.name ILIKE $1 OR p.id::text = $1)
                AND (p.is_active = true OR p.is_active IS NULL)
                LIMIT 1
            `;
            
            const result = await query(sql, [`%${slug}%`]);
            return result.rows[0] || null;

        } catch (error) {
            console.error('❌ [ProductModel] Erreur findBySlug:', error.message);
            throw error;
        }
    },

    create: async (productData) => {
        try {
            const { supplier_id, name, description, price, stock_quantity, main_image_url } = productData;
            
            const sql = `
                INSERT INTO products 
                (supplier_id, name, description, price, stock_quantity, main_image_url, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
                RETURNING id, name, description, price, stock_quantity, main_image_url, supplier_id, is_active, created_at
            `;
            
            const result = await query(sql, [supplier_id, name, description, price, stock_quantity, main_image_url]);
            console.log(`✅ [ProductModel] Produit créé: ${name}`);
            return result.rows[0];

        } catch (error) {
            console.error('❌ [ProductModel] Erreur create:', error.message);
            throw error;
        }
    },
    
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