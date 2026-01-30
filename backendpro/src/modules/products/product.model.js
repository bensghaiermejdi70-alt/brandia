// backendpro/src/modules/products/product.model.js
const { query } = require('../../config/db');

const ProductModel = {
    findAll: async () => {
        try {
            console.log('🔍 Tentative requête produits...');
            const result = await query('SELECT id, name, price FROM products LIMIT 10');
            console.log('✅ Résultat:', result);
            console.log('📊 Rows:', result.rows);
            console.log('📊 Nombre:', result.rows ? result.rows.length : 0);
            return result.rows || [];
        } catch (err) {
            console.error('❌ Erreur SQL:', err.message);
            throw err;
        }
    },
    
    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
        return result.rows[0];
    },
    
    findFeatured: async (limit = 8) => {
        const result = await query('SELECT * FROM products WHERE is_featured = true LIMIT $1', [limit]);
        return result.rows;
    }
};

module.exports = ProductModel;