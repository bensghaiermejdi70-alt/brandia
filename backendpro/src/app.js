// ============================================
// BRANDIA APP - Configuration Express
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

const app = express();

// ============================================
// MIDDLEWARE DE SÉCURITÉ
// ============================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

/// ============================================
// CORS - Origines spécifiques (PROD + DEV)
// ============================================

const allowedOrigins = [
  'https://brandia-marketplace.netlify.app',
  'https://bensghaiermejdi70-alt.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500', // Live Server local
  null // Pour les requêtes sans origin (Postman, mobile)
];

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (Postman) ou celles dans la liste
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS bloqué pour:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ============================================
// WEBHOOK STRIPE (raw body)
// ============================================

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ============================================
// PARSING JSON
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// LOGGER
// ============================================

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    origin: req.headers.origin || 'no-origin',
    userAgent: req.get('user-agent')
  });
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Brandia API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    cors: 'enabled'
  });
});

// ============================================
// ROUTES
// ============================================
app.use('/api', routes);                    // tes autres routes
app.use('/api/test-email', require('./routes/testEmail'));


// ============================================
// GESTION ERREURS
// ============================================

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Erreurs globales
app.use(errorMiddleware);

module.exports = app;
