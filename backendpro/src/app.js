// ============================================
// APP.JS - Configuration Express Brandia v2.0
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARES DE BASE
// ============================================

// Sécurité HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Désactivé pour permettre CDN
}));

// Logging
app.use(morgan('[:date[iso]] :method :url - Status: :status - :response-time ms'));

// Parsing JSON et URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CORS CONFIGURATION
// ============================================

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'https://brandia-marketplace.netlify.app',
  'https://brandia.company',
  'https://www.brandia.company'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('[CORS] Blocked origin:', origin);
      // Temporairement autoriser tous les origins en dev
      return callback(null, true);
    }
    
    console.log('[CORS] Allowed origin:', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ============================================
// STATIC FILES
// ============================================

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// ROUTES
// ============================================

console.log('[App] Loading routes...');

// Routes principales (auth, products, orders, payments, etc.)
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);

// Routes fournisseur (dashboard, uploads, campaigns, etc.)
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);

console.log('[App] Routes loaded successfully');

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'brandia-api',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 - Route non trouvée
app.use((req, res, next) => {
  console.log('[404] Route not found:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: 'Endpoint non trouvé',
    path: req.path,
    method: req.method
  });
});

// 500 - Erreur serveur
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  
  // Erreur Multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Fichier trop grand'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Champ fichier invalide'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// UNHANDLED REJECTIONS
// ============================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
  // Ne pas exit en production, laisser le process manager gérer
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

module.exports = app;