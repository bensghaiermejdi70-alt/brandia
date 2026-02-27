// supplier.controller.js - Ajouter cette fonction

async getCampaignLimit(req, res) {
  try {
    const supplierId = req.user.id;
    
    // Get max campaigns allowed (set by admin, default 5)
    // You can store this in supplier_ad_settings table or suppliers table
    const result = await db.query(`
      SELECT 
        COALESCE(s.max_campaigns, 5) as max_campaigns,
        COUNT(c.id) as current_count
      FROM suppliers s
      LEFT JOIN supplier_campaigns c ON c.supplier_id = s.id AND c.status = 'active'
      WHERE s.user_id = $1
      GROUP BY s.max_campaigns
    `, [supplierId]);
    
    const limit = result.rows[0] || { max_campaigns: 5, current_count: 0 };
    
    res.json({
      success: true,
      data: {
        max_campaigns: parseInt(limit.max_campaigns),
        current_count: parseInt(limit.current_count),
        remaining: parseInt(limit.max_campaigns) - parseInt(limit.current_count)
      }
    });
  } catch (error) {
    console.error('Get campaign limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
}

// Dans supplier.routes.js
router.get('/campaigns/limit', authMiddleware, supplierController.getCampaignLimit);