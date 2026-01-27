// ============================================
// DATABASE CONFIGURATION (PostgreSQL)
// ============================================

const { Pool } = require('pg');
const { env } = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
    host: env.DB.HOST,
    port: env.DB.PORT,
    database: env.DB.NAME,
    user: env.DB.USER,
    password: env.DB.PASSWORD,
    ssl: env.DB.SSL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    logger.info('📦 New client connected to PostgreSQL');
});

pool.on('error', (err) => {
    logger.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time');
        logger.info(`✅ Database connected at ${result.rows[0].current_time}`);
        client.release();
        return true;
    } catch (error) {
        logger.error('❌ Database connection failed:', error.message);
        return false;
    }
};

const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Query executed', { 
            query: text.substring(0, 100), 
            duration: `${duration}ms`,
            rows: result.rowCount 
        });
        return result;
    } catch (error) {
        logger.error('Query error:', { 
            query: text.substring(0, 100), 
            error: error.message 
        });
        throw error;
    }
};

const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    transaction,
    testConnection
};