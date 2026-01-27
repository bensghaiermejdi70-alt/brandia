// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

require('dotenv').config();

const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
];

const validateEnv = () => {
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        process.exit(1);
    }
    
    console.log('✅ Environment variables validated');
};

const env = {
    // App
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT) || 4000,
    API_URL: process.env.API_URL || 'http://localhost:4000',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Database
    DB: {
        HOST: process.env.DB_HOST,
        PORT: parseInt(process.env.DB_PORT) || 5432,
        NAME: process.env.DB_NAME,
        USER: process.env.DB_USER,
        PASSWORD: process.env.DB_PASSWORD,
        SSL: process.env.DB_SSL === 'true'
    },
    
    // JWT
    JWT: {
        SECRET: process.env.JWT_SECRET,
        REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    
    // Stripe
    STRIPE: {
        SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
        WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        PLATFORM_FEE_PERCENT: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 15
    },
    
    // Email (optionnel)
    EMAIL: {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        FROM: process.env.EMAIL_FROM || 'noreply@brandia.com'
    },
    
    // Upload
    UPLOAD: {
        MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024,
        ALLOWED_TYPES: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(',')
    }
};

module.exports = { env, validateEnv };