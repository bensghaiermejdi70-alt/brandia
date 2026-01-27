// ============================================
// COUNTRY & CATEGORY CONTROLLER
// ============================================

const { query } = require('../../config/db');
const logger = require('../../utils/logger');

const CountryController = {
    // Récupérer tous les pays actifs
    getCountries: async (req, res) => {
        try {
            const sql = `SELECT code, name, name_en, currency, vat_rate FROM countries WHERE is_active = true ORDER BY name`;
            const result = await query(sql);
            
            res.json({
                success: true,
                data: { countries: result.rows }
            });
        } catch (error) {
            logger.error('❌ Erreur récupération pays:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    },

    // Récupérer toutes les catégories
    getCategories: async (req, res) => {
        try {
            const sql = `SELECT id, name, slug, description, image_url FROM categories WHERE is_active = true ORDER BY sort_order, name`;
            const result = await query(sql);
            
            res.json({
                success: true,
                data: { categories: result.rows }
            });
        } catch (error) {
            logger.error('❌ Erreur récupération catégories:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    }
};

module.exports = CountryController;