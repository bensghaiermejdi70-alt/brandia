// ============================================
// PUBLIC ROUTES - Routes sans authentification
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ============================================
// CAMPAGNES PUBLICITAIRES (Public)
// ============================================

// Récupérer campagne active pour un produit
router.get('/campaigns', async (req, res) => {
  try {
    const { supplier, product } = req.query;

    if (!supplier || !product) {
      return res.status(400).json({ 
        success: false, 
        message: 'supplier et product sont requis' 
      });
    }

    const result = await db.query(
      `SELECT * FROM supplier_campaigns
       WHERE supplier_id = $1
         AND $2 = ANY(target_products)
         AND status = 'active'
         AND start_date <= NOW()
         AND end_date >= NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [supplier, product]
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('[Public Campaigns] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tracker une vue
router.post('/campaigns/view', async (req, res) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

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
    console.error('[Track View] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tracker un clic
router.post('/campaigns/click', async (req, res) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

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
    console.error('[Track Click] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;