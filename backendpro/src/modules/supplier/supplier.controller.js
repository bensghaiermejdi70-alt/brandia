const db = require('../../config/db');
const { uploadImage } = require('../../utils/cloudinary');
const multer = require('multer');

// Configuration multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images et vidéos sont autorisées'), false);
    }
  }
});

// Email optionnel
let sendEmail = null;
try {
  const emailModule = require('../../utils/email');
  sendEmail = emailModule.sendEmail;
} catch (e) {
  sendEmail = async () => ({ success: true, mock: true });
}

// ==========================================
// CLASSE CONTROLLER
// ==========================================

class SupplierController {
  /* ================= PROMOTIONS (MANQUANTES) ================= */
  async updatePromotion(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
    const updates = req.body;
        
    const result = await db.query(`
      UPDATE promotions 
      SET name = $1, type = $2, value = $3, code = $4, 
        max_usage = $5, start_date = $6, end_date = $7, updated_at = NOW()
      WHERE id = $8 AND supplier_id = $9
      RETURNING *
    `, [updates.name, updates.type, updates.value, updates.code, 
      updates.max_usage, updates.start_date, updates.end_date, id, supplierId]);
        
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Promotion non trouvée' });
    }
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async deletePromotion(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
        
    await db.query('DELETE FROM promotions WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
    res.json({ success: true, message: 'Promotion supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  /* ================= PRODUITS (MANQUANTES) ================= */
  async getProducts(req, res) {
  try {
    const supplierId = req.user.id;
    const result = await db.query(`
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.supplier_id = $1
      ORDER BY p.created_at DESC
    `, [supplierId]);
        
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async createProduct(req, res) {
  try {
    const supplierId = req.user.id;
    const { name, description, price, stock_quantity, category_id, main_image_url } = req.body;
        
    const result = await db.query(`
      INSERT INTO products (supplier_id, name, description, price, stock_quantity, category_id, main_image_url, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      RETURNING *
    `, [supplierId, name, description, price, stock_quantity, category_id, main_image_url]);
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async updateProduct(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
    const updates = req.body;
        
    const result = await db.query(`
      UPDATE products 
      SET name = $1, description = $2, price = $3, stock_quantity = $4, 
        category_id = $5, main_image_url = $6, updated_at = NOW()
      WHERE id = $7 AND supplier_id = $8
      RETURNING *
    `, [updates.name, updates.description, updates.price, updates.stock_quantity,
      updates.category_id, updates.main_image_url, id, supplierId]);
        
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
        
    await db.query('DELETE FROM products WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  /* ================= COMMANDES (MANQUANTES) ================= */
  async getOrderById(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
        
    const result = await db.query(`
      SELECT o.*, u.first_name, u.email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 AND o.supplier_id = $2
    `, [id, supplierId]);
        
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  /* ================= PAIEMENTS (MANQUANTES) ================= */
  async getPayments(req, res) {
  try {
    const supplierId = req.user.id;
    const result = await db.query(`
      SELECT * FROM supplier_payments 
      WHERE supplier_id = $1 
      ORDER BY created_at DESC
    `, [supplierId]);
        
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async requestPayout(req, res) {
  try {
    const supplierId = req.user.id;
    const { amount } = req.body;
        
    // Vérifier le solde disponible
    const balanceResult = await db.query(`
      SELECT COALESCE(SUM(supplier_amount), 0) as balance
      FROM supplier_payments
      WHERE supplier_id = $1 AND status = 'available'
    `, [supplierId]);
        
    const balance = parseFloat(balanceResult.rows[0].balance);
        
    if (amount > balance) {
      return res.status(400).json({ 
        success: false, 
        message: 'Solde insuffisant' 
      });
    }
        
    const result = await db.query(`
      INSERT INTO payouts (supplier_id, amount, status, created_at)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING *
    `, [supplierId, amount]);
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  /* ================= CAMPAGNES (MANQUANTES) ================= */
  async getCampaigns(req, res) {
  try {
    const supplierId = req.user.id;
    const result = await db.query(`
      SELECT * FROM supplier_campaigns 
      WHERE supplier_id = $1 
      ORDER BY created_at DESC
    `, [supplierId]);
        
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async createCampaign(req, res) {
  try {
    const supplierId = req.user.id;
    const { name, media_url, media_type, headline, description, cta_text, cta_link, target_products, start_date, end_date } = req.body;
        
    const result = await db.query(`
      INSERT INTO supplier_campaigns 
      (supplier_id, name, media_url, media_type, headline, description, cta_text, cta_link, target_products, status, start_date, end_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, NOW())
      RETURNING *
    `, [supplierId, name, media_url, media_type, headline, description, cta_text, cta_link, target_products || [], start_date, end_date]);
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async updateCampaign(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
    const updates = req.body;
        
    const result = await db.query(`
      UPDATE supplier_campaigns 
      SET name = $1, headline = $2, description = $3, cta_text = $4, 
        cta_link = $5, status = $6, updated_at = NOW()
      WHERE id = $7 AND supplier_id = $8
      RETURNING *
    `, [updates.name, updates.headline, updates.description, updates.cta_text,
      updates.cta_link, updates.status, id, supplierId]);
        
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }
        
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async deleteCampaign(req, res) {
  try {
    const { id } = req.params;
    const supplierId = req.user.id;
        
    await db.query('DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  /* ================= PUBLIC CAMPAGNES (MANQUANTES) ================= */
  async getActiveCampaignForProduct(req, res) {
  try {
    const { supplierId, productId } = req.params;
        
    const result = await db.query(`
      SELECT * FROM supplier_campaigns 
      WHERE supplier_id = $1 
      AND $2 = ANY(target_products)
      AND status = 'active'
      AND start_date <= NOW()
      AND end_date >= NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [supplierId, productId]);
        
    res.json({ 
      success: true, 
      data: result.rows[0] || null 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async trackCampaignClick(req, res) {
  try {
    const { campaign_id } = req.body;
        
    await db.query(`
      UPDATE supplier_campaigns 
      SET clicks_count = clicks_count + 1 
      WHERE id = $1
    `, [campaign_id]);
        
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  async trackCampaignView(req, res) {
  try {
    const { campaign_id } = req.body;
        
    await db.query(`
      UPDATE supplier_campaigns 
      SET views_count = views_count + 1 
      WHERE id = $1
    `, [campaign_id]);
        
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  }

  /* ================= UPLOADS ================= */

  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucune image fournie' });
      }
      const result = await uploadImage(req.file.buffer, 'brandia/products');
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async uploadCampaignVideo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucune vidéo fournie' });
      }
      const { uploadVideo } = require('../../utils/cloudinary');
      const result = await uploadVideo(req.file.buffer, 'brandia/campaigns');
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= DASHBOARD ================= */

  async getStats(req, res) {
    try {
      const supplierId = req.user.id;

      const stats = await db.query(`
        SELECT 
          COALESCE(SUM(o.total_amount), 0) AS total_sales,
          COUNT(o.id) AS total_orders
        FROM orders o
        WHERE o.supplier_id = $1
      `, [supplierId]);

      res.json({
        success: true,
        data: {
          totalSales: Number(stats.rows[0].total_sales),
          totalOrders: Number(stats.rows[0].total_orders)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= COMMANDES ================= */

  async getOrders(req, res) {
    try {
      const supplierId = req.user.id;
      const { status } = req.query;

      let query = `
        SELECT o.*, u.first_name, u.email
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.supplier_id = $1
      `;
      const params = [supplierId];

      if (status && status !== 'all') {
        query += ` AND o.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY o.created_at DESC`;

      const result = await db.query(query, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      const { status } = req.body;

      const result = await db.query(`
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND supplier_id = $3
        RETURNING *
      `, [status, id, supplierId]);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Commande introuvable' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PROMOTIONS ================= */

  async getPromotions(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query(
        `SELECT * FROM promotions WHERE supplier_id = $1 ORDER BY created_at DESC`,
        [supplierId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createPromotion(req, res) {
    try {
      const supplierId = req.user.id;
      const { name, type, value, code, max_usage, start_date, end_date } = req.body;

      const exists = await db.query(
        `SELECT id FROM promotions WHERE code = $1`,
        [code]
      );

      if (exists.rows.length) {
        return res.status(400).json({ success: false, message: 'Code promo déjà utilisé' });
      }

      const result = await db.query(`
        INSERT INTO promotions 
        (supplier_id, name, type, value, code, max_usage, usage_count, status, start_date, end_date)
        VALUES ($1,$2,$3,$4,$5,$6,0,'active',$7,$8)
        RETURNING *
      `, [supplierId, name, type, value, code, max_usage || null, start_date, end_date]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= VALIDATION PROMO ================= */

  async validatePromotion(req, res) {
    try {
      const { code, productIds, totalAmount } = req.body;

      const promoRes = await db.query(`
        SELECT * FROM promotions
        WHERE code = $1
          AND status = 'active'
          AND start_date <= CURRENT_DATE
          AND end_date >= CURRENT_DATE
          AND (max_usage IS NULL OR usage_count < max_usage)
        LIMIT 1
      `, [code]);

      if (!promoRes.rows.length) {
        return res.status(400).json({ success: false, message: 'Code promo invalide' });
      }

      const promo = promoRes.rows[0];
      let discount = 0;

      if (promo.type === 'percentage') {
        discount = totalAmount * (promo.value / 100);
      } else {
        discount = Math.min(promo.value, totalAmount);
      }

      res.json({
        success: true,
        data: {
          promo_id: promo.id,
          discount,
          final_amount: totalAmount - discount
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async incrementPromoUsage(promoId) {
    try {
      await db.query(`
        UPDATE promotions 
        SET usage_count = usage_count + 1
        WHERE id = $1
      `, [promoId]);
    } catch (e) {
      console.error('Promo usage increment error:', e.message);
    }
  }
}

/* ================= EXPORT ================= */

const controller = new SupplierController();

module.exports = {
  controller,
  uploadMiddleware: upload.single('image'),
  // Export direct des méthodes pour usage routeur si besoin
  updatePromotion: controller.updatePromotion.bind(controller),
  deletePromotion: controller.deletePromotion.bind(controller),
  getProducts: controller.getProducts.bind(controller),
  createProduct: controller.createProduct.bind(controller),
  updateProduct: controller.updateProduct.bind(controller),
  deleteProduct: controller.deleteProduct.bind(controller),
  getOrderById: controller.getOrderById.bind(controller),
  getPayments: controller.getPayments.bind(controller),
  requestPayout: controller.requestPayout.bind(controller),
  getCampaigns: controller.getCampaigns.bind(controller),
  createCampaign: controller.createCampaign.bind(controller),
  updateCampaign: controller.updateCampaign.bind(controller),
  deleteCampaign: controller.deleteCampaign.bind(controller),
  getActiveCampaignForProduct: controller.getActiveCampaignForProduct.bind(controller),
  trackCampaignClick: controller.trackCampaignClick.bind(controller),
  trackCampaignView: controller.trackCampaignView.bind(controller)
};
