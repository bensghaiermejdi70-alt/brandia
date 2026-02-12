// ============================================
// PRODUCT CONTROLLER - Backend API (CORRIGÉ v2.0)
// Promotions fonctionnelles avec calcul prix réduit
// ============================================

const db = require('../../config/db');

const ProductController = {

    // ============================================
    // 🔥 Liste tous les produits (avec filtres)
    // ============================================
    getAll: async (req, res) => {
        try {

            let { category, search, limit = 20, offset = 0 } = req.query;

            const limitNum = Math.min(parseInt(limit) || 20, 100);
            const offsetNum = parseInt(offset) || 0;

            let sql = `
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.first_name as supplier_name,
                    s.company_name as brand_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
            `;

            const params = [];
            let paramCount = 0;

            // ✅ FILTRE CATÉGORIE (SAFE - slug uniquement)
            if (category) {
                paramCount++;
                sql += ` AND c.slug = $${paramCount}`;
                params.push(category);
            }

            // ✅ RECHERCHE (optimisée si search_vector existe)
            if (search) {
                paramCount++;
                sql += ` AND (
                    p.search_vector @@ plainto_tsquery('simple', $${paramCount})
                    OR p.name ILIKE $${paramCount}
                )`;
                params.push(search);
            }

            sql += ` ORDER BY p.created_at DESC`;

            // Pagination sécurisée
            paramCount++;
            sql += ` LIMIT $${paramCount}`;
            params.push(limitNum);

            paramCount++;
            sql += ` OFFSET $${paramCount}`;
            params.push(offsetNum);

            const result = await db.query(sql, params);

            res.json({
                success: true,
                count: result.rows.length,
                data: result.rows
            });

        } catch (error) {
            console.error('[ProductController] getAll error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },


    // ============================================
    // 🔥 Produits en vedette
    // ============================================
    getFeatured: async (req, res) => {
        try {

            const result = await db.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    u.first_name as supplier_name,
                    s.company_name as brand_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE (p.is_active = true OR p.is_active IS NULL)
                ORDER BY p.created_at DESC
                LIMIT 8
            `);

            res.json({
                success: true,
                count: result.rows.length,
                data: result.rows
            });

        } catch (error) {
            console.error('[ProductController] getFeatured error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },


    // ============================================
    // 🔥 Détail produit
    // ============================================
    getById: async (req, res) => {
        try {

            const { id } = req.params;

            const result = await db.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    u.first_name as supplier_name,
                    s.company_name as brand_name,
                    s.logo_url as supplier_logo,
                    s.description as supplier_description
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                WHERE p.id = $1 
                AND (p.is_active = true OR p.is_active IS NULL)
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[ProductController] getById error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },
    // ============================================
    // 🔥 Create
    // ============================================
    create: async (req, res) => {
        try {

            const userId = req.user.userId;
            const { name, description, price, stock_quantity, category_id, main_image_url } = req.body;

            if (!name || !price) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom et prix sont requis'
                });
            }

            const result = await db.query(`
                INSERT INTO products 
                (supplier_id, name, description, price, stock_quantity, category_id, main_image_url, is_active, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW())
                RETURNING *
            `, [userId, name, description, price, stock_quantity || 0, category_id, main_image_url]);

            res.status(201).json({
                success: true,
                message: 'Produit créé',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[ProductController] create error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },


    // ============================================
    // 🔥 Update
    // ============================================
    update: async (req, res) => {
        try {

            const userId = req.user.userId;
            const { id } = req.params;
            const { name, description, price, stock_quantity, category_id, main_image_url, is_active } = req.body;

            const check = await db.query(
                'SELECT id FROM products WHERE id = $1 AND supplier_id = $2',
                [id, userId]
            );

            if (check.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Produit non autorisé'
                });
            }

            const result = await db.query(`
                UPDATE products 
                SET name=$1, description=$2, price=$3, stock_quantity=$4,
                    category_id=$5, main_image_url=$6, is_active=$7, updated_at=NOW()
                WHERE id=$8 AND supplier_id=$9
                RETURNING *
            `, [name, description, price, stock_quantity, category_id, main_image_url, is_active, id, userId]);

            res.json({
                success: true,
                message: 'Produit mis à jour',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[ProductController] update error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },


    // ============================================
    // 🔥 Delete
    // ============================================
    remove: async (req, res) => {
        try {

            const userId = req.user.userId;
            const { id } = req.params;

            const check = await db.query(
                'SELECT id FROM products WHERE id = $1 AND supplier_id = $2',
                [id, userId]
            );

            if (check.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Produit non autorisé'
                });
            }

            await db.query('DELETE FROM products WHERE id = $1', [id]);

            res.json({
                success: true,
                message: 'Produit supprimé'
            });

        } catch (error) {
            console.error('[ProductController] remove error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },
    // ============================================
    // 🔥 Promotions - Liste avec promotions actives (CORRIGÉ)
    // ============================================
    getAllWithPromotions: async (req, res) => {
        try {
            let { category, search, promo_only, limit = 20, offset = 0 } = req.query;

            const limitNum = Math.min(parseInt(limit) || 20, 100);
            const offsetNum = parseInt(offset) || 0;

            // 🔥 Requête avec jointure promotions et calcul prix réduit
            let sql = `
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.first_name as supplier_name,
                    s.company_name as brand_name,
                    s.id as supplier_id_num,
                    pr.id as promo_id,
                    pr.name as promo_name,
                    pr.type as promo_type,
                    pr.value as promo_value,
                    pr.code as promo_code,
                    pr.end_date as promo_end_date,
                    CASE 
                        WHEN pr.id IS NOT NULL AND pr.end_date >= NOW() 
                        THEN true 
                        ELSE false 
                    END as has_promotion,
                    CASE 
                        WHEN pr.type = 'percentage' THEN ROUND(p.price * (1 - pr.value / 100), 2)
                        WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                        ELSE p.price
                    END as final_price
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN promotions pr ON pr.supplier_id = u.id 
                    AND pr.status = 'active' 
                    AND pr.start_date <= NOW() 
                    AND pr.end_date >= NOW()
                    AND (pr.applies_to = 'all' OR pr.applies_to IS NULL OR pr.applies_to = '')
                WHERE (p.is_active = true OR p.is_active IS NULL)
            `;

            const params = [];
            let paramCount = 0;

            // ✅ FILTRE CATÉGORIE
            if (category) {
                paramCount++;
                sql += ` AND c.slug = $${paramCount}`;
                params.push(category);
            }

            // ✅ FILTRE RECHERCHE
            if (search) {
                paramCount++;
                sql += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            // ✅ FILTRE PROMO UNIQUEMENT
            if (promo_only === 'true' || promo_only === '1' || promo_only === true) {
                sql += ` AND pr.id IS NOT NULL AND pr.end_date >= NOW()`;
            }

            // Tri : promos d'abord, puis plus récents
            sql += ` ORDER BY 
                CASE WHEN pr.id IS NOT NULL AND pr.end_date >= NOW() THEN 0 ELSE 1 END,
                p.created_at DESC
            `;

            // Pagination
            paramCount++;
            sql += ` LIMIT $${paramCount}`;
            params.push(limitNum);

            paramCount++;
            sql += ` OFFSET $${paramCount}`;
            params.push(offsetNum);

            console.log('[ProductController] getAllWithPromotions SQL:', sql);
            console.log('[ProductController] Params:', params);

            const result = await db.query(sql, params);

            // Formater les données pour le frontend
            const products = result.rows.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: parseFloat(p.price),
                final_price: parseFloat(p.final_price),
                base_price: parseFloat(p.price),
                has_promotion: p.has_promotion === true,
                promo_id: p.promo_id,
                promo_name: p.promo_name,
                promo_type: p.promo_type,
                promo_value: p.promo_value,
                promo_code: p.promo_code,
                promo_end_date: p.promo_end_date,
                discount_display: p.promo_type === 'percentage' ? `-${p.promo_value}%` : `-${p.promo_value}€`,
                stock_quantity: p.stock_quantity,
                main_image_url: p.main_image_url,
                category_name: p.category_name,
                category_slug: p.category_slug,
                supplier_name: p.supplier_name,
                supplier_company: p.brand_name || p.supplier_name,
                created_at: p.created_at
            }));

            const promoCount = products.filter(p => p.has_promotion).length;

            res.json({
                success: true,
                count: products.length,
                promo_count: promoCount,
                data: { products }
            });

        } catch (error) {
            console.error('[ProductController] getAllWithPromotions error:', error);
            // Fallback sur getAll en cas d'erreur
            return ProductController.getAll(req, res);
        }
    },
    // ============================================
    // 🔥 Produits en vedette avec promotions (CORRIGÉ)
    // ============================================
    getFeaturedWithPromotions: async (req, res) => {
        try {
            const result = await db.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.first_name as supplier_name,
                    s.company_name as brand_name,
                    pr.id as promo_id,
                    pr.name as promo_name,
                    pr.type as promo_type,
                    pr.value as promo_value,
                    pr.code as promo_code,
                    pr.end_date as promo_end_date,
                    CASE 
                        WHEN pr.id IS NOT NULL AND pr.end_date >= NOW() 
                        THEN true 
                        ELSE false 
                    END as has_promotion,
                    CASE 
                        WHEN pr.type = 'percentage' THEN ROUND(p.price * (1 - pr.value / 100), 2)
                        WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                        ELSE p.price
                    END as final_price
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN promotions pr ON pr.supplier_id = u.id 
                    AND pr.status = 'active' 
                    AND pr.start_date <= NOW() 
                    AND pr.end_date >= NOW()
                    AND (pr.applies_to = 'all' OR pr.applies_to IS NULL OR pr.applies_to = '')
                WHERE (p.is_active = true OR p.is_active IS NULL)
                ORDER BY 
                    CASE WHEN pr.id IS NOT NULL AND pr.end_date >= NOW() THEN 0 ELSE 1 END,
                    p.created_at DESC
                LIMIT 8
            `);

            const products = result.rows.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: parseFloat(p.price),
                final_price: parseFloat(p.final_price),
                base_price: parseFloat(p.price),
                has_promotion: p.has_promotion === true,
                promo_id: p.promo_id,
                promo_name: p.promo_name,
                promo_type: p.promo_type,
                promo_value: p.promo_value,
                promo_code: p.promo_code,
                promo_end_date: p.promo_end_date,
                discount_display: p.promo_type === 'percentage' ? `-${p.promo_value}%` : `-${p.promo_value}€`,
                stock_quantity: p.stock_quantity,
                main_image_url: p.main_image_url,
                category_name: p.category_name,
                category_slug: p.category_slug,
                supplier_name: p.supplier_name,
                supplier_company: p.brand_name || p.supplier_name,
                created_at: p.created_at
            }));

            const promoCount = products.filter(p => p.has_promotion).length;

            res.json({
                success: true,
                count: products.length,
                promo_count: promoCount,
                data: { products }
            });

        } catch (error) {
            console.error('[ProductController] getFeaturedWithPromotions error:', error);
            return ProductController.getFeatured(req, res);
        }
    },
    // ============================================
    // 🔥 Détail produit avec promotion (CORRIGÉ)
    // ============================================
    getByIdWithPromotion: async (req, res) => {
        try {
            const { id } = req.params;

            const result = await db.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.first_name as supplier_name,
                    s.company_name as brand_name,
                    s.logo_url as supplier_logo,
                    s.description as supplier_description,
                    s.id as supplier_id_num,
                    pr.id as promo_id,
                    pr.name as promo_name,
                    pr.type as promo_type,
                    pr.value as promo_value,
                    pr.code as promo_code,
                    pr.end_date as promo_end_date,
                    CASE 
                        WHEN pr.id IS NOT NULL AND pr.end_date >= NOW() 
                        THEN true 
                        ELSE false 
                    END as has_promotion,
                    CASE 
                        WHEN pr.type = 'percentage' THEN ROUND(p.price * (1 - pr.value / 100), 2)
                        WHEN pr.type = 'fixed' THEN GREATEST(0, p.price - pr.value)
                        ELSE p.price
                    END as final_price
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.supplier_id = u.id
                LEFT JOIN suppliers s ON u.id = s.user_id
                LEFT JOIN promotions pr ON pr.supplier_id = u.id 
                    AND pr.status = 'active' 
                    AND pr.start_date <= NOW() 
                    AND pr.end_date >= NOW()
                    AND (pr.applies_to = 'all' OR pr.applies_to IS NULL OR pr.applies_to = '')
                WHERE p.id = $1 
                AND (p.is_active = true OR p.is_active IS NULL)
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Produit non trouvé'
                });
            }

            const p = result.rows[0];
            const product = {
                id: p.id,
                name: p.name,
                description: p.description,
                price: parseFloat(p.price),
                final_price: parseFloat(p.final_price),
                base_price: parseFloat(p.price),
                has_promotion: p.has_promotion === true,
                promo_id: p.promo_id,
                promo_name: p.promo_name,
                promo_type: p.promo_type,
                promo_value: p.promo_value,
                promo_code: p.promo_code,
                promo_end_date: p.promo_end_date,
                discount_display: p.promo_type === 'percentage' ? `-${p.promo_value}%` : `-${p.promo_value}€`,
                stock_quantity: p.stock_quantity,
                main_image_url: p.main_image_url,
                category_id: p.category_id,
                category_name: p.category_name,
                category_slug: p.category_slug,
                supplier_id: p.supplier_id,
                supplier_name: p.supplier_name,
                supplier_company: p.brand_name || p.supplier_name,
                supplier_logo: p.supplier_logo,
                supplier_description: p.supplier_description,
                created_at: p.created_at,
                updated_at: p.updated_at
            };

            res.json({
                success: true,
                data: { product }
            });

        } catch (error) {
            console.error('[ProductController] getByIdWithPromotion error:', error);
            return ProductController.getById(req, res);
        }
    }

};

module.exports = ProductController;