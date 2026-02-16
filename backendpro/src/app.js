// ============================================
// APP.JS - Configuration Express Brandia v3.2 CORRIGÉ
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
    contentSecurityPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// 🔥🔥🔥 ROUTES - ORDRE CRITIQUE ! 🔥🔥🔥
// ============================================

console.log('[App] Loading routes...');

// 1. Health check (public)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// 2. 🔥 SUPPLIER ROUTES (public campaigns FIRST - before any auth)
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);
console.log('[App] ✅ Supplier routes mounted');

// 3. 🔥 PRODUCT ROUTES - PUBLIQUES ! PAS D'AUTH ICI !
const productRoutes = require('./modules/products/product.routes');
app.use('/api/products', productRoutes);
console.log('[App] ✅ Product routes mounted (PUBLIC)');

// 4. Other routes (index.js)
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);
console.log('[App] ✅ Index routes mounted');

// ============================================
// 🔥🔥🔥 VÉRIFICATION CRITIQUE 🔥🔥🔥
// ============================================
// IL NE DOIT Y AVOIR AUCUN app.use(authenticate) ICI !

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint non trouvé',
        path: req.path
    });
});

app.use((err, req, res, next) => {
    console.error('[Error]', err);
    
    // 🔥 DÉTECTION SPÉCIFIQUE DU PROBLÈME
    if (err.message && err.message.includes('fournisseur')) {
        console.error('🔥🔥🔥 ERREUR FOURNISSEUR DÉTECTÉE 🔥🔥🔥');
        console.error('Route:', req.method, req.url);
        console.error('User:', req.user);
    }
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erreur serveur'
    });
});

module.exports = app;