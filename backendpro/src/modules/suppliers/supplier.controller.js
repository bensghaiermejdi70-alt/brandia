const pool = require('../../config/db');

// Helper pour réponses uniformes
const formatResponse = (success, data = null, message = null) => ({
  success,
  ...(data && { data }),
  ...(message && { message })
});

// ==========================================
// DASHBOARD STATS
// ==========================================

exports.getDashboardStats = async (req, res) => {
  try {
    const supplierId = req.user.id;
    
    // Stats produits
    const productsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true AND status = 'published' THEN 1 END) as active
      FROM products 
      WHERE supplier_id = $1
    `, [supplierId]);
    
    // Stats commandes
    const ordersResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM orders 
      WHERE supplier_id = $1
    `, [supplierId]);
    
    // Stats finances
    const financesResult = await pool.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(commission_amount), 0) as commission,
        COALESCE(SUM(supplier_amount), 0) as balance
      FROM orders 
      WHERE supplier_id = $1 AND status IN ('paid', 'shipped', 'delivered')
    `, [supplierId]);
    
    // Commandes récentes (mock pour l'instant)
    const recentOrders = [
      {
        id: 1,
        order_number: 'BRD-2024-001',
        total_amount: 89.99,
        status: 'pending',
        created_at: new Date().toISOString(),
        customer_name: 'Client Test',
        items: [{ product_name: 'Sérum Hydratant', quantity: 1 }]
      }
    ];
    
    res.json(formatResponse(true, {
      products: productsResult.rows[0] || { total: 0, active: 0 },
      orders: {
        total: parseInt(ordersResult.rows[0]?.total) || 0,
        pending: parseInt(ordersResult.rows[0]?.pending) || 0,
        recent: recentOrders
      },
      finances: {
        revenue: parseFloat(financesResult.rows[0]?.revenue) || 0,
        commission: parseFloat(financesResult.rows[0]?.commission) || 0,
        balance: parseFloat(financesResult.rows[0]?.balance) || 0
      }
    }));
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

// ==========================================
// PRODUITS
// ==========================================

exports.getProducts = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = `SELECT * FROM products WHERE supplier_id = $1`;
    const params = [supplierId];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Count
    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json(formatResponse(true, {
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
    
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.createProduct = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { name, price, stock_quantity, status = 'draft' } = req.body;
    
    if (!name || price === undefined || stock_quantity === undefined) {
      return res.status(400).json(formatResponse(false, null, 'Nom, prix et stock requis'));
    }
    
    const result = await pool.query(`
      INSERT INTO products (supplier_id, name, price, stock_quantity, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [supplierId, name, price, stock_quantity, status]);
    
    res.status(201).json(formatResponse(true, { product: result.rows[0] }, 'Produit créé'));
    
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const productId = req.params.id;
    const updates = req.body;
    
    // Vérifier propriété
    const check = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND supplier_id = $2',
      [productId, supplierId]
    );
    
    if (check.rows.length === 0) {
      return res.status(403).json(formatResponse(false, null, 'Produit non trouvé'));
    }
    
    const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const result = await pool.query(`
      UPDATE products SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *
    `, [productId, ...Object.values(updates)]);
    
    res.json(formatResponse(true, { product: result.rows[0] }, 'Produit mis à jour'));
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const productId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 AND supplier_id = $2 RETURNING id',
      [productId, supplierId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Produit non trouvé'));
    }
    
    res.json(formatResponse(true, null, 'Produit supprimé'));
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

// ==========================================
// COMMANDES
// ==========================================

exports.getOrders = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { status } = req.query;
    
    let query = `SELECT * FROM orders WHERE supplier_id = $1`;
    const params = [supplierId];
    
    if (status && status !== 'all') {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json(formatResponse(true, { orders: result.rows }));
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const orderId = req.params.id;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(formatResponse(false, null, 'Statut invalide'));
    }
    
    const result = await pool.query(`
      UPDATE orders SET status = $1, updated_at = NOW() 
      WHERE id = $2 AND supplier_id = $3 RETURNING *
    `, [status, orderId, supplierId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Commande non trouvée'));
    }
    
    res.json(formatResponse(true, { order: result.rows[0] }, 'Statut mis à jour'));
    
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

// ==========================================
// PAIEMENTS
// ==========================================

exports.getPayments = async (req, res) => {
  try {
    const supplierId = req.user.id;
    
    // Mock data pour l'instant
    res.json(formatResponse(true, {
      available: 1250.00,
      pending: 450.00,
      total_paid: 8750.00,
      transactions: []
    }));
    
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Montant invalide'));
    }
    
    res.json(formatResponse(true, null, 'Demande de virement envoyée'));
    
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

// ==========================================
// PROFIL
// ==========================================

exports.getProfile = async (req, res) => {
  try {
    const supplierId = req.user.id;
    
    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone
      FROM users u WHERE u.id = $1
    `, [supplierId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Profil non trouvé'));
    }
    
    res.json(formatResponse(true, { profile: result.rows[0] }));
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { first_name, last_name, phone } = req.body;
    
    await pool.query(`
      UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW()
      WHERE id = $4
    `, [first_name, last_name, phone, supplierId]);
    
    res.json(formatResponse(true, null, 'Profil mis à jour'));
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

// ==========================================
// PROMOTIONS
// ==========================================

exports.getPromotions = async (req, res) => {
  try {
    res.json(formatResponse(true, { promotions: [] }));
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};

exports.createPromotion = async (req, res) => {
  try {
    res.json(formatResponse(true, null, 'Promotion créée'));
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json(formatResponse(false, null, 'Erreur serveur'));
  }
};