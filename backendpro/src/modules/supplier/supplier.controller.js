// ============================================
// SUPPLIER CONTROLLER - v7.2 DEFENSIVE
// Fix: Vérification exhaustive avant chaque bind
// ============================================
const db = require("../../config/db");

// Configuration Cloudinary
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

// ============================================
// CLASSE CONTROLLER AVEC TOUTES LES MÉTHODES
// ============================================
class SupplierController {
  
  constructor() {
    console.log('[SupplierController] Instance created');
  }

  // ==================== PAIEMENTS ====================
  
  async getPayments(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const balanceResult = await db.query(`
        SELECT COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) as available_balance,
               COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_balance,
               COALESCE(SUM(amount), 0) as total_earnings
        FROM supplier_payments WHERE supplier_id = $1
      `, [supplierId]);

      const transactionsResult = await db.query(`
        SELECT sp.* FROM supplier_payments sp WHERE sp.supplier_id = $1 ORDER BY sp.created_at DESC LIMIT 100
      `, [supplierId]);

      res.json({
        success: true,
        data: {
          balance: {
            available: parseFloat(balanceResult.rows[0].available_balance) || 0,
            pending: parseFloat(balanceResult.rows[0].pending_balance) || 0,
            total: parseFloat(balanceResult.rows[0].total_earnings) || 0
          },
          transactions: transactionsResult.rows
        }
      });
    } catch (error) {
      console.error('[Get Payments] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async requestPayout(req, res) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const userId = req.user?.id;
      if (!userId) {
        await client.query('ROLLBACK');
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Montant invalide' });
      }

      const supplierResult = await client.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;
      const balanceResult = await client.query('SELECT COALESCE(SUM(amount), 0) as available FROM supplier_payments WHERE supplier_id = $1 AND status = $2', [supplierId, 'available']);
      
      const available = parseFloat(balanceResult.rows[0].available) || 0;
      if (parseFloat(amount) > available) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Solde insuffisant. Disponible: ${available.toFixed(2)}€` });
      }

      const payoutResult = await client.query('INSERT INTO payouts (supplier_id, amount, status, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *', [supplierId, amount, 'pending']);
      await client.query('UPDATE supplier_payments SET status = $1, payout_id = $2, updated_at = NOW() WHERE supplier_id = $3 AND status = $4', ['payout_requested', payoutResult.rows[0].id, supplierId, 'available']);
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'Demande de virement créée', data: { payout_id: payoutResult.rows[0].id, amount: parseFloat(amount), status: 'pending' } });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Request Payout] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
      client.release();
    }
  }

  async getPayouts(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('SELECT * FROM payouts WHERE supplier_id = $1 ORDER BY created_at DESC', [supplierId]);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Payouts] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== UPLOADS ====================

  async uploadImage(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
      
      let fileUrl = req.file.path || req.file.filename;
      if (req.file.filename && !req.file.path) {
        const baseUrl = process.env.FRONTEND_PRODUCTION_URL || process.env.FRONTEND_URL || '';
        fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
      }

      res.json({ success: true, data: { url: fileUrl, public_id: req.file.filename || req.file.public_id } });
    } catch (error) {
      console.error('[Upload Image] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async uploadCampaignVideo(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
      
      let fileUrl = req.file.path || req.file.filename;
      if (req.file.filename && !req.file.path) {
        const baseUrl = process.env.FRONTEND_PRODUCTION_URL || process.env.FRONTEND_URL || '';
        fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
      }

      res.json({ success: true, data: { url: fileUrl, public_id: req.file.filename || req.file.public_id } });
    } catch (error) {
      console.error('[Upload Video] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==================== PRODUITS ====================

  async getProducts(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('SELECT * FROM products WHERE supplier_id = $1 ORDER BY created_at DESC', [supplierId]);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async createProduct(req, res) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const userId = req.user?.id;
      if (!userId) {
        await client.query('ROLLBACK');
        return res.status(401).json({ success: false, message: 'Non authentifié' });
      }

      const supplierResult = await client.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }

      const supplierId = supplierResult.rows[0].id;
      const { name, price, stock_quantity, description, category_id, main_image_url, sku, compare_price } = req.body;

      if (!name || name.trim().length < 2) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Le nom doit contenir au moins 2 caractères' });
      }

      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${Date.now()}`;

      const result = await client.query(`
        INSERT INTO products (supplier_id, name, price, stock_quantity, description, category_id, main_image_url, is_active, slug, sku, compare_price, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, NOW(), NOW()) RETURNING *
      `, [supplierId, name.trim(), price, stock_quantity || 0, description?.trim() || '', category_id, main_image_url, slug, sku?.trim() || null, compare_price || null]);

      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Create Product] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
      client.release();
    }
  }

  async updateProduct(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const allowedFields = ['name', 'price', 'stock_quantity', 'description', 'category_id', 'is_active', 'main_image_url', 'sku', 'compare_price'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
      }

      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      values.push(id, supplierId);

      const result = await db.query(`UPDATE products SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} AND supplier_id = $${fields.length + 2} RETURNING *`, values);
      
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Produit non trouvé' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Product] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async deleteProduct(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('DELETE FROM products WHERE id = $1 AND supplier_id = $2 RETURNING id, name', [id, supplierId]);
      
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Produit non trouvé' });
      res.json({ success: true, message: 'Produit supprimé', data: result.rows[0] });
    } catch (error) {
      console.error('[Delete Product] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== COMMANDES ====================

  async getOrders(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query(`
        SELECT o.* FROM orders o 
        INNER JOIN order_items oi ON o.id = oi.order_id 
        WHERE oi.supplier_id = $1 
        ORDER BY o.created_at DESC
      `, [supplierId]);

      res.json({ success: true, data: { orders: result.rows, counts: { all: result.rows.length, pending: 0, shipped: 0, delivered: 0, cancelled: 0 } } });
    } catch (error) {
      console.error('[Get Orders] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async getOrderById(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
      
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Get Order By Id] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const { status } = req.body;
      
      const result = await db.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
      
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Order Status] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== PROMOTIONS ====================

  async getPromotions(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('SELECT * FROM promotions WHERE supplier_id = $1 ORDER BY created_at DESC', [supplierId]);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Promotions] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async createPromotion(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const { name, type, value, code, max_usage, start_date, end_date, applies_to } = req.body;

      const result = await db.query(`
        INSERT INTO promotions (supplier_id, name, type, value, code, max_usage, usage_count, status, start_date, end_date, applies_to)
        VALUES ($1,$2,$3,$4,$5,$6,0,'active',$7,$8,$9) RETURNING *
      `, [supplierId, name, type, value, code, max_usage, start_date, end_date, applies_to || 'all']);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Promotion] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async updatePromotion(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const { name, type, value, code, max_usage, start_date, end_date, applies_to } = req.body;

      const result = await db.query(`
        UPDATE promotions SET name=$1, type=$2, value=$3, code=$4, max_usage=$5, start_date=$6, end_date=$7, applies_to=$8, updated_at=NOW()
        WHERE id=$9 AND supplier_id=$10 RETURNING *
      `, [name, type, value, code, max_usage, start_date, end_date, applies_to, id, supplierId]);

      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Promotion non trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Promotion] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async deletePromotion(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      await db.query('DELETE FROM promotions WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
      
      res.json({ success: true, message: 'Promotion supprimée' });
    } catch (error) {
      console.error('[Delete Promotion] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== CAMPAGNES ====================

  async getCampaigns(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('SELECT * FROM supplier_campaigns WHERE supplier_id = $1 ORDER BY created_at DESC', [supplierId]);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Campaigns] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // 🔥 MÉTHODE CRITIQUE QUI MANQUAIT !
  async getCampaignLimit(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const settingsResult = await db.query('SELECT max_campaigns FROM supplier_ad_settings WHERE supplier_id = $1', [supplierId]);
      const maxCampaigns = settingsResult.rows[0]?.max_campaigns || 5;

      const countResult = await db.query('SELECT COUNT(*) as count FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2', [supplierId, 'active']);
      const current = parseInt(countResult.rows[0].count);

      res.json({ success: true, data: { current, max: maxCampaigns, can_create: current < maxCampaigns } });
    } catch (error) {
      console.error('[Get Campaign Limit] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async createCampaign(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      
      // Vérifier limite
      const settingsResult = await db.query('SELECT max_campaigns FROM supplier_ad_settings WHERE supplier_id = $1', [supplierId]);
      const maxCampaigns = settingsResult.rows[0]?.max_campaigns || 5;
      
      const countResult = await db.query('SELECT COUNT(*) as count FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2', [supplierId, 'active']);
      if (parseInt(countResult.rows[0].count) >= maxCampaigns) {
        return res.status(400).json({ success: false, message: `Limite de ${maxCampaigns} campagnes atteinte` });
      }

      const { name, media_url, media_type, headline, description, cta_text, cta_link, start_date, end_date, target_products } = req.body;
      
      // Auto-ciblage: si pas de produits spécifiés, prendre tous les produits du fournisseur
      let finalTargetProducts = target_products;
      if (!target_products || target_products.length === 0) {
        const productsResult = await db.query('SELECT id FROM products WHERE supplier_id = $1 AND is_active = true', [supplierId]);
        finalTargetProducts = productsResult.rows.map(p => p.id);
      }

      const result = await db.query(`
        INSERT INTO supplier_campaigns (supplier_id, name, media_url, media_type, headline, description, cta_text, cta_link, start_date, end_date, target_products, status, views_count, clicks_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',0,0) RETURNING *
      `, [supplierId, name, media_url, media_type || 'image', headline, description, cta_text, cta_link, start_date, end_date, finalTargetProducts]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async updateCampaign(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const allowedFields = ['name', 'headline', 'description', 'cta_text', 'cta_link', 'media_url', 'media_type', 'start_date', 'end_date', 'target_products', 'status'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });

      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      values.push(id, supplierId);

      const result = await db.query(`UPDATE supplier_campaigns SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} AND supplier_id = $${fields.length + 2} RETURNING *`, values);
      
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      await db.query('DELETE FROM campaign_stats WHERE campaign_id = $1', [id]);
      const result = await db.query('DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2 RETURNING id', [id, supplierId]);
      
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
      res.json({ success: true, message: 'Campagne supprimée' });
    } catch (error) {
      console.error('[Delete Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async toggleCampaignStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const { id } = req.params;
      const { status } = req.body;
      
      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('UPDATE supplier_campaigns SET status = $1, updated_at = NOW() WHERE id = $2 AND supplier_id = $3 RETURNING *', [status, id, supplierId]);
      
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Toggle Campaign Status] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== PUBLIC CAMPAGNES ====================

  async getActiveCampaignForProduct(req, res) {
    try {
      const { supplier, product } = req.query;
      if (!supplier || !product) return res.status(400).json({ success: false, message: 'supplier et product requis' });

      const result = await db.query(`
        SELECT * FROM supplier_campaigns 
        WHERE supplier_id = $1 AND status = 'active' 
        AND start_date <= NOW() AND end_date >= NOW()
        AND (target_products IS NULL OR $2 = ANY(target_products))
        ORDER BY created_at DESC
      `, [supplier, product]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Active Campaign] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

      await db.query('UPDATE supplier_campaigns SET clicks_count = clicks_count + 1 WHERE id = $1', [campaign_id]);
      await db.query(`
        INSERT INTO campaign_stats (campaign_id, date, clicks) VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (campaign_id, date) DO UPDATE SET clicks = campaign_stats.clicks + 1
      `, [campaign_id]);

      res.json({ success: true });
    } catch (error) {
      console.error('[Track Click] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async trackCampaignView(req, res) {
    try {
      const { campaign_id } = req.body;
      if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

      await db.query('UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1', [campaign_id]);
      await db.query(`
        INSERT INTO campaign_stats (campaign_id, date, impressions) VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (campaign_id, date) DO UPDATE SET impressions = campaign_stats.impressions + 1
      `, [campaign_id]);

      res.json({ success: true });
    } catch (error) {
      console.error('[Track View] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== STATS ====================

  async getStats(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      
      const [sales, orders, products, campaigns, balance] = await Promise.all([
        db.query('SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(DISTINCT order_id) as count FROM order_items WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(*) as count FROM products WHERE supplier_id = $1 AND is_active = true', [supplierId]),
        db.query('SELECT COUNT(*) as count FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2', [supplierId, 'active']),
        db.query('SELECT COALESCE(SUM(CASE WHEN status = $2 THEN amount ELSE 0 END), 0) as available FROM supplier_payments WHERE supplier_id = $1', [supplierId, 'available'])
      ]);

      res.json({
        success: true,
        data: {
          totalSales: Number(sales.rows[0].total),
          totalOrders: Number(orders.rows[0].count),
          activeProducts: Number(products.rows[0].count),
          activeCampaigns: Number(campaigns.rows[0].count),
          balance: Number(balance.rows[0].available)
        }
      });
    } catch (error) {
      console.error('[Get Stats] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // ==================== AD SETTINGS ====================

  async getAdSettings(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });

      const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1', [userId]);
      if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });

      const supplierId = supplierResult.rows[0].id;
      const result = await db.query('SELECT * FROM supplier_ad_settings WHERE supplier_id = $1', [supplierId]);
      
      if (result.rows.length === 0) {
        // Créer config par défaut
        await db.query('INSERT INTO supplier_ad_settings (supplier_id, max_ads_per_session, max_campaigns) VALUES ($1, 1, 5)', [supplierId]);
        return res.json({ success: true, data: { max_ads_per_session: 1, max_campaigns: 5, priority: 5, is_active: true } });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Get Ad Settings] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
}

// ============================================
// EXPORT SÉCURISÉ - V7.2
// ============================================

const controller = new SupplierController();

// Export middlewares
module.exports.uploadImageMiddleware = uploadImageMiddleware;
module.exports.uploadVideoMiddleware = uploadVideoMiddleware;

// Liste complète des méthodes à exporter
const methods = [
  'getPayments', 'requestPayout', 'getPayouts',
  'uploadImage', 'uploadCampaignVideo',
  'getProducts', 'createProduct', 'updateProduct', 'deleteProduct',
  'getOrders', 'getOrderById', 'updateOrderStatus',
  'getPromotions', 'createPromotion', 'updatePromotion', 'deletePromotion',
  'getCampaigns', 'getCampaignLimit', 'createCampaign', 'updateCampaign', 'deleteCampaign', 'toggleCampaignStatus',
  'getActiveCampaignForProduct', 'trackCampaignClick', 'trackCampaignView',
  'getStats', 'getAdSettings'
];

console.log('[Supplier Controller] Checking methods...');

// Export avec vérification défensive
for (const method of methods) {
  if (typeof controller[method] === 'function') {
    module.exports[method] = controller[method].bind(controller);
    console.log(`  ✅ ${method}`);
  } else {
    console.error(`  ❌ ${method} NOT FOUND - creating stub`);
    // Créer un stub qui retourne une erreur
    module.exports[method] = (req, res) => {
      console.error(`[STUB] Method ${method} called but not implemented`);
      res.status(501).json({ success: false, message: `Method ${method} not implemented` });
    };
  }
}

console.log('[Supplier Controller] ✅ v7.2 loaded');