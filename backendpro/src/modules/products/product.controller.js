const pool = require('../config/db');

class ProductController {

  // 🔥 Liste produits avec filtres
  static async getAllWithPromotions(req, res) {
    try {
      let {
        category,
        supplier,
        search,
        limit = 20,
        offset = 0
      } = req.query;

      const limitNum = Math.min(parseInt(limit) || 20, 100);
      const offsetNum = parseInt(offset) || 0;

      let sql = `
        SELECT 
          p.id,
          p.name,
          p.slug,
          p.price,
          p.compare_price,
          p.images,
          p.is_active,
          p.created_at,
          c.name as category_name,
          c.slug as category_slug,
          s.name as supplier_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.is_active = true
      `;

      const params = [];
      let paramCount = 0;

      // ✅ Filtre catégorie (slug ou id)
      if (category) {
        if (!isNaN(category)) {
          paramCount++;
          sql += ` AND p.category_id = $${paramCount}`;
          params.push(parseInt(category));
        } else {
          paramCount++;
          sql += ` AND c.slug = $${paramCount}`;
          params.push(category);
        }
      }

      // ✅ Filtre supplier
      if (supplier) {
        paramCount++;
        sql += ` AND p.supplier_id = $${paramCount}`;
        params.push(parseInt(supplier));
      }

      // ✅ Recherche full-text optimisée
      if (search) {
        paramCount++;
        sql += ` AND p.search_vector @@ plainto_tsquery('simple', $${paramCount})`;
        params.push(search);
      }

      // 🔥 Tri performant (utilise index)
      sql += ` ORDER BY p.created_at DESC`;

      // Pagination
      paramCount++;
      sql += ` LIMIT $${paramCount}`;
      params.push(limitNum);

      paramCount++;
      sql += ` OFFSET $${paramCount}`;
      params.push(offsetNum);

      const { rows } = await pool.query(sql, params);

      res.json({
        success: true,
        count: rows.length,
        data: rows
      });

    } catch (error) {
      console.error('ProductController Error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

}

module.exports = ProductController;
