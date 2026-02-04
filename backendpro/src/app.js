// ============================================
// BRANDIA APP - Configuration Express
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
    
    // Autoriser explicitement null/undefined (requêtes sans origine)
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
  optionsSuccessStatus: 200 // Pour compatibilité IE
}));

// Webhook Stripe (raw body)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

// ============================================
// ROUTES
// ============================================

// Test email (à retirer en prod)
const testEmailRouter = require('./routes/testEmail');
app.use('/api/test', testEmailRouter);

// Routes principales
app.use('/api', routes);

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