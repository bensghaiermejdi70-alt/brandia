// ============================================
// SUPPLIER CONTROLLER - Complet et Corrigé v3.5
// Correction : Suppression du DISTINCT qui cause l'erreur JSON
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
      const { name, price, stock_quantity, description, category_id } = req.body;

      const result = await db.query(
        `INSERT INTO products 
         (supplier_id, name, price, stock_quantity, description, category_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING *`,
        [supplierId, name, price, stock_quantity, description, category_id]
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
      
      console.log('[UpdateProduct] Raw body received:', req.body);
      
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

      console.log('[UpdateProduct] Filtered updates:', updates);

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun champ valide à mettre à jour' 
        });
      }

      if (updates.stock !== undefined) {
        console.error('[UpdateProduct] ERROR: stock field detected, removing');
        delete updates.stock;
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

      console.log('[UpdateProduct] Final SQL:', sql);
      console.log('[UpdateProduct] Final values:', values);

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

  async deleteProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM products WHERE id = $1 AND supplier_id = $2 RETURNING id, name',
        [id, supplierId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ 
          success: false, 
          message: 'Produit non trouvé ou non autorisé' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Produit supprimé',
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('[Delete Product] Error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /* ================= COMMANDES - CORRIGÉ v3.5 ================= */

  async getOrders(req, res) {
    try {
      const userId = req.user.id;
      
      // Récupérer le supplier_id à partir du user_id
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;
      const { status } = req.query;

      console.log(`[Get Orders] Supplier ID: ${supplierId}, Filter: ${status || 'all'}`);

      // 🔥 CORRECTION v3.5 : Approche en deux étapes pour éviter DISTINCT + JSON
      // Étape 1 : Récupérer les IDs des commandes uniques
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

      console.log(`[Get Orders] Found ${orderIds.length} order IDs`);

      if (orderIds.length === 0) {
        // Aucune commande trouvée, retourner vide
        const countsResult = await db.query(`
          SELECT 
            0 as all_count,
            0 as pending_count,
            0 as shipped_count,
            0 as delivered_count,
            0 as cancelled_count
        `);
        
        return res.json({ 
          success: true, 
          data: { 
            orders: [],
            counts: {
              all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0
            }
          } 
        });
      }

      // Étape 2 : Récupérer les détails des commandes avec leurs items
      // Utiliser ANY avec un tableau d'IDs
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

      // Étape 3 : Calculer les counts pour les badges
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
      
      console.log(`[Get Orders] Returning ${ordersResult.rows.length} orders`);
      console.log('[Get Orders] Counts:', counts);

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
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;

      // 🔥 CORRECTION v3.5 : Même approche sans DISTINCT
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
        return res.status(404).json({ 
          success: false, 
          message: 'Commande non trouvée ou non autorisée' 
        });
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
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const checkResult = await db.query(`
        SELECT 1 FROM order_items 
        WHERE order_id = $1 AND supplier_id = $2 
        LIMIT 1
      `, [id, supplierId]);

      if (checkResult.rows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Commande non autorisée' 
        });
      }

      const result = await db.query(
        `UPDATE orders 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
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

    
    /* ================= PAIEMENTS - CORRIGÉ v3.6 ================= */

   async getPayments(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const balanceResult = await db.query(`
        SELECT available_balance, pending_balance, total_earnings
        FROM supplier_balance_view
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
          o.order_number as order_number,
          sp.amount as total_amount,
          sp.supplier_amount as amount,
          sp.commission_amount,
          sp.description,
          sp.status,
          sp.created_at,
          sp.available_at,
          sp.paid_at
        FROM supplier_payments sp
        LEFT JOIN orders o ON sp.order_id = o.id
        WHERE sp.supplier_id = $1
        ORDER BY sp.created_at DESC
        LIMIT 100
      `, [supplierId]);

      const transactions = transactionsResult.rows.map(t => ({
        id: t.id,
        order_id: t.order_id,
        order_number: t.order_number || 'ORD-' + t.order_id,
        description: t.description || 'Vente commande #' + (t.order_number || t.order_id),
        amount: parseFloat(t.amount),
        commission: parseFloat(t.commission_amount) || 0,
        total: parseFloat(t.total_amount),
        status: t.status,
        created_at: t.created_at,
        available_at: t.available_at,
        paid_at: t.paid_at
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
        return res.status(400).json({
          success: false,
          message: 'Montant invalide'
        });
      }

      // Récupérer le supplier_id
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;

      // Vérifier le solde disponible
      const balanceResult = await db.query(`
        SELECT COALESCE(SUM(supplier_amount), 0) as available
        FROM supplier_payments
        WHERE supplier_id = $1 AND status = 'available'
      `, [supplierId]);

      const available = parseFloat(balanceResult.rows[0].available) || 0;

      if (parseFloat(amount) > available) {
        return res.status(400).json({
          success: false,
          message: `Solde insuffisant. Disponible: ${available}€`
        });
      }

      // Créer la demande de paiement
      const payoutResult = await db.query(`
        INSERT INTO payouts (supplier_id, amount, status, created_at)
        VALUES ($1, $2, 'pending', NOW())
        RETURNING *
      `, [supplierId, amount]);

      const payout = payoutResult.rows[0];

      // Marquer les paiements comme "en cours de versement"
      // On prend les plus anciens d'abord (FIFO)
      await db.query(`
        UPDATE supplier_payments
        SET status = 'payout_requested', payout_id = $1
        WHERE supplier_id = $2 
          AND status = 'available'
          AND id IN (
            SELECT id FROM supplier_payments
            WHERE supplier_id = $2 AND status = 'available'
            ORDER BY created_at ASC
            LIMIT (
              SELECT COUNT(*) FROM supplier_payments
              WHERE supplier_id = $2 AND status = 'available'
              AND supplier_amount <= $3
            )
          )
      `, [payout.id, supplierId, amount]);

      res.json({
        success: true,
        message: 'Demande de virement créée',
        data: {
          payout_id: payout.id,
          amount: parseFloat(amount),
          status: 'pending',
          estimated_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // +2 jours
        }
      });

    } catch (error) {
      console.error('[Request Payout] Error:', error);
      res.status(500).json({ success: false, message: error.message });
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
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(`
        SELECT 
          p.*,
          json_agg(
            json_build_object(
              'id', sp.id,
              'order_number', sp.order_number,
              'amount', sp.supplier_amount
            )
          ) as payments
        FROM payouts p
        LEFT JOIN supplier_payments sp ON sp.payout_id = p.id
        WHERE p.supplier_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [supplierId]);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error('[Get Payouts] Error:', error);
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
         RETURNING *`,
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
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profil fournisseur non trouvé' 
        });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const [sales, orders, products] = await Promise.all([
        db.query(`
          SELECT COALESCE(SUM(oi.total_price), 0) as total 
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.supplier_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
        `, [supplierId]),
               db.query('SELECT COUNT(DISTINCT order_id) FROM order_items WHERE supplier_id = $1', [supplierId]),
        db.query('SELECT COUNT(*) FROM products WHERE supplier_id = $1 AND is_active = true', [userId])
      ]);

      res.json({
        success: true,
        data: {
          totalSales: Number(sales.rows[0].total),
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

//* ================= EXPORT ================= */

const controller = new SupplierController();

module.exports = {
  // Middleware
  uploadMiddleware: upload.single('media'),
  
  // Stats
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
  
  // 🔥 AJOUTÉ : Paiements
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
  
  // Uploads
  uploadImage: controller.uploadImage.bind(controller),
  uploadCampaignVideo: controller.uploadCampaignVideo.bind(controller)
};