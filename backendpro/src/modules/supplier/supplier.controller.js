const db = require('../../config/db');
const { uploadImage } = require('../../utils/cloudinary');
const multer = require('multer');

// Configuration multer (mémoire, pas de stockage local)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'), false);
        }
    }
});

// Email optionnel
let sendEmail = null;
try {
  const emailModule = require('../../utils/email');
  sendEmail = emailModule.sendEmail;
  console.log('[SupplierController] Email module loaded');
} catch (e) {
  console.log('[SupplierController] Email module not available - emails disabled');
  sendEmail = async (options) => {
    console.log('[Email Mock] Would send:', options.subject, 'to', options.to);
    return { success: true, mock: true };
  };
}

class SupplierController {
  
  // ==========================================
  // UPLOAD IMAGE
  // ==========================================
  async uploadImage(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucune image fournie'
            });
        }

        console.log('[Upload] Image reçue:', req.file.originalname, '- Taille:', req.file.size);

        const result = await uploadImage(req.file.buffer, 'brandia/products');

        res.json({
            success: true,
            message: 'Image uploadée avec succès',
            data: {
                url: result.url,
                publicId: result.publicId,
                width: result.width,
                height: result.height
            }
        });

    } catch (error) {
        console.error('[Upload] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'upload: ' + error.message
        });
    }
  }

  // ==========================================
  // UPLOAD VIDEO POUR CAMPAGNES
  // ==========================================
  async uploadCampaignVideo(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucune vidéo fournie'
            });
        }

        if (req.file.size > 50 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: 'Vidéo trop volumineuse (max 50MB)'
            });
        }

        console.log('[Upload Video] Vidéo reçue:', req.file.originalname, '- Taille:', req.file.size);

        const { uploadVideo } = require('../../utils/cloudinary');
        const result = await uploadVideo(req.file.buffer, 'brandia/campaigns');

        res.json({
            success: true,
            message: 'Vidéo uploadée avec succès',
            data: {
                url: result.url,
                thumbnailUrl: result.thumbnailUrl,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
                duration: result.duration,
                resourceType: 'video'
            }
        });

    } catch (error) {
        console.error('[Upload Video] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'upload: ' + error.message
        });
    }
  }

  // ==========================================
  // STATISTIQUES
  // ==========================================
  async getStats(req, res) {
    try {
      const supplierId = req.user.id;
      
      const statsQuery = await db.query(`
        SELECT 
          COALESCE(SUM(o.total_amount), 0) as total_sales,
          COUNT(DISTINCT o.id) as total_orders,
          COUNT(DISTINCT p.id) as products_count,
          COALESCE(SUM(sp.supplier_amount), 0) as balance
        FROM users u
        LEFT JOIN orders o ON o.supplier_id = u.id AND o.status IN ('paid', 'shipped', 'delivered')
        LEFT JOIN products p ON p.supplier_id = u.id AND p.is_active = true
        LEFT JOIN supplier_payments sp ON sp.supplier_id = u.id AND sp.status = 'available'
        WHERE u.id = $1
      `, [supplierId]);

      const ordersQuery = await db.query(`
        SELECT 
          o.id, o.order_number, o.total_amount, o.status, o.created_at,
          u.first_name as customer_name, u.email as customer_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.supplier_id = $1
        ORDER BY o.created_at DESC
        LIMIT 5
      `, [supplierId]);

      const topProducts = await db.query(`
        SELECT p.name, p.main_image_url, SUM(oi.quantity) as sales
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE p.supplier_id = $1 AND o.status IN ('paid', 'shipped', 'delivered')
        GROUP BY p.id, p.name, p.main_image_url
        ORDER BY sales DESC
        LIMIT 5
      `, [supplierId]);

      res.json({
        success: true,
        data: {
          stats: {
            totalSales: parseFloat(statsQuery.rows[0]?.total_sales || 0),
            totalOrders: parseInt(statsQuery.rows[0]?.total_orders || 0),
            productsCount: parseInt(statsQuery.rows[0]?.products_count || 0),
            balance: parseFloat(statsQuery.rows[0]?.balance || 0),
            totalProducts: parseInt(statsQuery.rows[0]?.products_count || 0)
          },
          recentOrders: ordersQuery.rows,
          topProducts: topProducts.rows,
          salesChart: []
        }
      });
    } catch (error) {
      console.error('Erreur getStats:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // PRODUITS
  // ==========================================
  async getProducts(req, res) {
    try {
      const supplierId = req.user.id;
      const { search, status, category, page = 1, limit = 12 } = req.query;
      
      let query = `
        SELECT p.*, c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.supplier_id = $1
      `;
      
      const params = [supplierId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (status) {
        paramCount++;
        query += ` AND p.is_active = $${paramCount}`;
        params.push(status === 'published');
      }

      if (category) {
        paramCount++;
        query += ` AND p.category_id = $${paramCount}`;
        params.push(category);
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, (page - 1) * limit);

      const result = await db.query(query, params);
      const countResult = await db.query(
        'SELECT COUNT(*) FROM products WHERE supplier_id = $1',
        [supplierId]
      );

      res.json({
        success: true,
        data: {
          products: result.rows,
          total: parseInt(countResult.rows[0].count),
          page: parseInt(page),
          totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
        }
      });
    } catch (error) {
      console.error('Erreur getProducts:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { name, price, stock_quantity, category_id, description, main_image_url } = req.body;

      const result = await db.query(`
        INSERT INTO products (supplier_id, name, price, stock_quantity, category_id, description, main_image_url, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
      `, [supplierId, name, price, stock_quantity, category_id, description, main_image_url || null]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      const updates = req.body;

      const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 3}`).join(', ');
      const values = Object.values(updates);
      
      await db.query(`
        UPDATE products SET ${fields}, updated_at = NOW()
        WHERE id = $1 AND supplier_id = $2
      `, [id, supplierId, ...values]);

      res.json({ success: true, message: 'Produit mis à jour' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      await db.query('DELETE FROM products WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
      res.json({ success: true, message: 'Produit supprimé' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
// COMMANDES - CORRIGÉ
// ==========================================

async getOrders(req, res) {
  try {
    const supplierId = req.user.id;
    const { status } = req.query;

    console.log('[getOrders] Filtre demandé:', status, '- Supplier:', supplierId);

    let query = `
      SELECT 
        o.id, o.order_number, o.total_amount, o.status, o.payment_status, o.created_at,
        u.first_name as customer_name, u.email as customer_email, o.shipping_address
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.supplier_id = $1
    `;
    
    const params = [supplierId];

    // ?? CORRECTION : Logique de filtrage selon status ou payment_status
    if (status && status !== 'all') {
      if (status === 'paid') {
        // ?? paid = payment_status, pas status logistique
        query += ` AND o.payment_status = 'paid'`;
      } else {
        // Autres statuts = status logistique
        query += ` AND o.status = $2`;
        params.push(status);
      }
    }

    query += ` ORDER BY o.created_at DESC`;

    console.log('[getOrders] SQL:', query);
    console.log('[getOrders] Params:', params);

    const result = await db.query(query, params);

    // ?? CORRECTION : Counts avec séparation status / payment_status
    const countsQuery = await db.query(`
      SELECT 
        COUNT(*) as all_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'shipped') as shipped_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count
      FROM orders 
      WHERE supplier_id = $1
    `, [supplierId]);

    const counts = countsQuery.rows[0];

    console.log('[getOrders] Résultat:', {
      orders: result.rows.length,
      counts: {
        all: parseInt(counts.all_count),
        pending: parseInt(counts.pending_count),
        paid: parseInt(counts.paid_count),
        shipped: parseInt(counts.shipped_count),
        delivered: parseInt(counts.delivered_count)
      }
    });

    res.json({
      success: true,
      data: {
        orders: result.rows,
        counts: {
          all: parseInt(counts.all_count),
          pending: parseInt(counts.pending_count),
          paid: parseInt(counts.paid_count),
          shipped: parseInt(counts.shipped_count),
          delivered: parseInt(counts.delivered_count)
        }
      }
    });
  } catch (error) {
    console.error('[getOrders] Erreur:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async updateOrderStatus(req, res) {
  try {
    const supplierId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    console.log('[updateOrderStatus] Order:', id, '- New status:', status, '- Supplier:', supplierId);

    // ?? Vérifier que le statut est valide
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Statut invalide: ' + status 
      });
    }

    // ?? Envoyer l'email si expédié
    if (status === 'shipped') {
      try { await this.sendShippingEmail(id); } catch (e) {
        console.log('[updateOrderStatus] Email error (non-blocking):', e.message);
      }
    }

    // ?? Mettre à jour UNIQUEMENT status (logistique), pas payment_status
    const result = await db.query(
      `UPDATE orders 
       SET status = $1, 
           updated_at = NOW() 
       WHERE id = $2 AND supplier_id = $3
       RETURNING id, status, payment_status`,
      [status, id, supplierId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Commande non trouvée ou accès refusé' 
      });
    }

    console.log('[updateOrderStatus] Mise à jour OK:', result.rows[0]);

    res.json({ 
      success: true, 
      message: 'Statut mis à jour', 
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[updateOrderStatus] Erreur:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}
  // ==========================================
  // PAIEMENTS
  // ==========================================
  async getPayments(req, res) {
    try {
      const supplierId = req.user.id;

      const balanceResult = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'available' THEN supplier_amount ELSE 0 END), 0) as available,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN supplier_amount ELSE 0 END), 0) as pending,
          COALESCE(SUM(supplier_amount), 0) as total
        FROM supplier_payments WHERE supplier_id = $1
      `, [supplierId]);

      const transactionsResult = await db.query(`
        SELECT sp.*, o.order_number
        FROM supplier_payments sp
        LEFT JOIN orders o ON sp.order_id = o.id
        WHERE sp.supplier_id = $1
        ORDER BY sp.created_at DESC
        LIMIT 20
      `, [supplierId]);

      res.json({
        success: true,
        data: {
          available: parseFloat(balanceResult.rows[0].available),
          pending: parseFloat(balanceResult.rows[0].pending),
          total: parseFloat(balanceResult.rows[0].total),
          transactions: transactionsResult.rows
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async requestPayout(req, res) {
    try {
      const supplierId = req.user.id;
      const { amount } = req.body;

      const balanceCheck = await db.query(
        'SELECT COALESCE(SUM(supplier_amount), 0) as balance FROM supplier_payments WHERE supplier_id = $1 AND status = $2',
        [supplierId, 'available']
      );

      if (parseFloat(balanceCheck.rows[0].balance) < amount) {
        return res.status(400).json({ success: false, message: 'Solde insuffisant' });
      }

      await db.query(`INSERT INTO payouts (supplier_id, amount, status) VALUES ($1, $2, 'pending')`, [supplierId, amount]);
      await db.query(`UPDATE supplier_payments SET status = 'payout_requested', updated_at = NOW() WHERE supplier_id = $1 AND status = 'available'`, [supplierId]);

      res.json({ success: true, message: 'Demande de virement envoyée' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // CAMPAGNES (Auth)
  // ==========================================
  async getCampaigns(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query(`SELECT * FROM supplier_campaigns WHERE supplier_id = $1 ORDER BY created_at DESC`, [supplierId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createCampaign(req, res) {
    try {
      const supplierId = req.user.id;
      const { name, headline, description, cta_text, cta_link, media_type, media_url, target_products, start_date, end_date } = req.body;

      const result = await db.query(`
        INSERT INTO supplier_campaigns 
        (supplier_id, name, headline, description, cta_text, cta_link, media_type, media_url, target_products, start_date, end_date, status, views_count, clicks_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', 0, 0)
        RETURNING *
      `, [supplierId, name, headline, description, cta_text, cta_link, media_type, media_url, target_products, start_date, end_date]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateCampaign(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      const { status } = req.body;

      await db.query(`UPDATE supplier_campaigns SET status = $1, updated_at = NOW() WHERE id = $2 AND supplier_id = $3`, [status, id, supplierId]);
      res.json({ success: true, message: 'Campagne mise à jour' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      await db.query('DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
      res.json({ success: true, message: 'Campagne supprimée' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // CAMPAGNES (PUBLIC - Sans auth)
  // ==========================================
  
  async getActiveCampaignForProduct(req, res) {
    try {
      const { supplierId, productId } = req.params;
      
      console.log(`[getActiveCampaignForProduct] supplier=${supplierId}, product=${productId}`);
      
      const result = await db.query(`
        SELECT 
          c.id, c.name, c.media_url, c.media_type, c.headline, 
          c.description, c.cta_text, c.cta_link
        FROM supplier_campaigns c
        WHERE c.supplier_id = $1
          AND $2 = ANY(c.target_products)
          AND c.status = 'active'
          AND c.start_date <= NOW()
          AND c.end_date >= NOW()
        ORDER BY c.created_at DESC
        LIMIT 1
      `, [supplierId, productId]);

      res.json({
        success: true,
        data: result.rows[0] || null
      });
    } catch (error) {
      console.error('[getActiveCampaignForProduct] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async trackCampaignClick(req, res) {
    try {
      const { campaignId } = req.body;
      
      await db.query(`UPDATE supplier_campaigns SET clicks_count = clicks_count + 1 WHERE id = $1`, [campaignId]);
      await db.query(`
        INSERT INTO campaign_stats (campaign_id, date, clicks)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (campaign_id, date) DO UPDATE SET clicks = campaign_stats.clicks + 1
      `, [campaignId]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // TRACKING (Auth)
  // ==========================================
  async trackCampaignView(req, res) {
    try {
      const { campaignId } = req.body;
      
      await db.query(`UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1`, [campaignId]);
      await db.query(`
        INSERT INTO campaign_stats (campaign_id, date, impressions)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (campaign_id, date) DO UPDATE SET impressions = campaign_stats.impressions + 1
      `, [campaignId]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // EMAIL
  // ==========================================
  async sendShippingEmail(orderId) {
    try {
      if (!sendEmail) return;
      
      const orderData = await db.query(`
        SELECT o.*, u.email, u.first_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `, [orderId]);

      if (orderData.rows.length > 0) {
        const order = orderData.rows[0];
        await sendEmail({
          to: order.email,
          subject: `Votre commande ${order.order_number} a été expédiée`,
          html: `<h1>Bonne nouvelle !</h1><p>Votre commande est en route.</p>`
        });
      }
    } catch (error) {
      console.error('[Email] Error (non-blocking):', error.message);
    }
  }
}

// Exporter aussi le middleware multer
module.exports = {
    controller: new SupplierController(),
    uploadMiddleware: upload.single('image')
};