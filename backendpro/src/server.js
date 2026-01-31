// ============================================
// BRANDIA BACKEND – ENTRY POINT (Render Ready)
// ============================================

const { validateEnv, env } = require('./config/env');
const { testConnection } = require('./config/db');
// ============================================
// BRANDIA BACKEND – ENTRY POINT (Render Ready)
// ============================================

const { validateEnv, env } = require('./config/env');
const { testConnection } = require('./config/db');
const initDatabase = require('./config/init-db'); // 🎯 AJOUTE CETTE LIGNE
const app = require('./app');
const logger = require('./utils/logger');

const startServer = async () => {
  try {
    logger.info('🔍 Validating environment...');
    validateEnv();

    logger.info('📦 Testing database...');
    await testConnection();
    
    // 🎯 CRÉATION AUTO DES TABLES (AVANT de démarrer le serveur)
    await initDatabase();
    logger.info('✅ Database initialized');

    const PORT = env.PORT || process.env.PORT || 4000;
    
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Brandia API running on port ${PORT}`);
      logger.info(`📍 Environment: ${env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown (garde ton code existant)
    const gracefulShutdown = (signal) => {
      logger.info(`📴 Received ${signal}. Shutting down...`);
      server.close(() => {
        logger.info('🔌 Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
const app = require('./app');
const logger = require('./utils/logger');

// ============================================
// START SERVER
// ============================================
const initDatabase = require('./config/init-db');
// ...
await testConnection();
await initDatabase(); // Ajoute cette ligne
const startServer = async () => {
  try {
    // 1️⃣ Validate environment variables
    logger.info('🔍 Validating environment variables...');
    validateEnv();

    // 2️⃣ Test database connection (CRITICAL IN PROD)
    logger.info('📦 Testing database connection...');
    await testConnection();
    logger.info('✅ Database connected');

    // 3️⃣ Start HTTP server
    const PORT = env.PORT || process.env.PORT || 4000;

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Brandia API running on ${env.API_URL || `http://localhost:${PORT}`}`);
      logger.info(`📍 Environment: ${env.NODE_ENV || 'development'}`);
      logger.info(`🛢️  Database: ${env.DB?.HOST}:${env.DB?.PORT}/${env.DB?.NAME}`);
      logger.info('✅ CORS: Enabled for all origins (*)');
    });

    // ============================================
    // Graceful shutdown
    // ============================================

    const gracefulShutdown = (signal) => {
      logger.info(`📴 Received ${signal}. Shutting down gracefully...`);

      server.close(() => {
        logger.info('🔌 HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('⏱️ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Server startup failed:', error.message);
    process.exit(1); // ⛔ STOP server if DB or ENV fails
  }
};

// Launch
startServer();
