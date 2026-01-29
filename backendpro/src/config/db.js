// ============================================
// DATABASE CONFIG - PostgreSQL (Render ready)
// ============================================

const { Pool } = require('pg');
const { env } = require('./env');

const pool = new Pool({
  host: env.DB.HOST,
  port: env.DB.PORT || 5432,
  database: env.DB.NAME,
  user: env.DB.USER,
  password: env.DB.PASSWORD,
  ssl: env.DB.SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,           // max connections
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 2000, // fail after 2s if cannot connect
});

// Fonction de test de connexion
const testConnection = async () => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
    return false;
  }
};

module.exports = {
  pool,
  testConnection
};
