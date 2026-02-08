const db = require('../../config/db');
const { uploadImage } = require('../../utils/cloudinary');
const multer = require('multer');

/* ================= MULTER ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images et vidéos sont autorisées'), false);
    }
  }
});

/* ================= CONTROLLER ================= */

class SupplierController {

  /* ================= PRODUITS ================= */

  async getProducts(req, res) {
    try {
      const supplierId = req.user.id;

      const result = await db.query(`
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.supplier_id = $1
        ORDER BY p.created_at DESC
      `, [supplierId]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ✅ CREATE PRODUCT (CORRIGÉ) */
  async createProduct(req, res) {
    try {
      const supplierId = req.user.id;

      const {
        name,
        description = '',
        price,
        stock_quantity = 10, // ✅ DEFAULT 10
        category_id = null,
        main_image_url = null
      } = req.body;

      // ✅ VALIDATION
      if (!name || !price) {
        return res.status(400).json({
          success: false,
          message: 'Nom et prix requis'
        });
      }

      const result = await db.query(`
        INSERT INTO products 
        (supplier_id, name, description, price, stock_quantity, category_id, main_image_url, is_active, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW())
        RETURNING *
      `, [
        supplierId,
        name.trim(),
        description.trim(),
        price,
        stock_quantity,
        category_id,
        main_image_url
      ]);

      res.json({ success: true, data: result.rows[0] });

    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const supplierId = req.user.id;

      const {
        name,
        description = '',
        price,
        stock_quantity = 10,
        category_id = null,
        main_image_url = null
      } = req.body;

      const result = await db.query(`
        UPDATE products
        SET 
          name = $1,
          description = $2,
          price = $3,
          stock_quantity = $4,
          category_id = $5,
          main_image_url = $6,
          updated_at = NOW()
        WHERE id = $7 AND supplier_id = $8
        RETURNING *
      `, [
        name,
        description,
        price,
        stock_quantity,
        category_id,
        main_image_url,
        id,
        supplierId
      ]);

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      res.json({ success: true, data: result.rows[0] });

    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const supplierId = req.user.id;

      await db.query(
        'DELETE FROM products WHERE id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      res.json({ success: true, message: 'Produit supprimé' });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /* ================= UPLOAD IMAGE ================= */

  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucune image fournie'
        });
      }

      const result = await uploadImage(req.file.buffer, 'brandia/products');
      res.json({ success: true, data: result });

    } catch (error) {
      console.error('Upload image error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

/* ================= EXPORT ================= */

const controller = new SupplierController();

module.exports = {
  controller,
  uploadMiddleware: upload.single('image'),

  getProducts: controller.getProducts.bind(controller),
  createProduct: controller.createProduct.bind(controller),
  updateProduct: controller.updateProduct.bind(controller),
  deleteProduct: controller.deleteProduct.bind(controller),
  uploadImage: controller.uploadImage.bind(controller)
};
