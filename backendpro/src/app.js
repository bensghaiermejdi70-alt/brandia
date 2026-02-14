// ============================================
// BRANDIA APP - Configuration Express v2.0
// CORRECTION : Ordre middlewares pour upload
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
// CORS - ✅ ESPACES SUPPRIMÉS + LOGGING
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
// 🔥 CORRECTION CRITIQUE : Ordre des middlewares
// ============================================

// 1. Webhook Stripe (raw body) - AVANT tout parsing
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 2. 🔥 ROUTES SUPPLIER (avec upload multer) - AVANT express.json()
//    Car multer a besoin du body brut, pas parsé en JSON
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);

// 3. Parsing JSON pour TOUTES les autres routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

// ============================================
// ROUTES PRINCIPALES (sans supplier qui est déjà monté)
// ============================================

// Test email (à retirer en prod)
const testEmailRouter = require('./routes/testEmail');
app.use('/api/test', testEmailRouter);

// Routes principales (sauf supplier déjà monté)
const mainRoutes = require('./routes');

// 🔥 IMPORTANT : On filtre les routes pour éviter le double mount de /supplier
app.use('/api', (req, res, next) => {
  // Si c'est une route supplier, skip (déjà géré plus haut)
  if (req.path.startsWith('/supplier')) {
    return next('route'); // Skip ce router
  }
  next();
}, mainRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path
  });
});

// Gestion erreurs
app.use(errorMiddleware);

module.exports = app;