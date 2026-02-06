const db = require('../../config/db');
const { uploadImage, uploadVideo } = require('../../utils/cloudinary');
const multer = require('multer');

// ===============================
// MULTER
// ===============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images ou vidéos sont autorisées'), false);
    }
  }
});

class SupplierController {

  // ===============================
  // UPLOAD
  // ===============================
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
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
        return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
      }
      const result = await uploadVideo(req.file.buffer, 'brandia/campaigns');
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ===============================
  // STATS
  // ===============================
  async getStats(req, res) {
    try {
      const supplierId = req.user.id;

      const result = await db.query(`
        SELECT
          COALESCE(SUM(o.total_amount), 0) AS total_sales,
          COUNT(o.id) AS total_orders,
          COUNT(DISTINCT p.id) AS products_count
        FROM orders o
        LEFT JOIN products p ON p.supplier_id = $1
        WHERE o.supplier_id = $1
          AND o.status IN ('shipped', 'delivered')
      `, [supplierId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ===============================
  // COMMANDES (FIX FINAL)
  // ===============================
  async getOrders(req, res) {
    try {
      const supplierId = req.user.id;
      const { status } = req.query;

      let query = `
        SELECT
          o.id,
          o.order_number,
          o.total_amount,
          o.status,
          o.payment_status,
          o.created_at,
          u.first_name AS customer_name,
          u.email AS customer_email
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.supplier_id = $1
      `;

      const params = [supplierId];

      // 🔥 FILTRE STATUS UNIQUE ET PROPRE
      if (status && status !== 'all') {
        query += ` AND o.status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY o.created_at DESC`;

      const ordersResult = await db.query(query, params);

      // ===============================
      // COMPTEURS COHÉRENTS
      // ===============================
      const countsResult = await db.query(`
        SELECT
          COUNT(*) AS all_count,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
          COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_count,
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_count
        FROM orders
        WHERE supplier_id = $1
      `, [supplierId]);

      const counts = countsResult.rows[0];

      res.json({
        success: true,
        data: {
          orders: ordersResult.rows,
          counts: {
            all: Number(counts.all_count),
            pending: Number(counts.pending_count),
            shipped: Number(counts.shipped_count),
            delivered: Number(counts.delivered_count)
          }
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ===============================
  // UPDATE STATUS
  // ===============================
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
}

const controller = new SupplierController();

module.exports = {
  controller,
  uploadMiddleware: upload.single('image')
};
