// ============================================
// INIT DATABASE - Création auto des tables manquantes
// ============================================

const { pool } = require('./db');
const logger = require('../utils/logger');

const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    logger.info('🔧 Vérification/Création des tables...');
    
    await client.query(`
      -- TABLE ORDERS (Commandes)
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        vat_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'EUR',
        vat_rate DECIMAL(5,2) DEFAULT 20,
        customer_email VARCHAR(255),
        customer_first_name VARCHAR(100),
        customer_last_name VARCHAR(100),
        customer_phone VARCHAR(50),
        shipping_address TEXT,
        shipping_city VARCHAR(100),
        shipping_postal_code VARCHAR(20),
        shipping_country_code VARCHAR(2) DEFAULT 'FR',
        billing_address TEXT,
        billing_city VARCHAR(100),
        billing_postal_code VARCHAR(20),
        billing_country_code VARCHAR(2) DEFAULT 'FR',
        tracking_number VARCHAR(100),
        stripe_payment_intent_id VARCHAR(255),
        paid_at TIMESTAMP,
        shipped_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TABLE ORDER_ITEMS (Lignes de commande)
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        product_name VARCHAR(255) NOT NULL,
        product_sku VARCHAR(100),
        product_image_url TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        vat_rate DECIMAL(5,2) DEFAULT 20,
        supplier_amount DECIMAL(10,2) DEFAULT 0,
        commission_amount DECIMAL(10,2) DEFAULT 0,
        fulfillment_status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- INDEX pour performances
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_supplier_id ON order_items(supplier_id);

      -- Colonnes manquantes dans SUPPLIERS (pour Stripe Connect)
      ALTER TABLE suppliers 
        ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS stripe_account_status VARCHAR(50) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS siret VARCHAR(50);

      -- Colonnes manquantes dans PRODUCTS (si besoin)
      ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    
    logger.info('✅ Tables vérifiées/créées avec succès');
    
    // Vérifier que les tables existent vraiment
    const checkOrders = await client.query("SELECT to_regclass('public.orders') as exists");
    const checkItems = await client.query("SELECT to_regclass('public.order_items') as exists");
    
    if (checkOrders.rows[0].exists && checkItems.rows[0].exists) {
      logger.info('✅ Tables orders et order_items confirmées en base');
    } else {
      logger.error('❌ Problème création tables');
    }
    
  } catch (error) {
    logger.error('❌ Erreur création tables:', error.message);
    throw error; // On propage l'erreur pour bloquer le démarrage si la DB est KO
  } finally {
    client.release();
  }
};

module.exports = initDatabase;