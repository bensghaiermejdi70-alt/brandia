// supplier.controller.js

const db = require('../../config/db');
const { uploadImage, uploadVideo } = require('../../utils/cloudinary'); // uploadImage et uploadVideo
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
        if (req.file.mimetype.startsWith('image/')) {
          image = await uploadImage(req.file.buffer);
        } else if (req.file.mimetype.startsWith('video/')) {
          video = await uploadVideo(req.file.buffer);
        }
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

  /* ================= COMMANDES / PAIEMENTS ================= */

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

      if (!supplierId || !productId) {
        return res.status(400).json({
          success: false,
          message: 'supplierId et productId requis'
        });
      }

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

      if (result.rows.length === 0) {
        return res.json({ success: true, data: null, message: 'Aucune campagne active trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Public Campaigns] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaign_id } = req.body;

      if (!campaign_id) {
        return res.status(400).json({ success: false, message: 'campaign_id requis' });
      }

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

      if (!campaign_id) {
        return res.status(400).json({ success: false, message: 'campaign_id requis' });
      }

      await db.query(`UPDATE supplier_campaigns SET views_count = views_count + 1, updated_at=NOW() WHERE id=$1`, [campaign_id]);
      res.json({ success: true, message: 'Vue enregistrée' });
    } catch (error) {
      console.error('[Track View] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

/* ================= EXPORT ================= */

const controller = new SupplierController();

module.exports = {
  controller,
  uploadMiddleware: upload.single('image'), // ✅ multer inline
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
