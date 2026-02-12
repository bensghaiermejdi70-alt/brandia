// ============================================
// PRODUCT CONTROLLER - Backend API (STABLE)
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
    // 🔥 Promotions (fallback propre)
    // ============================================
    getAllWithPromotions: async (req, res) => {
        return ProductController.getAll(req, res);
    },

    getFeaturedWithPromotions: async (req, res) => {
        return ProductController.getFeatured(req, res);
    },

    getByIdWithPromotion: async (req, res) => {
        return ProductController.getById(req, res);
    }

};

module.exports = ProductController;
