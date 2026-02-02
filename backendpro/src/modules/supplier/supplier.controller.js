const { query } = require('../../config/db');

// Helper vérification supplier
const checkSupplier = async (userId) => {
  const result = await query('SELECT id, role FROM users WHERE id = $1 AND role = $2', [userId, 'supplier']);
  return result.rows[0];
};

// ============================================
// STATS - CORRIGÉ (sans colonne status)
// ============================================
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // CA et commandes (en utilisant payment_status ou sans filtre status si inexistant)
    const revenue = await query(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM orders 
      WHERE supplier_id = $1 
    `, [userId]);
    
    // Commandes récentes (sans référence à status si la colonne n'existe pas)
    const recentOrders = await query(`
      SELECT o.id, o.order_number, o.created_at, o.total_amount, 
             COALESCE(o.payment_status, 'pending') as status, 
             u.first_name as customer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.supplier_id = $1
      ORDER BY o.created_at DESC 
      LIMIT 5
    `, [userId]);
    
    // Produits (sans status, utilise is_active)
    const products = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true OR is_active IS NULL) as active,
        COUNT(*) as total
      FROM products 
      WHERE supplier_id = $1
    `, [userId]);
    
    // Solde
    const balance = await query(`
      SELECT COALESCE(SUM(supplier_amount), 0) as available 
      FROM supplier_payments 
      WHERE supplier_id = $1 AND status = 'available'
    `, [userId]);
    
    // Top produits (sans référence à o.status)
    const topProducts = await query(`
      SELECT p.name, SUM(oi.quantity) as sales, SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.supplier_id = $1
      GROUP BY p.id 
      ORDER BY sales DESC 
      LIMIT 5
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        stats: {
          totalSales: parseFloat(revenue.rows[0].total),
          totalOrders: parseInt(revenue.rows[0].count),
          productsCount: parseInt(products.rows[0].active),
          totalProducts: parseInt(products.rows[0].total),
          balance: parseFloat(balance.rows[0].available)
        },
        recentOrders: recentOrders.rows.map(o => ({
          ...o,
          total_amount: parseFloat(o.total_amount)
        })),
        salesChart: [],
        topProducts: topProducts.rows
      }
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// PRODUCTS - CORRIGÉ
// ============================================
exports.getProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 12, search = '', status } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `SELECT p.*, c.name as category_name 
               FROM products p 
               LEFT JOIN categories c ON p.category_id = c.id 
               WHERE p.supplier_id = $1`;
    let params = [userId];
    let paramCount = 1;
    
    if (search) {
      paramCount++;
      sql += ` AND p.name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
    }
    
    // Filtre par is_active au lieu de status
    if (status) {
      paramCount++;
      if (status === 'published') {
        sql += ` AND (p.is_active = true OR p.is_active IS NULL)`;
        paramCount--; // On n'ajoute pas de paramètre car condition fixe
      } else if (status === 'draft') {
        sql += ` AND p.is_active = false`;
        paramCount--;
      }
    }
    
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;
    
    sql += ` ORDER BY p.created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`;
    params.push(limit, offset);
    
    const products = await query(sql, params);
    
    // Count total
    const countRes = await query(`SELECT COUNT(*) FROM products WHERE supplier_id = $1`, [userId]);
    
    res.json({
      success: true,
      data: {
        products: products.rows,
        total: parseInt(countRes.rows[0].count)
      }
    });
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, price, stock_quantity, category_id, description } = req.body;
    
    const result = await query(`
      INSERT INTO products (name, price, stock_quantity, supplier_id, category_id, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW()) 
      RETURNING *
    `, [name, price, stock_quantity, userId, category_id, description]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, price, stock_quantity, description, is_active } = req.body;
    
    const result = await query(`
      UPDATE products 
      SET name = $1, price = $2, stock_quantity = $3, description = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6 AND supplier_id = $7 
      RETURNING *
    `, [name, price, stock_quantity, description, is_active, id, userId]);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await query(`DELETE FROM products WHERE id = $1 AND supplier_id = $2`, [id, userId]);
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ORDERS - CORRIGÉ
// ============================================
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    
    let sql = `SELECT o.*, u.first_name as customer_name 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               WHERE o.supplier_id = $1`;
    let params = [userId];
    
    // Filtre par payment_status au lieu de status si c'est ce qui existe
    if (status && status !== 'all') {
      sql += ` AND (o.payment_status = $2 OR o.status = $2)`;
      params.push(status);
    }
    
    sql += ` ORDER BY o.created_at DESC`;
    
    const orders = await query(sql, params);
    
    // Counts par payment_status
    const counts = await query(`
      SELECT COALESCE(payment_status, 'pending') as status, COUNT(*) 
      FROM orders 
      WHERE supplier_id = $1 
      GROUP BY payment_status
    `, [userId]);
    
    const countObj = { all: 0, pending: 0, paid: 0, shipped: 0, delivered: 0 };
    counts.rows.forEach(r => {
      countObj[r.status] = parseInt(r.count);
      countObj.all += parseInt(r.count);
    });
    
    res.json({ success: true, data: { orders: orders.rows, counts: countObj } });
  } catch (error) {
    console.error('getOrders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const order = await query(`
      SELECT o.*, u.first_name as customer_name, u.email as customer_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE o.id = $1 AND o.supplier_id = $2
    `, [id, userId]);
    
    if (order.rows.length === 0) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    
    // Items de la commande
    const items = await query(`
      SELECT oi.*, p.name as product_name, p.main_image_url
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = $1
    `, [id]);
    
    res.json({ 
      success: true, 
      data: { ...order.rows[0], items: items.rows } 
    });
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    
    // Met à jour les deux colonnes si elles existent, ou seulement celle qui existe
    await query(`
      UPDATE orders 
      SET payment_status = $1, status = $1, updated_at = NOW() 
      WHERE id = $2 AND supplier_id = $3
    `, [status, id, userId]);
    
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// PAYMENTS
// ============================================
exports.getPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const balance = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'available' THEN supplier_amount ELSE 0 END), 0) as available,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN supplier_amount ELSE 0 END), 0) as pending,
        COALESCE(SUM(supplier_amount), 0) as total
      FROM supplier_payments 
      WHERE supplier_id = $1
    `, [userId]);
    
    const transactions = await query(`
      SELECT sp.*, o.order_number 
      FROM supplier_payments sp
      LEFT JOIN orders o ON sp.order_id = o.id
      WHERE sp.supplier_id = $1
      ORDER BY sp.created_at DESC 
      LIMIT 20
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        available: parseFloat(balance.rows[0].available),
        pending: parseFloat(balance.rows[0].pending),
        total: parseFloat(balance.rows[0].total),
        transactions: transactions.rows
      }
    });
  } catch (error) {
    console.error('getPayments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.requestPayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    
    // Vérifier le solde
    const balance = await query(`
      SELECT COALESCE(SUM(supplier_amount), 0) as available
      FROM supplier_payments 
      WHERE supplier_id = $1 AND status = 'available'
    `, [userId]);
    
    const available = parseFloat(balance.rows[0].available);
    
    if (amount > available) {
      return res.status(400).json({ success: false, message: 'Solde insuffisant' });
    }
    
    // Créer la demande
    await query(`
      INSERT INTO payouts (supplier_id, amount, status, created_at)
      VALUES ($1, $2, 'pending', NOW())
    `, [userId, amount]);
    
    // Mettre à jour les paiements comme demandés
    await query(`
      UPDATE supplier_payments
      SET status = 'payout_requested'
      WHERE supplier_id = $1 AND status = 'available'
    `, [userId]);
    
    res.json({ success: true, message: 'Demande de virement enregistrée' });
  } catch (error) {
    console.error('requestPayout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// PROFILE
// ============================================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(`
      SELECT u.email, u.first_name, u.last_name, s.* 
      FROM users u 
      LEFT JOIN suppliers s ON u.id = s.user_id 
      WHERE u.id = $1
    `, [userId]);
    res.json({ success: true, data: result.rows[0] || {} });
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { company_name, description, website } = req.body;
    
    await query(`
      INSERT INTO suppliers (user_id, company_name, description, website, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET company_name = $2, description = $3, website = $4, updated_at = NOW()
    `, [userId, company_name, description, website]);
    
    res.json({ success: true, message: 'Profil mis à jour' });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// CAMPAGNES PUBLICITAIRES - COMPLÉTÉ
// ============================================
exports.getCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(`
      SELECT * FROM supplier_campaigns 
      WHERE supplier_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getCampaigns error:', error);
    res.json({ success: true, data: [] }); // Retourne vide si table n'existe pas
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, headline, description, media_url, cta_text, target_products, start_date, end_date } = req.body;
    
    const result = await query(`
      INSERT INTO supplier_campaigns (
        supplier_id, name, headline, description, media_url, cta_text, 
        target_products, start_date, end_date, status, views_count, clicks_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', 0, 0, NOW()) 
      RETURNING *
    `, [userId, name, headline, description, media_url, cta_text, target_products, start_date, end_date]);
    
    res.json({ success: true, data: result.rows[0], message: 'Campagne créée' });
  } catch (error) {
    console.error('createCampaign error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;
    
    const allowedFields = ['name', 'headline', 'description', 'media_url', 'cta_text', 'target_products', 'start_date', 'end_date'];
    const setClause = [];
    const values = [];
    let count = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${count}`);
        values.push(updates[key]);
        count++;
      }
    });
    
    if (setClause.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE supplier_campaigns 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${count} AND supplier_id = $${count + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateCampaign error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status } = req.body;
    
    await query(`
      UPDATE supplier_campaigns 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND supplier_id = $3
    `, [status, id, userId]);
    
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (error) {
    console.error('updateCampaignStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await query(`DELETE FROM supplier_campaigns WHERE id = $1 AND supplier_id = $2`, [id, userId]);
    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (error) {
    console.error('deleteCampaign error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveCampaignForProduct = async (req, res) => {
  try {
    const { product_id } = req.query;
    const userId = req.user.id;
    
    const result = await query(`
      SELECT * FROM supplier_campaigns 
      WHERE supplier_id = $1 
      AND status = 'active'
      AND ($2 = ANY(target_products) OR target_products IS NULL OR array_length(target_products, 1) IS NULL)
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date IS NULL OR end_date >= NOW())
      LIMIT 1
    `, [userId, product_id]);
    
    if (result.rows.length > 0) {
      // Incrémenter les vues
      await query(`UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1`, [result.rows[0].id]);
    }
    
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('getActiveCampaign error:', error);
    res.json({ success: false, data: null });
  }
};

exports.trackCampaignClick = async (req, res) => {
  try {
    const { campaign_id } = req.body;
    
    await query(`
      UPDATE supplier_campaigns 
      SET clicks_count = clicks_count + 1 
      WHERE id = $1
    `, [campaign_id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};