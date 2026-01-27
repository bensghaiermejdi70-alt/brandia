// ============================================
// BRANDIA APP - Configuration Express
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const supplierRoutes = require('./modules/supplier/supplier.routes');
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

// ============================================
// CORS CORRIGÉ - VERSION DÉVELOPPEMENT
// ============================================

// Option 1: Autoriser TOUTES les origines (développement uniquement)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Option 2: Origines spécifiques (décommenter pour production)
// const allowedOrigins = [
//   'http://localhost:3000',
//   'http://127.0.0.1:3000',
//   'http://localhost:5500',
//   'http://127.0.0.1:5500',
//   'null' // Pour les fichiers locaux ouverts directement
// ];
// 
// app.use(cors({
//   origin: function(origin, callback) {
//     // Autoriser les requêtes sans origine (Postman, mobile apps)
//     if (!origin) return callback(null, true);
//     
//     if (allowedOrigins.indexOf(origin) === -1) {
//       const msg = 'CORS policy: Origin not allowed';
//       return callback(new Error(msg), false);
//     }
//     return callback(null, true);
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));

// ============================================
// WEBHOOK STRIPE (AVANT express.json())
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

// Routes principales (inclut auth, products, orders, payments, countries)
app.use('/api', routes);

// Routes supplier (dashboard fournisseur)
app.use('/api/supplier', supplierRoutes);

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