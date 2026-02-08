// supplier.controller.js

const db = require('../../config/db');
const { uploadImage, uploadVideo } = require('../../utils/cloudinary');
const multer = require('multer');

// Configuration multer inline
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

class SupplierController {
  /* ================= PRODUITS ================= */

  async getProducts(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query('SELECT * FROM products WHERE supplier_id = $1 AND is_active = true ORDER BY created_at DESC', [supplierId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createProduct(req, res) { /* ...implémentation existante... */ }
  async updateProduct(req, res) { /* ...implémentation existante... */ }
  async deleteProduct(req, res) { /* ...implémentation existante... */ }

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

  async getOrderById(req, res) { /* ...implémentation existante... */ }
  async updateOrderStatus(req, res) { /* ...implémentation existante... */ }

  /* ================= PAIEMENTS ================= */

  async getPayments(req, res) { /* ...implémentation existante... */ }
  async requestPayout(req, res) { /* ...implémentation existante... */ }

  /* ================= PROMOTIONS ================= */

  async getPromotions(req, res) { /* ...implémentation complète ... */ }
  async createPromotion(req, res) { /* ...implémentation complète ... */ }
  async updatePromotion(req, res) { /* ...implémentation complète ... */ }
  async deletePromotion(req, res) { /* ...implémentation complète ... */ }

  /* ================= CAMPAGNES ================= */

  async getCampaigns(req, res) { /* ...implémentation existante... */ }
  async createCampaign(req, res) { /* ...implémentation existante... */ }
  async updateCampaign(req, res) { /* ...implémentation existante... */ }
  async deleteCampaign(req, res) { /* ...implémentation existante... */ }

  /* ================= PUBLIC CAMPAGNES ================= */

  async getActiveCampaignForProduct(req, res) {
    try {
      const { supplierId, productId } = req.params;
      if (!supplierId || !productId) {
        return res.status(400).json({ success: false, message: 'supplierId et productId requis' });
      }
      const result = await db.query(`
        SELECT id, name, media_url, media_type, headline, description, cta_text, cta_link, start_date, end_date
        FROM supplier_campaigns
        WHERE supplier_id = $1
          AND $2 = ANY(target_products)
          AND status = 'active'
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
      res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de la campagne' });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });
      await db.query('UPDATE supplier_campaigns SET clicks_count = clicks_count + 1, updated_at = NOW() WHERE id = $1', [campaign_id]);
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
      await db.query('UPDATE supplier_campaigns SET views_count = views_count + 1, updated_at = NOW() WHERE id = $1', [campaign_id]);
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

// ================= EXPORT =================

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
  trackCampaignView: controller.trackCampaignView.bind(controller),
  getActiveCampaignForProduct: controller.getActiveCampaignForProduct.bind(controller),
  trackCampaignClick: controller.trackCampaignClick.bind(controller),

  // Uploads
  uploadImage: controller.uploadImage.bind(controller),
  uploadCampaignVideo: controller.uploadCampaignVideo.bind(controller),

  // Stats
  getStats: controller.getStats.bind(controller)
};
