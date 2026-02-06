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
  uploadMiddleware: upload.single('image')
};
