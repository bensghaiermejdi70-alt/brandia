// ============================================
// SUPPLIER CONTROLLER - Complet et Corrigé v3.0
// ============================================

const db = require('../../config/db');
const { uploadImage, uploadVideo } = require('../../utils/cloudinary');
const multer = require('multer');

/* ================= MULTER CONFIG ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
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
      const result = await db.query(
        'SELECT * FROM products WHERE supplier_id = $1 ORDER BY created_at DESC',
        [supplierId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { name, price, stock, description, category_id } = req.body;

      const result = await db.query(
        `INSERT INTO products 
         (supplier_id, name, price, stock, description, category_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING *`,
        [supplierId, name, price, stock, description, category_id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        
        // 🔥 CORRECTION : Whitelist des champs autorisés
        const allowedFields = {
            name: req.body.name,
            price: req.body.price,
            stock_quantity: req.body.stock_quantity,
            description: req.body.description,
            category_id: req.body.category_id,
            is_active: req.body.is_active,
            main_image_url: req.body.main_image_url
        };

        // Filtrer les undefined
        const updates = {};
        for (const [key, value] of Object.entries(allowedFields)) {
            if (value !== undefined) updates[key] = value;
        }

        console.log('[UpdateProduct] Clean updates:', updates);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aucun champ valide à mettre à jour' 
            });
        }

        const fields = Object.keys(updates);
        const values = Object.values(updates);
        
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        
        const sql = `
            UPDATE products 
            SET ${setClause}, updated_at = NOW()
            WHERE id = $${fields.length + 1} AND supplier_id = $${fields.length + 2}
            RETURNING *
        `;
        
        values.push(id, supplierId);

        const result = await db.query(sql, values);

        if (!result.rows.length) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produit non trouvé ou non autorisé' 
            });
        }

        res.json({ success: true, data: result.rows[0] });
        
    } catch (error) {
        console.error('[UpdateProduct] Error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
      const supplierId = req.user.id;
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM orders WHERE id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Commande non trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Get Order By Id] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      const { status } = req.body;

      const result = await db.query(
        `UPDATE orders 
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND supplier_id = $3
         RETURNING *`,
        [status, id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Commande non trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Order Status] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PAIEMENTS ================= */

  async getPayments(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query(
        'SELECT * FROM payments WHERE supplier_id = $1 ORDER BY created_at DESC',
        [supplierId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Payments] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async requestPayout(req, res) {
    try {
      const supplierId = req.user.id;
      const { amount } = req.body;

      await db.query(
        'INSERT INTO payouts (supplier_id, amount, status) VALUES ($1, $2, $3)',
        [supplierId, amount, 'pending']
      );

      res.json({ success: true, message: 'Demande de paiement envoyée' });
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
        `INSERT INTO promotions
         (supplier_id, name, type, value, code, max_usage, usage_count, status, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6,0,'active',$7,$8)
         RETURNING *`,
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
      const supplierId = req.user.id;
      const { id } = req.params;
      const { name, type, value, code, max_usage, start_date, end_date } = req.body;

      const result = await db.query(
        `UPDATE promotions
         SET name=$1, type=$2, value=$3, code=$4, max_usage=$5,
             start_date=$6, end_date=$7, updated_at=NOW()
         WHERE id=$8 AND supplier_id=$9
         RETURNING         *`,
        [name, type, value, code, max_usage, start_date, end_date, id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Promotion non trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Promotion] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deletePromotion(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      await db.query(
        'DELETE FROM promotions WHERE id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      res.json({ success: true, message: 'Promotion supprimée' });
    } catch (error) {
      console.error('[Delete Promotion] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= CAMPAGNES ================= */

  async getCampaigns(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query(
        'SELECT * FROM supplier_campaigns WHERE supplier_id = $1 ORDER BY created_at DESC',
        [supplierId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Campaigns] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createCampaign(req, res) {
    try {
      const supplierId = req.user.id;
      const {
        name, media_url, media_type, headline,
        description, cta_text, cta_link,
        start_date, end_date, target_products
      } = req.body;

      const result = await db.query(
        `INSERT INTO supplier_campaigns
         (supplier_id, name, media_url, media_type, headline, description,
          cta_text, cta_link, start_date, end_date, target_products, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
         RETURNING *`,
        [
          supplierId, name, media_url, media_type, headline,
          description, cta_text, cta_link,
          start_date, end_date, target_products
        ]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateCampaign(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      const updates = req.body;

      const result = await db.query(
        `UPDATE supplier_campaigns
         SET name=$1, headline=$2, description=$3,
             cta_text=$4, cta_link=$5,
             start_date=$6, end_date=$7,
             updated_at=NOW()
         WHERE id=$8 AND supplier_id=$9
         RETURNING *`,
        [
          updates.name, updates.headline, updates.description,
          updates.cta_text, updates.cta_link,
          updates.start_date, updates.end_date,
          id, supplierId
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      await db.query(
        'DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

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

      const result = await db.query(
        `SELECT *
         FROM supplier_campaigns
         WHERE supplier_id = $1
           AND $2 = ANY(target_products)
           AND status = 'active'
           AND start_date <= NOW()
           AND end_date >= NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [supplierId, productId]
      );

      res.json({
        success: true,
        data: result.rows[0] || null
      });
    } catch (error) {
      console.error('[Get Active Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaign_id } = req.body;

      await db.query(
        'UPDATE supplier_campaigns SET clicks_count = clicks_count + 1 WHERE id = $1',
        [campaign_id]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[Track Campaign Click] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async trackCampaignView(req, res) {
    try {
      const { campaign_id } = req.body;

      await db.query(
        'UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1',
        [campaign_id]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[Track Campaign View] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= UPLOADS ================= */

  async uploadImage(req, res) {
    try {
      console.log('[Upload Image] Request received');
      
      if (!req.file) {
        console.error('[Upload Image] No file provided');
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun fichier fourni' 
        });
      }

      console.log('[Upload Image] File info:', {
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      });

      const result = await uploadImage(req.file.buffer);
      
      res.json({ 
        success: true, 
        data: { 
          url: result.url || result,
          type: 'image'
        } 
      });
    } catch (error) {
      console.error('[Upload Image] Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur upload image: ' + error.message 
      });
    }
  }

  async uploadCampaignVideo(req, res) {
    try {
      console.log('[Upload Video] Request received');
      
      if (!req.file) {
        console.error('[Upload Video] No file provided');
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun fichier vidéo fourni' 
        });
      }

      console.log('[Upload Video] File info:', {
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      });

      if (!req.file.mimetype.startsWith('video/')) {
        console.error('[Upload Video] Invalid mimetype:', req.file.mimetype);
        return res.status(400).json({ 
          success: false, 
          message: 'Le fichier doit être une vidéo (MP4, WebM)' 
        });
      }

      console.log('[Upload Video] Uploading to Cloudinary...');
      const result = await uploadVideo(req.file.buffer);
      console.log('[Upload Video] Cloudinary success:', result.url || result);

      res.json({ 
        success: true, 
        data: { 
          url: result.url || result,
          type: 'video',
          thumbnailUrl: result.thumbnailUrl
        } 
      });
    } catch (error) {
      console.error('[Upload Video] Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur upload vidéo: ' + error.message 
      });
    }
  }

  /* ================= STATS ================= */

  async getStats(req, res) {
    try {
      const supplierId = req.user.id;

      const [sales, orders, products] = await Promise.all([
        db.query('SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE supplier_id=$1', [supplierId]),
        db.query('SELECT COUNT(*) FROM orders WHERE supplier_id=$1', [supplierId]),
        db.query('SELECT COUNT(*) FROM products WHERE supplier_id=$1 AND is_active=true', [supplierId])
      ]);

      res.json({
        success: true,
        data: {
          totalSales: Number(sales.rows[0].coalesce),
          totalOrders: Number(orders.rows[0].count),
          activeProducts: Number(products.rows[0].count)
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
  uploadMiddleware: upload.single('media'),

  getProducts: controller.getProducts.bind(controller),
  createProduct: controller.createProduct.bind(controller),
  updateProduct: controller.updateProduct.bind(controller),
  deleteProduct: controller.deleteProduct.bind(controller),

  getOrders: controller.getOrders.bind(controller),
  getOrderById: controller.getOrderById.bind(controller),
  updateOrderStatus: controller.updateOrderStatus.bind(controller),

  getPayments: controller.getPayments.bind(controller),
  requestPayout: controller.requestPayout.bind(controller),

  getPromotions: controller.getPromotions.bind(controller),
  createPromotion: controller.createPromotion.bind(controller),
  updatePromotion: controller.updatePromotion.bind(controller),
  deletePromotion: controller.deletePromotion.bind(controller),

  getCampaigns: controller.getCampaigns.bind(controller),
  createCampaign: controller.createCampaign.bind(controller),
  updateCampaign: controller.updateCampaign.bind(controller),
  deleteCampaign: controller.deleteCampaign.bind(controller),

  getActiveCampaignForProduct: controller.getActiveCampaignForProduct.bind(controller),
  trackCampaignClick: controller.trackCampaignClick.bind(controller),
  trackCampaignView: controller.trackCampaignView.bind(controller),

  uploadImage: controller.uploadImage.bind(controller),
  uploadCampaignVideo: controller.uploadCampaignVideo.bind(controller),

  getStats: controller.getStats.bind(controller)
};