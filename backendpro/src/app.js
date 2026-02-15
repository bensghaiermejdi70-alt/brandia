// ============================================
// APP.JS - Configuration Express Brandia v2.2
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARES DE BASE
// ============================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Logging simple
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
    if (!origin) return callback(null, true);
    console.log('[CORS] Origin:', origin);
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
// ROUTES - ORDRE IMPORTANT
// ============================================

console.log('[App] Loading routes...');

// 1. Health check d'abord (public)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'brandia-api',
    version: '2.2.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 2. Routes supplier AVANT les routes index (pour éviter conflits)
console.log('[App] Loading supplier routes...');
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);
console.log('[App] Supplier routes loaded at /api/supplier');

// 3. Routes générales (auth, products, orders, payments, etc.)
console.log('[App] Loading index routes...');
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);
console.log('[App] Index routes loaded at /api');

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
  console.error('[Error]', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Fichier trop grand (max 5MB image, 50MB vidéo)'
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
    message: err.message || 'Erreur serveur interne'
  });
});

// ============================================
// UNHANDLED ERRORS
// ============================================

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
});

console.log('[App] Express app configured');

module.exports = app;