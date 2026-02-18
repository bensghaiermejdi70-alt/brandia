// ============================================
// PRODUCT CONTROLLER - v3.1 CORRIGÉ (100% PUBLIQUE)
// ============================================

const db = require('../../config/db');

class ProductController {
  
  // ==========================================
  // ROUTES PUBLIQUES - AUCUNE AUTH REQUISE
  // ==========================================

  async getAll(req, res) {
    try {
      const { category, search, min_price, max_price, sort = 'created_at', order = 'DESC', page = 1, limit = 20 } = req.query;

      let whereClause = 'WHERE p.is_active = true';
      const params = [];
      let paramIndex = 1;

      // 🔥 CORRECTION : Gestion intelligente category (slug ou ID)
      if (category) {
        const isNumeric = /^\d+$/.test(category);
        if (isNumeric) {
          whereClause += ` AND p.category_id = $${paramIndex}`;
          params.push(parseInt(category));
        } else {
          whereClause += ` AND (c.slug = $${paramIndex} OR c.name ILIKE $${paramIndex})`;
          params.push(category);
        }
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (min_price) {
        whereClause += ` AND p.price >= $${paramIndex}`;
        params.push(parseFloat(min_price));
        paramIndex++;
      }

      if (max_price) {
        whereClause += ` AND p.price <= $${paramIndex}`;
        params.push(parseFloat(max_price));
        paramIndex++;
      }

      const countResult = await db.query(`
        SELECT COUNT(*) as total 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await db.query(`
        SELECT 
          p.id,
          p.name,
          p.price,
          p.compare_price,
          p.stock_quantity,
          p.main_image_url,
          p.is_featured,
          p.is_active,
          p.rating,
          p.reviews_count,
          p.created_at,
          p.supplier_id,
          s.company_name as supplier_company,
          s.logo_url as supplier_logo,
          c.name as category_name,
          c.slug as category_slug
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.${sort} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, parseInt(limit), offset]);

      res.json({
        success: true,
        data: {
          products: result.rows,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('[Get All Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getFeatured(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          p.id,
          p.name,
          p.price,
          p.compare_price,
          p.main_image_url,
          p.is_featured,
          p.supplier_id,
          s.company_name as supplier_company,
          s.logo_url as supplier_logo,
          c.name as category_name
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = true AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT 8
      `);

      res.json({
        success: true,
        data: { products: result.rows }
      });

    } catch (error) {
      console.error('[Get Featured] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID produit invalide' 
        });
      }

      const result = await db.query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.short_description,
          p.price,
          p.compare_price,
          p.stock_quantity,
          p.sku,
          p.main_image_url,
          p.is_featured,
          p.is_active,
          p.rating,
          p.reviews_count,
          p.created_at,
          p.vat_rate,
          p.category_id,
          p.slug,
          p.supplier_id,
          s.company_name as supplier_company,
          s.logo_url as supplier_logo,
          s.description as supplier_description,
          c.name as category_name,
          c.slug as category_slug
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = $1 AND p.is_active = true
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Produit non trouvé' 
        });
      }

      const product = result.rows[0];
      
      const normalizedProduct = {
        ...product,
        stock: product.stock_quantity,
        stock_quantity: product.stock_quantity,
        image: product.main_image_url,
        main_image_url: product.main_image_url,
        brand_name: product.supplier_company,
        category: product.category_name
      };

      res.json({
        success: true,
        data: { product: normalizedProduct }
      });

    } catch (error) {
      console.error('[Get Product By ID] Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération du produit' 
      });
    }
  }

  async getByIdWithPromotion(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID produit invalide' 
        });
      }

      const productResult = await db.query(`
        SELECT 
          p.*,
          s.company_name as supplier_company,
          s.logo_url as supplier_logo,
          c.name as category_name,
          c.slug as category_slug
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = $1 AND p.is_active = true
      `, [id]);

      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Produit non trouvé' 
        });
      }

      const product = productResult.rows[0];

      const promoResult = await db.query(`
        SELECT * FROM promotions
        WHERE supplier_id = $1
          AND status = 'active'
          AND start_date <= NOW()
          AND end_date >= NOW()
          AND (applies_to = 'all' OR 
               EXISTS (SELECT 1 FROM promotion_products WHERE promotion_id = promotions.id AND product_id = $2))
        ORDER BY created_at DESC
        LIMIT 1
      `, [product.supplier_id, id]);

      const promotion = promoResult.rows[0] || null;
      
      let finalPrice = parseFloat(product.price);
      let hasPromotion = false;
      
      if (promotion) {
        hasPromotion = true;
        if (promotion.type === 'percentage') {
          finalPrice = finalPrice * (1 - promotion.value / 100);
        } else if (promotion.type === 'fixed') {
          finalPrice = Math.max(0, finalPrice - promotion.value);
        }
      }

      res.json({
        success: true,
        data: {
          product: {
            ...product,
            stock: product.stock_quantity,
            stock_quantity: product.stock_quantity,
            has_promotion: hasPromotion,
            promotion: promotion,
            final_price: finalPrice,
            base_price: parseFloat(product.price),
            original_price: parseFloat(product.price)
          }
        }
      });

    } catch (error) {
      console.error('[Get Product With Promo] Error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // 🔥 CORRECTION PRINCIPALE : getAllWithPromotions
  async getAllWithPromotions(req, res) {
    try {
      const { category, search, limit = 20 } = req.query;

      let whereClause = 'WHERE p.is_active = true';
      const params = [];
      let paramIndex = 1;

      // 🔥 CORRECTION CRITIQUE : Gestion intelligente category (slug ou ID)
      if (category) {
        const isNumeric = /^\d+$/.test(category);
        
        if (isNumeric) {
          // C'est un ID numérique
          whereClause += ` AND p.category_id = $${paramIndex}`;
          params.push(parseInt(category));
        } else {
          // C'est un slug texte
          whereClause += ` AND (c.slug = $${paramIndex} OR c.name ILIKE $${paramIndex})`;
          params.push(category);
        }
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const result = await db.query(`
        SELECT 
          p.id,
          p.name,
          p.price,
          p.compare_price,
          p.stock_quantity,
          p.main_image_url,
          p.supplier_id,
          s.company_name as supplier_company,
          c.name as category_name,
          c.slug as category_slug,
          EXISTS (
            SELECT 1 FROM promotions 
            WHERE supplier_id = p.supplier_id 
            AND status = 'active' 
            AND start_date <= NOW() 
            AND end_date >= NOW()
          ) as has_promotion
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex}
      `, [...params, parseInt(limit)]);

      const productsWithPromos = await Promise.all(result.rows.map(async (p) => {
        if (!p.has_promotion) return { ...p, final_price: parseFloat(p.price) };

        const promoResult = await db.query(`
          SELECT * FROM promotions
          WHERE supplier_id = $1 AND status = 'active' AND start_date <= NOW() AND end_date >= NOW()
          ORDER BY created_at DESC LIMIT 1
        `, [p.supplier_id]);

        const promo = promoResult.rows[0];
        let finalPrice = parseFloat(p.price);
        
        if (promo) {
          if (promo.type === 'percentage') {
            finalPrice = finalPrice * (1 - promo.value / 100);
          } else if (promo.type === 'fixed') {
            finalPrice = Math.max(0, finalPrice - promo.value);
          }
        }

        return {
          ...p,
          promotion: promo,
          final_price: finalPrice,
          original_price: parseFloat(p.price)
        };
      }));

      res.json({
        success: true,
        data: { products: productsWithPromos }
      });

    } catch (error) {
      console.error('[Get All With Promotions] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getFeaturedWithPromotions(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          p.id,
          p.name,
          p.price,
          p.compare_price,
          p.main_image_url,
          p.supplier_id,
          s.company_name as supplier_company,
          c.name as category_name
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = true AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT 8
      `);

      const productsWithPromos = await Promise.all(result.rows.map(async (p) => {
        const promoResult = await db.query(`
          SELECT * FROM promotions
          WHERE supplier_id = $1 AND status = 'active' AND start_date <= NOW() AND end_date >= NOW()
          ORDER BY created_at DESC LIMIT 1
        `, [p.supplier_id]);

        const promo = promoResult.rows[0];
        let finalPrice = parseFloat(p.price);
        let hasPromo = false;
        
        if (promo) {
          hasPromo = true;
          if (promo.type === 'percentage') {
            finalPrice = finalPrice * (1 - promo.value / 100);
          } else if (promo.type === 'fixed') {
            finalPrice = Math.max(0, finalPrice - promo.value);
          }
        }

        return {
          ...p,
          has_promotion: hasPromo,
          promotion: promo,
          final_price: finalPrice,
          original_price: parseFloat(p.price),
          base_price: parseFloat(p.price)
        };
      }));

      res.json({
        success: true,
        count: productsWithPromos.length,
        promo_count: productsWithPromos.filter(p => p.has_promotion).length,
        data: { products: productsWithPromos }
      });

    } catch (error) {
      console.error('[Get Featured With Promotions] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // ROUTES PROTÉGÉES (supplier uniquement)
  // ==========================================

  async create(req, res) {
    try {
      if (!req.user || req.user.role !== 'supplier') {
        return res.status(403).json({ 
          success: false, 
          message: 'Accès réservé aux fournisseurs' 
        });
      }

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [req.user.id]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { name, price, stock_quantity, description, category_id, main_image_url } = req.body;

      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${Date.now()}`;

      const result = await db.query(
        `INSERT INTO products (supplier_id, name, price, stock_quantity, description, category_id, main_image_url, is_active, slug, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW(), NOW()) RETURNING *`,
        [supplierId, name, price, stock_quantity, description, category_id, main_image_url, slug]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      if (!req.user || req.user.role !== 'supplier') {
        return res.status(403).json({ 
          success: false, 
          message: 'Accès réservé aux fournisseurs' 
        });
      }

      const { id } = req.params;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [req.user.id]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const checkResult = await db.query(
        'SELECT id FROM products WHERE id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Produit non trouvé ou non autorisé' 
        });
      }

      const allowedFields = {
        name: req.body.name,
        price: req.body.price,
        stock_quantity: req.body.stock_quantity,
        description: req.body.description,
        category_id: req.body.category_id,
        is_active: req.body.is_active,
        main_image_url: req.body.main_image_url
      };

      const updates = {};
      for (const [key, value] of Object.entries(allowedFields)) {
        if (value !== undefined && value !== null) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
      }

      const fields = Object.keys(updates);
      const values = Object.values(updates);
      
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      const sql = `
        UPDATE products SET ${setClause}, updated_at = NOW()
        WHERE id = $${fields.length + 1} AND supplier_id = $${fields.length + 2}
        RETURNING *
      `;
      
      values.push(id, supplierId);

      const result = await db.query(sql, values);

      res.json({ success: true, data: result.rows[0] });
      
    } catch (error) {
      console.error('[Update Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      if (!req.user || req.user.role !== 'supplier') {
        return res.status(403).json({ 
          success: false, 
          message: 'Accès réservé aux fournisseurs' 
        });
      }

      const { id } = req.params;

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [req.user.id]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(
        'DELETE FROM products WHERE id = $1 AND supplier_id = $2 RETURNING id, name',
        [id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
      }

      res.json({ success: true, message: 'Produit supprimé', data: result.rows[0] });
      
    } catch (error) {
      console.error('[Delete Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ProductController();