// ============================================
// BRANDIA BACKEND – ENTRY POINT
// ============================================

const { validateEnv, env } = require('./config/env');
const { testConnection } = require('./config/db');
const app = require('./app');
const logger = require('./utils/logger');

// ============================================
// VALIDATION & DÉMARRAGE
// ============================================

const startServer = async () => {
  try {
    // Étape 1: Valider les variables d'environnement
    logger.info('🔍 Validating environment variables...');
    validateEnv();

    // Étape 2: Tester la connexion à la base de données
    logger.info('📦 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('❌ Cannot start server without database connection');
      process.exit(1);
    }

    // Étape 3: Démarrer le serveur HTTP
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Brandia API running on ${env.API_URL}`);
      logger.info(`📍 Environment: ${env.NODE_ENV}`);
      logger.info(`🛢️  Database: ${env.DB.HOST}:${env.DB.PORT}/${env.DB.NAME}`);
      logger.info(`👤 Supplier dashboard: ${env.API_URL}/api/supplier/dashboard`);
      logger.info(`✅ CORS: Enabled for all origins (*)`);
    });

    // Gestion gracieuse de l'arrêt
    const gracefulShutdown = (signal) => {
      logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('🔌 HTTP server closed');
        process.exit(0);
      });

      // Forcer l'arrêt après 30s si bloqué
      setTimeout(() => {
        logger.error('⏱️ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Lancer le serveur
startServer();