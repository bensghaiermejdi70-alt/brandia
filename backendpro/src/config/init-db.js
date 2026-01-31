const { pool } = require('./db');
const logger = require('../utils/logger');

const initDatabase = async () => {
  try {
    logger.info('🔧 Vérification/Création des tables...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) DEFAULT 0,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        vat_amount DECIMAL(10,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'EUR',
        customer_email VARCHAR(255),
        customer_first_name VARCHAR(100),
        customer_last_name VARCHAR(100),
        shipping_address TEXT,
        shipping_city VARCHAR(100),
        shipping_postal_code VARCHAR(20),
        shipping_country_code VARCHAR(2) DEFAULT 'FR',
        stripe_payment_intent_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        product_name VARCHAR(255),
        product_sku VARCHAR(100),
        product_image_url TEXT,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        vat_rate DECIMAL(5,2) DEFAULT 20,
        supplier_amount DECIMAL(10,2) DEFAULT 0,
        commission_amount DECIMAL(10,2) DEFAULT 0,
        fulfillment_status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);
      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS stripe_account_status VARCHAR(50) DEFAULT 'pending';
    `);
    
    logger.info('✅ Tables vérifiées/créées avec succès');
  } catch (error) {
    logger.error('❌ Erreur création tables:', error);
  }
};

module.exports = initDatabase;
