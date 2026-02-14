// Ligne ~320-340 : Méthode getProducts
async getProducts(req, res) {
    try {
      const userId = req.user.id;
      
      const supplierResult = await db.query(
        'SELECT id FROM suppliers WHERE user_id = $1 LIMIT 1',  // ✅ Cherche user_id
        [userId]
      );
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil fournisseur non trouvé' });
      }
      
      const supplierId = supplierResult.rows[0].id;

      const result = await db.query(`
        SELECT id, name, price, stock_quantity, main_image_url, is_active, category_id, slug
        FROM products 
        WHERE supplier_id = $1   // ✅ Filtre par supplier_id (correct)
        ORDER BY created_at DESC
      `, [supplierId]);
      
      res.json({ 
        success: true, 
        data: { products: result.rows }  // ✅ Retourne { data: { products: [] } }
      });
      
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }