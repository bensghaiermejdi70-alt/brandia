// ============================================
// APP.JS - Configuration Express Brandia v3.3 CORRIGÉ
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

// ============================================
// 🔥🔥🔥 FICHIERS STATIQUES - AVANT LES ROUTES API 🔥🔥🔥
// ============================================

// 🔥 CRITIQUE : Servir le frontend (index.html, css, js, assets)
const publicPath = path.join(__dirname, '../public');
console.log('[App] Serving static files from:', publicPath);

app.use(express.static(publicPath));

// Uploads (si vous avez des fichiers uploadés)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// 🔥🔥🔥 ROUTES API - APRÈS LES FICHIERS STATIQUES 🔥🔥🔥
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

// 2. Supplier routes (public campaigns + protected)
// 🔥 CORRIGÉ : module (singulier) + .routes (avec 's')
const supplierRoutes = require('./module/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);
console.log('[App] ✅ Supplier routes mounted');

// 3. Product routes (public)
const productRoutes = require('./module/products/product.routes');
app.use('/api/products', productRoutes);
console.log('[App] ✅ Product routes mounted (PUBLIC)');

// 4. Other routes (index.js)
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);
console.log('[App] ✅ Index routes mounted');

// ============================================
// 🔥🔥🔥 ROUTE CATCH-ALL POUR LE FRONTEND (SPA) 🔥🔥🔥
// ============================================
// Toute route non-API renvoie index.html (pour React/Vue ou HTML pur)

app.get('*', (req, res) => {
    // Ne pas interférer avec les routes API
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint non trouvé',
            path: req.path
        });
    }
    
    // Servir index.html pour toutes les autres routes (client-side routing)
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('[Error]', err);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erreur serveur'
    });
});

module.exports = app;