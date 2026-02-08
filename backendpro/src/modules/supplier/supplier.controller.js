// supplier.controller.js

const db = require('../../config/db');
const { uploadImage, uploadVideo } = require('../../utils/cloudinary');
const multer = require('multer');

// Configuration multer inline (pas besoin de fichier séparé)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images et vidéos sont autorisées'), false);
    }
  }
});

class SupplierController {
  /* ================= PRODUITS ================= */
  async getProducts(req, res) {
    try {
      const { supplierId } = req.params;
      const result = await db.query('SELECT * FROM products WHERE supplier_id = $1', [supplierId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      const { name, price, stock } = req.body;
      const supplier_id = req.params.supplierId;
      let image = null;
      let video = null;

      if (req.file) {
        if (req.file.mimetype.startsWith('image/')) image = await uploadImage(req.file.buffer);
        else if (req.file.mimetype.startsWith('video/')) video = await uploadVideo(req.file.buffer);
      }

      const result = await db.query(
        `INSERT INTO products (name, price, stock, supplier_id, image, video) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, price, stock, supplier_id, image, video]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const { productId } = req.params;
      const { name, price, stock } = req.body;
      let fields = [name, price, stock];
      let query = `UPDATE products SET name=$1, price=$2, stock=$3`;
      let idx = 4;

      if (req.file) {
        if (req.file.mimetype.startsWith('image/')) {
          const image = await uploadImage(req.file.buffer);
          query += `, image=$${idx}`;
          fields.push(image);
          idx++;
        } else if (req.file.mimetype.startsWith('video/')) {
          const video = await uploadVideo(req.file.buffer);
          query += `, video=$${idx}`;
          fields.push(video);
          idx++;
        }
      }

      query += `, updated_at=NOW() WHERE id=$${idx} RETURNING *`;
      fields.push(productId);

      const result = await db.query(query, fields);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const { productId } = req.params;
      await db.query('DELETE FROM products WHERE id=$1', [productId]);
      res.json({ success: true, message: 'Produit supprimé' });
    } catch (error) {
      console.error('[Delete Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= COMMANDES ================= */
  async getOrders(req, res) {
    try {
      const supplierId = req.user.id;
      const { status } = req.query;
      let query = 'SELECT * FROM orders WHERE supplier_id = $1';
      const params = [supplierId];

      if (status && status !== 'all') {
        query += ' AND status = $2';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Orders] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOrderById(req, res) {
    try {
      const { orderId } = req.params;
      const result = await db.query('SELECT * FROM orders WHERE id=$1', [orderId]);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Get Order] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const supplierId = req.user.id;

      const result = await db.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND supplier_id = $3 RETURNING *',
        [status, id, supplierId]
      );

      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Order Status] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PAIEMENTS ================= */
  async getPayments(req, res) {
    try {
      const { supplierId } = req.params;
      const result = await db.query('SELECT * FROM payments WHERE supplier_id=$1', [supplierId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Payments] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async requestPayout(req, res) {
    try {
      const { supplierId } = req.params;
      const { amount } = req.body;
      await db.query(
        `INSERT INTO payouts (supplier_id, amount, status, created_at) VALUES ($1, $2, 'pending', NOW())`,
        [supplierId, amount]
      );
      res.json({ success: true, message: 'Demande de paiement créée' });
    } catch (error) {
      console.error('[Request Payout] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PROMOTIONS ================= */
  async getPromotions(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query(
        'SELECT * FROM promotions WHERE supplier_id = $1 ORDER BY created_at DESC',
        [supplierId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Promotions] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createPromotion(req, res) {
    try {
      const supplierId = req.user.id;
      const { name, type, value, code, max_usage, start_date, end_date } = req.body;

      const result = await db.query(
        `INSERT INTO promotions (supplier_id, name, type, value, code, max_usage, usage_count, status, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'active', $7, $8) RETURNING *`,
        [supplierId, name, type, value, code, max_usage, start_date, end_date]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Promotion] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updatePromotion(req, res) {
    try {
      const { id } = req.params;
      const supplierId = req.user.id;
      const updates = req.body;

      const result = await db.query(
        `UPDATE promotions 
         SET name = $1, type = $2, value = $3, code = $4, max_usage = $5, start_date = $6, end_date = $7, updated_at = NOW()
         WHERE id = $8 AND supplier_id = $9 RETURNING *`,
        [updates.name, updates.type, updates.value, updates.code, updates.max_usage, updates.start_date, updates.end_date, id, supplierId]
      );

      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Promotion non trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Promotion] Error:', error);
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
      console.error('[Delete Promotion] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= CAMPAGNES ================= */
  async getCampaigns(req, res) {
    try {
      const { supplierId } = req.params;
      const result = await db.query('SELECT * FROM supplier_campaigns WHERE supplier_id=$1', [supplierId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Campaigns] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createCampaign(req, res) {
    try {
      const { name, target_products, start_date, end_date, status, media_url, media_type, headline, description, cta_text, cta_link } = req.body;
      const supplier_id = req.params.supplierId;

      const result = await db.query(
        `INSERT INTO supplier_campaigns
         (supplier_id, name, target_products, start_date, end_date, status, media_url, media_type, headline, description, cta_text, cta_link)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [supplier_id, name, target_products, start_date, end_date, status, media_url, media_type, headline, description, cta_text, cta_link]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateCampaign(req, res) {
    try {
      const { campaignId } = req.params;
      const fields = req.body;
      const setQuery = Object.keys(fields)
        .map((key, idx) => `${key}=$${idx + 1}`)
        .join(', ');

      const result = await db.query(
        `UPDATE supplier_campaigns SET ${setQuery}, updated_at=NOW() WHERE id=$${Object.keys(fields).length + 1} RETURNING *`,
        [...Object.values(fields), campaignId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const { campaignId } = req.params;
      await db.query('DELETE FROM supplier_campaigns WHERE id=$1', [campaignId]);
      res.json({ success: true, message: 'Campagne supprimée' });
    } catch (error) {
      console.error('[Delete Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PUBLIC CAMPAGNES ================= */
  async getActiveCampaignForProduct(req, res) {
    try {
      const { supplierId, productId } = req.params;
      if (!supplierId || !productId) return res.status(400).json({ success: false, message: 'supplierId et productId requis' });

      const result = await db.query(`
        SELECT id, name, media_url, media_type, headline, description, cta_text, cta_link, start_date, end_date
        FROM supplier_campaigns
        WHERE supplier_id=$1
          AND $2 = ANY(target_products)
          AND status='active'
          AND start_date <= NOW()
          AND end_date >= NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [supplierId, productId]);

      if (!result.rows.length) return res.json({ success: true, data: null, message: 'Aucune campagne active trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Public Campaigns] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

      await db.query(`UPDATE supplier_campaigns SET clicks_count = clicks_count + 1, updated_at=NOW() WHERE id=$1`, [campaign_id]);
      res.json({ success: true, message: 'Clic enregistré' });
    } catch (error) {
      console.error('[Track Click] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async trackCampaignView(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

      await db.query(`UPDATE supplier_campaigns SET views_count = views_count + 1, updated_at=NOW() WHERE id=$1`, [campaign_id]);
      res.json({ success: true, message: 'Vue enregistrée' });
    } catch (error) {
      console.error('[Track View] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= UPLOADS ================= */
  async uploadImage(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Aucune image fournie' });
      const result = await uploadImage(req.file.buffer);
      res.json({ success: true, data: { url: result } });
    } catch (error) {
      console.error('[Upload Image] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async uploadCampaignVideo(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Aucune vidéo fournie' });
      const result = await uploadVideo(req.file.buffer);
      res.json({ success: true, data: { url: result } });
    } catch (error) {
      console.error('[Upload Video] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= STATS ================= */
  async getStats(req, res) {
    try {
      const supplierId = req.user.id;

      const [salesResult, ordersResult, productsResult] = await Promise.all([
        db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(*) as count FROM orders WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(*) as count FROM products WHERE supplier_id = $1 AND is_active = true', [supplierId])
      ]);

      res.json({
        success: true,
        data: {
          totalSales: parseFloat(salesResult.rows[0].total),
          totalOrders: parseInt(ordersResult.rows[0].count),
          activeProducts: parseInt(productsResult.rows[0].count)
        }
      });
    } catch (error) {
      console.error('[Get Stats] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

/* ================= EXPORT ================= */
const controller = new SupplierController();

module.exports = {
  controller,
  uploadMiddleware: upload.single('image'),
  // Produits
  getProducts: controller.getProducts.bind(controller),
  createProduct: controller.createProduct.bind(controller),
  updateProduct: controller.updateProduct.bind(controller),
  deleteProduct: controller.deleteProduct.bind(controller),
  // Commandes
  getOrders: controller.getOrders.bind(controller),
  getOrderById: controller.getOrderById.bind(controller),
  updateOrderStatus: controller.updateOrderStatus.bind(controller),
  // Paiements
  getPayments: controller.getPayments.bind(controller),
  requestPayout: controller.requestPayout.bind(controller),
  // Promotions
  getPromotions: controller.getPromotions.bind(controller),
  createPromotion: controller.createPromotion.bind(controller),
  updatePromotion: controller.updatePromotion.bind(controller),
  deletePromotion: controller.deletePromotion.bind(controller),
  // Campagnes
  getCampaigns: controller.getCampaigns.bind(controller),
  createCampaign: controller.createCampaign.bind(controller),
  updateCampaign: controller.updateCampaign.bind(controller),
  deleteCampaign: controller.deleteCampaign.bind(controller),
  getActiveCampaignForProduct: controller.get
  getActiveCampaignForProduct: controller.getActiveCampaignForProduct.bind(controller),
  trackCampaignClick: controller.trackCampaignClick.bind(controller),
  trackCampaignView: controller.trackCampaignView.bind(controller),
  // Uploads
  uploadImage: controller.uploadImage.bind(controller),
  uploadCampaignVideo: controller.uploadCampaignVideo.bind(controller),
  // Stats
  getStats: controller.getStats.bind(controller)
};
