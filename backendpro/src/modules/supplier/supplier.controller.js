const { query } = require('../../config/db');

// Helper vérification supplier
const checkSupplier = async (userId) => {
  const result = await query('SELECT id, role FROM users WHERE id = $1 AND role = $2', [userId, 'supplier']);
  return result.rows[0];
};

exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // CA et commandes
    const revenue = await query(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM orders WHERE supplier_id = $1 AND status IN ('paid', 'shipped', 'delivered')
    `, [userId]);
    
    // En attente
    const pending = await query(`SELECT COUNT(*) as count FROM orders WHERE supplier_id = $1 AND status = 'pending'`, [userId]);
    
    // Produits
    const products = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'published') as active,
        COUNT(*) as total
      FROM products WHERE supplier_id = $1
    `, [userId]);
    
    // Solde
    const balance = await query(`
      SELECT COALESCE(SUM(supplier_amount), 0) as available 
      FROM supplier_payments WHERE supplier_id = $1 AND status = 'available'
    `, [userId]);
    
    // Commandes récentes
    const recentOrders = await query(`
      SELECT o.id, o.order_number, o.created_at, o.total_amount, o.status, u.first_name as customer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.supplier_id = $1
      ORDER BY o.created_at DESC LIMIT 5
    `, [userId]);
    
    // Top produits
    const topProducts = await query(`
      SELECT p.name, SUM(oi.quantity) as sales, SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.supplier_id = $1 AND o.status = 'delivered'
      GROUP BY p.id ORDER BY sales DESC LIMIT 5
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        finances: {
          revenue: parseFloat(revenue.rows[0].total),
          balance: parseFloat(balance.rows[0].available),
          revenueTrend: 0
        },
        orders: {
          total: parseInt(revenue.rows[0].count),
          pending: parseInt(pending.rows[0].count),
          recent: recentOrders.rows
        },
        products: {
          active: parseInt(products.rows[0].active),
          total: parseInt(products.rows[0].total)
        },
        topProducts: topProducts.rows
      }
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 12, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `SELECT p.*, c.name as category_name 
               FROM products p 
               LEFT JOIN categories c ON p.category_id = c.id 
               WHERE p.supplier_id = $1`;
    let params = [userId];
    
    if (search) {
      sql += ` AND p.name ILIKE $2`;
      params.push(`%${search}%`);
    }
    
    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, price, stock_quantity, category_id } = req.body;
    
    const result = await query(`
      INSERT INTO products (name, price, stock_quantity, supplier_id, category_id, status)
      VALUES ($1, $2, $3, $4, $5, 'published') RETURNING *
    `, [name, price, stock_quantity, userId, category_id]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, price, stock_quantity } = req.body;
    
    const result = await query(`
      UPDATE products SET name = $1, price = $2, stock_quantity = $3, updated_at = NOW()
      WHERE id = $4 AND supplier_id = $5 RETURNING *
    `, [name, price, stock_quantity, id, userId]);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await query(`DELETE FROM products WHERE id = $1 AND supplier_id = $2`, [id, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    
    let sql = `SELECT o.*, u.first_name as customer_name 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               WHERE o.supplier_id = $1`;
    let params = [userId];
    
    if (status && status !== 'all') {
      sql += ` AND o.status = $2`;
      params.push(status);
    }
    
    sql += ` ORDER BY o.created_at DESC`;
    
    const orders = await query(sql, params);
    
    // Counts par statut
    const counts = await query(`
      SELECT status, COUNT(*) FROM orders WHERE supplier_id = $1 GROUP BY status
    `, [userId]);
    
    const countObj = { all: 0, pending: 0, paid: 0, shipped: 0, delivered: 0 };
    counts.rows.forEach(r => {
      countObj[r.status] = parseInt(r.count);
      countObj.all += parseInt(r.count);
    });
    
    res.json({ success: true, data: { orders: orders.rows, counts: countObj } });
  } catch (error) {
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
    
    if (order.rows.length === 0) return res.status(404).json({ success: false });
    
    // Items de la commande
    const items = await query(`
      SELECT oi.*, p.name as product_name 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = $1
    `, [id]);
    
    res.json({ 
      success: true, 
      data: { ...order.rows[0], items: items.rows } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    
    await query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND supplier_id = $3`, [status, id, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const balance = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'available' THEN supplier_amount ELSE 0 END), 0) as available,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN supplier_amount ELSE 0 END), 0) as pending
      FROM supplier_payments WHERE supplier_id = $1
    `, [userId]);
    
    const transactions = await query(`
      SELECT sp.*, o.order_number 
      FROM supplier_payments sp
      JOIN orders o ON sp.order_id = o.id
      WHERE sp.supplier_id = $1
      ORDER BY sp.created_at DESC LIMIT 20
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        available: parseFloat(balance.rows[0].available),
        pending: parseFloat(balance.rows[0].pending),
        transactions: transactions.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.requestPayout = async (req, res) => {
  res.json({ success: false, message: 'Fonctionnalité en cours de développement' });
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(`
      SELECT u.email, s.* 
      FROM users u 
      LEFT JOIN suppliers s ON u.id = s.user_id 
      WHERE u.id = $1
    `, [userId]);
    res.json({ success: true, data: result.rows[0] || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  res.json({ success: true });
};

// CAMPAGNES PUBLICITAIRES
exports.getCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(`SELECT * FROM supplier_campaigns WHERE supplier_id = $1 ORDER BY created_at DESC`, [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.json({ success: true, data: [] }); // Si table n'existe pas, retourne vide
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, headline, description, media_url, target_products } = req.body;
    
    const result = await query(`
      INSERT INTO supplier_campaigns (supplier_id, name, headline, description, media_url, target_products, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *
    `, [userId, name, headline, description, media_url, target_products]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveCampaignForProduct = async (req, res) => {
  try {
    const { supplier_id, product_id } = req.query;
    
    const result = await query(`
      SELECT * FROM supplier_campaigns 
      WHERE supplier_id = $1 
      AND status = 'active'
      AND (target_products @> ARRAY[$2]::integer[] OR target_products IS NULL)
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date IS NULL OR end_date >= NOW())
      LIMIT 1
    `, [supplier_id, product_id]);
    
    if (result.rows.length > 0) {
      // Incrémenter les vues
      await query(`UPDATE supplier_campaigns SET views_count = views_count + 1 WHERE id = $1`, [result.rows[0].id]);
      res.json({ success: true, data: result.rows[0] });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.json({ success: false });
  }
};