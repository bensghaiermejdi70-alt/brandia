// ============================================
// SUPPLIER CONTROLLER - VERSION FINALE CORRIGÉE
// ============================================

const db = require('../../config/db');
const multer = require('multer');
const {
  uploadImage: uploadImageToCloudinary,
  uploadVideo: uploadVideoToCloudinary
} = require('../../utils/cloudinary');

/* ================= MULTER CONFIG ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    console.log('[Multer] File received:', {
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname
    });

    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images et vidéos sont autorisées'));
    }
  }
});

/* ================= CONTROLLER ================= */

class SupplierController {
  /* ================= UPLOAD IMAGE ================= */
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
      }
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ success: false, message: 'Le fichier doit être une image' });
      }
      const result = await uploadImageToCloudinary(req.file.buffer);
      res.json({ success: true, data: { url: result.url || result, type: 'image' } });
    } catch (error) {
      console.error('[Upload Image] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur upload image: ' + error.message });
    }
  }

  /* ================= UPLOAD VIDEO ================= */
  async uploadCampaignVideo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier vidéo fourni' });
      }
      if (!req.file.mimetype.startsWith('video/')) {
        return res.status(400).json({ success: false, message: 'Le fichier doit être une vidéo (MP4, WebM)' });
      }
      if (req.file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'La vidéo ne doit pas dépasser 50MB' });
      }
      const result = await uploadVideoToCloudinary(req.file.buffer);
      res.json({ success: true, data: { url: result.url || result, type: 'video', thumbnailUrl: result.thumbnailUrl || null } });
    } catch (error) {
      console.error('[Upload Video] Error:', error);
      res.status(500).json({ success: false, message: 'Erreur upload vidéo: ' + error.message });
    }
  }

  /* ================= PRODUITS ================= */
  async getProducts(req, res) {
    try {
      const supplierId = req.user.id;
      const result = await db.query('SELECT * FROM products WHERE supplier_id=$1 ORDER BY created_at DESC', [supplierId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[Get Products] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { name, price, stock, description, category_id } = req.body;
      const result = await db.query(
        `INSERT INTO products (supplier_id,name,price,stock,description,category_id,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
        [supplierId, name, price, stock, description, category_id]
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
      const { name, price, stock, description, category_id } = req.body;
      const result = await db.query(
        `UPDATE products
         SET name=$1, price=$2, stock=$3, description=$4, category_id=$5, updated_at=NOW()
         WHERE id=$6 AND supplier_id=$7 RETURNING *`,
        [name, price, stock, description, category_id, id, supplierId]
      );
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Produit non trouvé' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[Update Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;
      await db.query('DELETE FROM products WHERE id=$1 AND supplier_id=$2', [id, supplierId]);
      res.json({ success: true, message: 'Produit supprimé' });
    } catch (error) {
      console.error('[Delete Product] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= STATS ================= */
  async getStats(req, res) {
    try {
      const supplierId = req.user.id;
      const [sales, orders, products] = await Promise.all([
        db.query('SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE supplier_id=$1', [supplierId]),
        db.query('SELECT COUNT(*) FROM orders WHERE supplier_id=$1', [supplierId]),
        db.query('SELECT COUNT(*) FROM products WHERE supplier_id=$1 AND is_active=true', [supplierId])
      ]);
      res.json({
        success: true,
        data: {
          totalSales: Number(sales.rows[0].coalesce),
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

/* ================= EXPORT FINAL ================= */

const controller = new SupplierController();

module.exports = {
  controller, // ⚡️ IMPORTANT pour routes
  uploadMiddleware: upload.single('media')
};
