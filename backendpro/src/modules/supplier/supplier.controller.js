// ============================================
// SUPPLIER CONTROLLER - v4.6 COMPLET
// AJOUT : Méthodes uploadImage et uploadVideo
// ============================================

const db = require("../../config/db");

// Configuration Cloudinary (à mettre dans .env)
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Config Cloudinary si variables d'environnement présentes
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

class SupplierController {

  /* ================= UPLOAD - NOUVEAUTÉ V4.6 ================= */

  async uploadImage(req, res) {
    try {
      // Vérifier si fichier présent
      if (!req.file && !req.files?.media) {
        return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
      }

      const file = req.file || req.files.media;
      
      // Vérifier type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ success: false, message: 'Le fichier doit être une image' });
      }

      // Vérifier taille (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Image trop grande (max 5MB)' });
      }

      // Si Cloudinary configuré, upload vers Cloudinary
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { 
              folder: 'brandia/products',
              resource_type: 'image',
              transformation: [{ width: 800, height: 800, crop: 'limit' }]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });

        return res.json({
          success: true,
          data: {
            url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height
          }
        });
      } 
      
      // Sinon, stockage local (fallback)
      else {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '../../../uploads');
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.mimetype.split('/')[1]}`;
        const filepath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filepath, file.buffer);
        
        // URL relative (à remplacer par votre domaine)
        const url = `/uploads/${filename}`;
        
        return res.json({
          success: true,
          data: {
            url: url,
            filename: filename
          }
        });
      }

    } catch (error) {
      console.error('[Upload Image] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur upload: ' + error.message });
    }
  }

  async uploadCampaignVideo(req, res) {
    try {
      if (!req.file && !req.files?.media) {
        return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
      }

      const file = req.file || req.files.media;
      
      // Vérifier type vidéo
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ success: false, message: 'Le fichier doit être une vidéo' });
      }

      // Vérifier taille (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Vidéo trop grande (max 50MB)' });
      }

      // Vérifier durée si possible (simplifié)
      // Note: Pour une vraie vérification de durée, il faudrait ffmpeg

      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { 
              folder: 'brandia/campaigns',
              resource_type: 'video',
              eager: [
                { width: 640, height: 480, crop: 'limit', format: 'mp4' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });

        return res.json({
          success: true,
          data: {
            url: result.secure_url,
            public_id: result.public_id,
            duration: result.duration,
            format: result.format
          }
        });
      } else {
        // Stockage local fallback
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '../../../uploads/videos');
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filename = `campaign_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.mimetype.split('/')[1]}`;
        const filepath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filepath, file.buffer);
        
        const url = `/uploads/videos/${filename}`;
        
        return res.json({
          success: true,
          data: {
            url: url,
            filename: filename
          }
        });
      }

    } catch (error) {
      console.error('[Upload Video] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur upload vidéo: ' + error.message });
    }
  }

  /* ================= PAIEMENTS - v4.5 COLONNES CORRIGÉES ================= */

  async getPayments(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const balanceResult = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) as available_balance,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_balance,
          COALESCE(SUM(amount), 0) as total_earnings
        FROM supplier_payments
        WHERE supplier_id = $1
      `, [supplierId]);

      const balance = balanceResult.rows[0] || {
        available_balance: 0,
        pending_balance: 0,
        total_earnings: 0
      };

      const transactionsResult = await db.query(`
        SELECT 
          sp.id,
          sp.order_id,
          sp.amount,
          sp.commission_amount,
          sp.supplier_amount,
          sp.status,
          sp.payout_id,
          sp.stripe_transfer_id,
          sp.created_at,
          sp.updated_at
        FROM supplier_payments sp
        WHERE sp.supplier_id = $1
        ORDER BY sp.created_at DESC
        LIMIT 100
      `, [supplierId]);

      const transactions = transactionsResult.rows.map(t => ({
        id: t.id,
        order_id: t.order_id,
        order_number: 'ORD-' + t.order_id,
        description: 'Vente commande #' + t.order_id,
        amount: parseFloat(t.amount) || 0,
        commission: parseFloat(t.commission_amount) || 0,
        net: parseFloat(t.supplier_amount) || 0,
        status: t.status,
        payout_id: t.payout_id,
        stripe_transfer_id: t.stripe_transfer_id,
        created_at: t.created_at,
        available_at: t.status === 'available' ? t.updated_at : null,
        paid_at: t.status === 'paid' ? t.updated_at : null
      }));

      res.json({
        success: true,
        data: {
          balance: {
            available: parseFloat(balance.available_balance) || 0,
            pending: parseFloat(balance.pending_balance) || 0,
            total: parseFloat(balance.total_earnings) || 0
          },
          transactions: transactions
        }
      });

    } catch (error) {
      console.error('[Get Payments] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async requestPayout(req, res) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Montant invalide' });
      }

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const balanceResult = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as available
        FROM supplier_payments
        WHERE supplier_id = $1 AND status = 'available'
      `, [supplierId]);

      const available = parseFloat(balanceResult.rows[0].available) || 0;

      if (parseFloat(amount) > available) {
        return res.status(400).json({
          success: false,
          message: `Solde insuffisant. Disponible: ${available.toFixed(2)}€`
        });
      }

      const payoutResult = await db.query(`
        INSERT INTO payouts (supplier_id, amount, status, created_at)
        VALUES ($1, $2, 'pending', NOW())
        RETURNING id, supplier_id, amount, status, created_at
      `, [supplierId, amount]);

      const payout = payoutResult.rows[0];

      await db.query(`
        UPDATE supplier_payments
        SET status = 'payout_requested', payout_id = $1, updated_at = NOW()
        WHERE supplier_id = $2 AND status = 'available'
      `, [payout.id, supplierId]);

      res.json({
        success: true,
        message: 'Demande de virement créée avec succès',
        data: {
          payout_id: payout.id,
          amount: parseFloat(amount),
          status: 'pending',
          estimated_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      });

    } catch (error) {
      console.error('[Request Payout] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
    }
  }

  async getPayouts(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(`
        SELECT 
          p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', sp.id,
                'order_id', sp.order_id,
                'amount', sp.amount,
                'commission', sp.commission_amount,
                'net', sp.supplier_amount
              ) ORDER BY sp.id
            ) FILTER (WHERE sp.id IS NOT NULL),
            '[]'
          ) as payments
        FROM payouts p
        LEFT JOIN supplier_payments sp ON sp.payout_id = p.id
        WHERE p.supplier_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [supplierId]);

      const payouts = result.rows.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount),
        status: p.status,
        stripe_payout_id: p.stripe_payout_id,
        processed_at: p.processed_at,
        created_at: p.created_at,
        payments: p.payments || []
      }));

      res.json({ success: true, data: payouts });

    } catch (error) {
      console.error('[Get Payouts] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PRODUITS ================= */

  async getProducts(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(`
        SELECT id, name, price, stock_quantity, main_image_url, is_active, category_id, slug, description
        FROM products 
        WHERE supplier_id = $1 
        ORDER BY created_at DESC
      `, [supplierId]);
      
      res.json({ 
        success: true, 
        data: { products: result.rows }
      });
      
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { name, price, stock_quantity, description, category_id, main_image_url, is_active } = req.body;

      // Validation
      if (!name || name.length < 2) {
        return res.status(400).json({ success: false, message: 'Nom trop court (min 2 caractères)' });
      }

      if (!price || isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'Prix invalide' });
      }

      const result = await db.query(
        `INSERT INTO products (supplier_id, name, price, stock_quantity, description, category_id, main_image_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
        [supplierId, name, price, stock_quantity || 0, description || '', category_id, main_image_url || null, is_active !== false]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Create Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      
      const allowedFields = {
        name: req.body.name,
        price: req.body.price,
        stock_quantity: req.body.stock_quantity,
        description: req.body.description,
        category_id: req.body.category_id,
        is_active: req.body.is_active,
        main_image_url: req.body.main_image_url
      };

      const updates = {};
      for (const [key, value] of Object.entries(allowedFields)) {
        if (value !== undefined && value !== null) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'Aucun champ valide à mettre à jour' });
      }

      const fields = Object.keys(updates);
      const values = Object.values(updates);
      
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      const sql = `
        UPDATE products SET ${setClause}, updated_at = NOW()
        WHERE id = $${fields.length + 1} AND supplier_id = $${fields.length + 2}
        RETURNING *
      `;
      
      values.push(id, supplierId);

      const result = await db.query(sql, values);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
      }

      res.json({ success: true, data: result.rows[0] });
      
    } catch (error) {
      console.error('[UpdateProduct] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(
        'DELETE FROM products WHERE id = $1 AND supplier_id = $2 RETURNING id, name',
        [id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
      }

      res.json({ success: true, message: 'Produit supprimé', data: result.rows[0] });
      
    } catch (error) {
      console.error('[Delete Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= COMMANDES ================= */

  async getOrders(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { status } = req.query;

      let orderIdsSql = `
        SELECT DISTINCT o.id
        FROM orders o
        INNER JOIN order_items oi ON o.id = oi.order_id
        WHERE oi.supplier_id = $1
      `;
      
      const params = [supplierId];

      if (status && status !== 'all') {
        if (status === 'pending') {
          orderIdsSql += ` AND (o.status = 'pending' OR o.status IS NULL OR o.status = 'paid')`;
        } else if (status === 'shipped') {
          orderIdsSql += ` AND o.status = 'shipped'`;
        } else if (status === 'delivered') {
          orderIdsSql += ` AND o.status = 'delivered'`;
        } else if (status === 'cancelled') {
          orderIdsSql += ` AND o.status = 'cancelled'`;
        }
      }

      orderIdsSql += ` ORDER BY o.id DESC`;

      const orderIdsResult = await db.query(orderIdsSql, params);
      const orderIds = orderIdsResult.rows.map(r => r.id);

      if (orderIds.length === 0) {
        return res.json({ 
          success: true, 
          data: { orders: [], counts: { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 } } 
        });
      }

      const ordersSql = `
        SELECT o.*, 
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', oi2.id,
                  'product_id', oi2.product_id,
                  'product_name', oi2.product_name,
                  'product_sku', oi2.product_sku,
                  'product_image_url', oi2.product_image_url,
                  'quantity', oi2.quantity,
                  'unit_price', oi2.unit_price,
                  'total_price', oi2.total_price,
                  'supplier_amount', oi2.supplier_amount,
                  'commission_amount', oi2.commission_amount,
                  'vat_rate', oi2.vat_rate,
                  'fulfillment_status', oi2.fulfillment_status
                ) ORDER BY oi2.id
              )
              FROM order_items oi2
              WHERE oi2.order_id = o.id AND oi2.supplier_id = $1
            ),
            '[]'::jsonb
          )::json as items
        FROM orders o
        WHERE o.id = ANY($2)
        ORDER BY o.created_at DESC
      `;

      const ordersResult = await db.query(ordersSql, [supplierId, orderIds]);

      const countsResult = await db.query(`
        SELECT 
          COUNT(DISTINCT o.id) as all_count,
          COUNT(DISTINCT CASE WHEN (o.status = 'pending' OR o.status IS NULL OR o.status = 'paid') THEN o.id END) as pending_count,
          COUNT(DISTINCT CASE WHEN o.status = 'shipped' THEN o.id END) as shipped_count,
          COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_count,
          COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_count
        FROM orders o
        INNER JOIN order_items oi ON o.id = oi.order_id
        WHERE oi.supplier_id = $1
      `, [supplierId]);

      const counts = countsResult.rows[0];

      res.json({ 
        success: true, 
        data: { 
          orders: ordersResult.rows,
          counts: {
            all: parseInt(counts.all_count) || 0,
            pending: parseInt(counts.pending_count) || 0,
            shipped: parseInt(counts.shipped_count) || 0,
            delivered: parseInt(counts.delivered_count) || 0,
            cancelled: parseInt(counts.cancelled_count) || 0
          }
        } 
      });
      
    } catch (error) {
      console.error('[Get Orders] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOrderById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(`
        SELECT o.*, 
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', oi2.id,
                  'product_id', oi2.product_id,
                  'product_name', oi2.product_name,
                  'product_sku', oi2.product_sku,
                  'product_image_url', oi2.product_image_url,
                  'quantity', oi2.quantity,
                  'unit_price', oi2.unit_price,
                  'total_price', oi2.total_price,
                  'supplier_amount', oi2.supplier_amount,
                  'commission_amount', oi2.commission_amount,
                  'vat_rate', oi2.vat_rate
                ) ORDER BY oi2.id
              )
              FROM order_items oi2
              WHERE oi2.order_id = o.id AND oi2.supplier_id = $2
            ),
            '[]'::jsonb
          )::json as items
        FROM orders o
        WHERE o.id = $1
      `, [id, supplierId]);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Commande non trouvée ou non autorisée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Get Order By Id] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const userId = req.user.id;
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

      const checkResult = await db.query(`
        SELECT 1 FROM order_items WHERE order_id = $1 AND supplier_id = $2 LIMIT 1
      `, [id, supplierId]);

      if (checkResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Commande non autorisée' });
      }

      const result = await db.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, id]
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

  /* ================= PROMOTIONS ================= */

  async getPromotions(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

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
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { name, type, value, code, max_usage, start_date, end_date } = req.body;

      const result = await db.query(
        `INSERT INTO promotions (supplier_id, name, type, value, code, max_usage, usage_count, status, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6,0,'active',$7,$8) RETURNING *`,
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
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { id } = req.params;
      const { name, type, value, code, max_usage, start_date, end_date } = req.body;

      const result = await db.query(
        `UPDATE promotions SET name=$1, type=$2, value=$3, code=$4, max_usage=$5,
         start_date=$6, end_date=$7, updated_at=NOW()
         WHERE id=$8 AND supplier_id=$9 RETURNING *`,
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
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { id } = req.params;

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
      const userId = req.user.id;
      
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
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createCampaign(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;
      
      const {
        name, media_url, media_type, headline,
        description, cta_text, cta_link,
        start_date, end_date, target_products
      } = req.body;

      if (!name || !headline || !target_products || target_products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nom, titre et produits cibles sont obligatoires'
        });
      }

      const result = await db.query(
        `INSERT INTO supplier_campaigns
         (supplier_id, name, media_url, media_type, headline, description,
          cta_text, cta_link, start_date, end_date, target_products, status, views_count, clicks_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',0,0)
         RETURNING *`,
        [
          supplierId, name, media_url, media_type || 'image', headline,
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
      const userId = req.user.id;
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
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const userId = req.user.id;
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
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= PUBLIC CAMPAGNES ================= */

  async getActiveCampaignForProduct(req, res) {
    try {
      const { supplierId, productId } = req.query;

      if (!supplierId || !productId) {
        return res.status(400).json({ success: false, message: 'supplierId et productId sont requis' });
      }

      const result = await db.query(
        `SELECT * FROM supplier_campaigns
         WHERE supplier_id = $1
           AND $2 = ANY(target_products)
           AND status = 'active'
           AND start_date <= NOW()
           AND end_date >= NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [supplierId, productId]
      );

      res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
      console.error('[Get Active Campaign] Error:', error);
      res.status(500).json({ success: false, message: error.message });
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
      res.status(500).json({ success: false, message: error.message });
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
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= STATS ================= */

  async getStats(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const [sales, orders, products, campaigns, balance] = await Promise.all([
        db.query(`
          SELECT COALESCE(SUM(oi.total_price), 0) as total 
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.supplier_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
        `, [supplierId]),
        db.query('SELECT COUNT(DISTINCT order_id) FROM order_items WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(*) FROM products WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(*) FROM supplier_campaigns WHERE supplier_id = $1 AND status = $2', [supplierId, 'active']),
        db.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) as available,
            COALESCE(SUM(amount), 0) as total
          FROM supplier_payments
          WHERE supplier_id = $1
        `, [supplierId])
      ]);

      res.json({
        success: true,
        data: {
          totalSales: Number(sales.rows[0].total),
          totalOrders: Number(orders.rows[0].count),
          totalProducts: Number(products.rows[0].count),
          activeProducts: Number(products.rows[0].count), // Simplifié
          activeCampaigns: Number(campaigns.rows[0].count),
          balance: Number(balance.rows[0].available),
          totalEarnings: Number(balance.rows[0].total)
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
  // Upload (NOUVEAU)
  uploadImage: controller.uploadImage.bind(controller),
  uploadCampaignVideo: controller.uploadCampaignVideo.bind(controller),
  
  // Stats & Dashboard
  getStats: controller.getStats.bind(controller),
  
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
  getPayouts: controller.getPayouts.bind(controller),
  
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
  
  // Public
  getActiveCampaignForProduct: controller.getActiveCampaignForProduct.bind(controller),
  trackCampaignClick: controller.trackCampaignClick.bind(controller),
  trackCampaignView: controller.trackCampaignView.bind(controller)
};