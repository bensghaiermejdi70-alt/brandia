// ============================================
// BRANDIA APP - Configuration Express v3.0
// CORRECTION: Routes supplier montées UNE SEULE FOIS
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// ============================================
// CORS CONFIGURATION
// ============================================

const allowedOrigins = [
  'https://brandia-marketplace.netlify.app',
  'https://bensghaiermejdi70-alt.github.io',
  'https://brandia.company',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  null
];

app.use(cors({
  origin: function (origin, callback) {
    console.log(`[CORS] Origin: ${origin || 'no-origin'}`);
    
    if (!origin) {
      console.log('[CORS] ✓ Allowed (no origin)');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`[CORS] ✓ Allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`[CORS] ❌ Blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// ============================================
// WEBHOOK STRIPE (raw body) - AVANT tout parsing
// ============================================
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ============================================
// ROUTES SUPPLIER (avec upload multer) - AVANT express.json()
// ============================================
// IMPORTANT: Ces routes ont leur propre parsing multipart
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);

// ============================================
// PARSING JSON pour TOUTES les autres routes
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

// ============================================
// ROUTES PRINCIPALES (index.js)
// ============================================
// Note: /api/supplier est DÉJÀ monté plus haut, donc on skip dans index.js
app.use('/api', routes);

// ============================================
// HEALTH CHECK (redondance sécurité)
// ============================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'brandia-api'
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use(errorMiddleware);

module.exports = app;


