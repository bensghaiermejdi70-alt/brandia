// ============================================
// SUPPLIER CONTROLLER - v7.0 PRODUCTION
// Changes: 5 campaigns limit, auto-target all products, limit management
// ============================================
const db = require("../../config/db");

// Configuration Cloudinary (inchangée)
let cloudinary, CloudinaryStorage, multer;
let uploadImageMiddleware, uploadVideoMiddleware;

try {
  cloudinary = require('cloudinary').v2;
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
  multer = require('multer');

  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const imageStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'brandia/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }]
      }
    });

    const videoStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'brandia/campaigns',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm'],
        transformation: [{ width: 720, crop: 'limit', quality: 'auto:good' }]
      }
    });

    uploadImageMiddleware = multer({
      storage: imageStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) cb(null, true);
        else cb(new Error('Format image non supporté'));
      }
    }).single('media');

    uploadVideoMiddleware = multer({
      storage: videoStorage,
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|mov|webm/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) cb(null, true);
        else cb(new Error('Format vidéo non supporté'));
      }
    }).single('media');

    console.log('[Supplier Controller] ✅ Cloudinary configured');
  } else {
    throw new Error('Cloudinary env vars not configured');
  }
} catch (err) {
  console.warn('[Supplier Controller] ⚠️ Cloudinary not available:', err.message);
  // Fallback local...
  try {
    multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      }
    });

    const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
    uploadImageMiddleware = upload.single('media');
    uploadVideoMiddleware = upload.single('media');
  } catch (multerErr) {
    uploadImageMiddleware = (req, res, next) => next();
    uploadVideoMiddleware = (req, res, next) => next();
  }
}

class SupplierController {
  // ... (méthodes précédentes inchangées: getPayments, requestPayout, getPayouts, uploadImage, uploadCampaignVideo, getProducts, createProduct, updateProduct, deleteProduct, getOrders, getOrderById, updateOrderStatus, getPromotions, createPromotion, updatePromotion, deletePromotion, getStats, getAdSettings)

  /* ================= NOUVELLE MÉTHODE: LIMITE CAMPAGNES ================= */

  async getCampaignLimit(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;

      // Récupérer la limite configurée (défaut: 5)
      const settingsResult = await db.query(
        'SELECT max_campaigns FROM supplier_ad_settings WHERE supplier_id = $1',
        [supplierId]
      );
      
      const maxCampaigns = settingsResult.rows[0]?.max_campaigns || 5;

      // Compter les campagnes actives
      const countResult = await db.query(
        'SELECT COUNT(*) as count FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2',
        [supplierId, 'active']
      );

      const current = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          current: current,
          max: maxCampaigns,
          can_create: current < maxCampaigns
        }
      });
    } catch (error) {
      console.error('[Get Campaign Limit] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  /* ================= CAMPAGNES MODIFIÉES ================= */

  async getCampaigns(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(
        `SELECT
          sc.*,
          COALESCE(cs.total_views, 0) as views_count,
          COALESCE(cs.total_clicks, 0) as clicks_count
        FROM supplier_campaigns sc
        LEFT JOIN (
          SELECT
            campaign_id,
            SUM(impressions) as total_views,
            SUM(clicks) as total_clicks
          FROM campaign_stats
          GROUP BY campaign_id
        ) cs ON cs.campaign_id = sc.id
        WHERE sc.supplier_id = $1
        ORDER BY sc.created_at DESC`,
        [supplierId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Campaigns] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async createCampaign(req, res) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const userId = req.user?.id;
      if (!userId) {
        await client.query('ROLLBACK');
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const supplierResult = await client.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (supplierResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;

      // NOUVEAU: Vérifier la limite de campagnes
      const settingsResult = await client.query(
        'SELECT max_campaigns FROM supplier_ad_settings WHERE supplier_id = $1',
        [supplierId]
      );
      const maxCampaigns = settingsResult.rows[0]?.max_campaigns || 5;

      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2',
        [supplierId, 'active']
      );
      
      if (parseInt(countResult.rows[0].count) >= maxCampaigns) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Limite de ${maxCampaigns} campagnes atteinte. Contactez l'administrateur pour augmenter votre quota.`
        });
      }

      const {
        name, media_url, media_type, headline,
        description, cta_text, cta_link,
        start_date, end_date, target_products
      } = req.body;

      if (!name || !headline) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Nom et titre sont obligatoires'
        });
      }

      // MODIFIÉ: Si target_products est null/vide, récupérer TOUS les produits du fournisseur
      let finalTargetProducts = target_products;
      if (!target_products || (Array.isArray(target_products) && target_products.length === 0)) {
        const productsResult = await client.query(
          'SELECT id FROM products WHERE supplier_id = $1 AND is_active = true',
          [supplierId]
        );
        finalTargetProducts = productsResult.rows.map(p => p.id);
        
        if (finalTargetProducts.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Vous devez avoir au moins un produit actif pour créer une campagne'
          });
        }
      }

      const result = await client.query(
        `INSERT INTO supplier_campaigns
        (supplier_id, name, media_url, media_type, headline, description,
        cta_text, cta_link, start_date, end_date, target_products, status, views_count, clicks_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',0,0)
        RETURNING *`,
        [
          supplierId, name, media_url, media_type || 'image', headline,
          description, cta_text, cta_link,
          start_date, end_date, finalTargetProducts
        ]
      );

      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Create Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
      client.release();
    }
  }

  async updateCampaign(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const { id } = req.params;
      const updates = req.body;

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;

      const allowedFields = [
        'name', 'headline', 'description', 'cta_text', 'cta_link',
        'media_url', 'media_type', 'start_date', 'end_date',
        'target_products', 'status', 'budget', 'daily_budget'
      ];

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          // MODIFIÉ: Si target_products devient vide/null, ne pas mettre à jour (garde l'existant)
          if (field === 'target_products' && (!updates[field] || updates[field].length === 0)) {
            continue;
          }
          setClauses.push(`${field} = $${paramIndex}`);
          values.push(updates[field]);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ success: false, message: 'Aucun champ valide à mettre à jour' });
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id, supplierId);

      const sql = `
        UPDATE supplier_campaigns
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND supplier_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await db.query(sql, values);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Campagne non trouvée ou non autorisée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const { id } = req.params;

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;

      const checkResult = await db.query(
        'SELECT id FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Campagne non trouvée ou non autorisée' });
      }

      await db.query('DELETE FROM campaign_stats WHERE campaign_id = $1', [id]);
      await db.query('DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2', [id, supplierId]);

      res.json({ success: true, message: 'Campagne supprimée définitivement' });
    } catch (error) {
      console.error('[Delete Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async toggleCampaignStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const { id } = req.params;
      const { status } = req.body;

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;

      // MODIFIÉ: Ne plus désactiver les autres campagnes (permet jusqu'à 5 actives)
      // Suppression du bloc qui mettait les autres en 'paused'

      const result = await db.query(
        `UPDATE supplier_campaigns SET status = $1, updated_at = NOW()
        WHERE id = $2 AND supplier_id = $3 RETURNING *`,
        [status, id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Toggle Campaign Status] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  /* ================= PUBLIC CAMPAGNES MODIFIÉES ================= */

  async getActiveCampaignForProduct(req, res) {
    try {
      const { supplier, product } = req.query;
      if (!supplier || !product) {
        return res.status(400).json({ success: false, message: 'supplier et product sont requis' });
      }

      // MODIFIÉ: Récupérer TOUTES les campagnes actives du fournisseur (pas seulement celle qui cible le produit spécifique)
      // car maintenant une campagne cible tous les produits du fournisseur
      const result = await db.query(
        `SELECT * FROM supplier_campaigns
        WHERE supplier_id = $1
        AND status = 'active'
        AND start_date <= NOW()
        AND end_date >= NOW()
        AND (target_products IS NULL OR $2 = ANY(target_products) OR array_length(target_products, 1) IS NULL)
        ORDER BY created_at DESC`,
        [supplier, product]
      );

      // Retourner un tableau (même s'il n'y en a qu'une, pour supporter jusqu'à 5)
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Active Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) {
        return res.status(400).json({ success: false, message: 'campaign_id est requis' });
      }

      await db.query(
        'UPDATE supplier_campaigns SET clicks_count = clicks_count + 1 WHERE id = $1',
        [campaign_id]
      );

      await db.query(`
        INSERT INTO campaign_stats (campaign_id, date, clicks)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (campaign_id, date)
        DO UPDATE SET clicks = campaign_stats.clicks + 1
      `, [campaign_id]);

      res.json({ success: true });
    } catch (error) {
      console.error('[Track Campaign Click] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async trackCampaignView(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) {
        return res.status(400).json({ success: false, message: 'campaign_id est requis' });
      }

      await db.query(
        'UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1',
        [campaign_id]
      );

      await db.query(`
        INSERT INTO campaign_stats (campaign_id, date, impressions)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (campaign_id, date)
        DO UPDATE SET impressions = campaign_stats.impressions + 1
      `, [campaign_id]);

      res.json({ success: true });
    } catch (error) {
      console.error('[Track Campaign View] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
}

// Export
const controller = new SupplierController();

module.exports.uploadImageMiddleware = uploadImageMiddleware;
module.exports.uploadVideoMiddleware = uploadVideoMiddleware;

// Toutes les méthodes exportées
module.exports.getPayments = controller.getPayments.bind(controller);
module.exports.requestPayout = controller.requestPayout.bind(controller);
module.exports.getPayouts = controller.getPayouts.bind(controller);
module.exports.uploadImage = controller.uploadImage.bind(controller);
module.exports.uploadCampaignVideo = controller.uploadCampaignVideo.bind(controller);
module.exports.getProducts = controller.getProducts.bind(controller);
module.exports.createProduct = controller.createProduct.bind(controller);
module.exports.updateProduct = controller.updateProduct.bind(controller);
module.exports.deleteProduct = controller.deleteProduct.bind(controller);
module.exports.getOrders = controller.getOrders.bind(controller);
module.exports.getOrderById = controller.getOrderById.bind(controller);
module.exports.updateOrderStatus = controller.updateOrderStatus.bind(controller);
module.exports.getPromotions = controller.getPromotions.bind(controller);
module.exports.createPromotion = controller.createPromotion.bind(controller);
module.exports.updatePromotion = controller.updatePromotion.bind(controller);
module.exports.deletePromotion = controller.deletePromotion.bind(controller);
module.exports.getCampaigns = controller.getCampaigns.bind(controller);
module.exports.createCampaign = controller.createCampaign.bind(controller);
module.exports.updateCampaign = controller.updateCampaign.bind(controller);
module.exports.deleteCampaign = controller.deleteCampaign.bind(controller);
module.exports.toggleCampaignStatus = controller.toggleCampaignStatus.bind(controller);
module.exports.getActiveCampaignForProduct = controller.getActiveCampaignForProduct.bind(controller);
module.exports.trackCampaignClick = controller.trackCampaignClick.bind(controller);
module.exports.trackCampaignView = controller.trackCampaignView.bind(controller);
module.exports.getStats = controller.getStats.bind(controller);
module.exports.getAdSettings = controller.getAdSettings.bind(controller);
// NOUVEAU
module.exports.getCampaignLimit = controller.getCampaignLimit.bind(controller);

console.log('[Supplier Controller] ✅ v7.0 loaded - 5 campaigns limit support');