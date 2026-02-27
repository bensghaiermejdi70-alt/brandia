// ============================================
// SERVER.JS - Brandia Backend Entry Point v4.0
// Render Ready avec gestion améliorée des erreurs de démarrage
// ============================================

const { validateEnv, env } = require('./config/env');
const { testConnection } = require('./config/db');
const initDatabase = require('./config/init-db');
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

        // 3️⃣ Initialisation DB
        logger.info('🔧 Initializing database tables...');
        await initDatabase();
        logger.info('✅ Database initialized');

        // 4️⃣ Start HTTP server
        const PORT = env.PORT || process.env.PORT || 4000;

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Brandia API v4.0 running on port ${PORT}`);
            logger.info(`📍 Environment: ${env.NODE_ENV || 'development'}`);
            logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
            logger.info(`📹 Video proxy: http://localhost:${PORT}/api/proxy/video?url=VIDEO_URL`);
            logger.info(`📊 Supplier API: http://localhost:${PORT}/api/supplier/stats (with auth)`);
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

        process.on('uncaughtException', (err) => {
            logger.error('💥 Uncaught Exception:', err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        });

    } catch (error) {
        logger.error('❌ Server startup failed:', error.message);
        logger.error('Stack:', error.stack);
        process.exit(1);
    }
};

// Launch
startServer();