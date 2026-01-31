// ============================================
// BRANDIA BACKEND – ENTRY POINT (Render Ready)
// ============================================

const { validateEnv, env } = require('./config/env');
const { testConnection } = require('./config/db');
const initDatabase = require('./config/init-db'); // ✅ UN SEUL import
const app = require('./app');
const logger = require('./utils/logger');

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
  try {
    // 1️⃣ Validate environment variables
    logger.info('🔍 Validating environment variables...');
    validateEnv();

    // 2️⃣ Test database connection
    logger.info('📦 Testing database connection...');
    await testConnection();
    logger.info('✅ Database connected');

    // 3️⃣ 🎯 INITIALISATION DB (création tables si manquantes)
    logger.info('🔧 Initializing database tables...');
    await initDatabase();
    logger.info('✅ Database initialized');

    // 4️⃣ Start HTTP server
    const PORT = env.PORT || process.env.PORT || 4000;

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Brandia API running on ${env.API_URL || `http://localhost:${PORT}`}`);
      logger.info(`📍 Environment: ${env.NODE_ENV || 'development'}`);
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
    process.exit(1);
  }
};

// Launch
startServer();