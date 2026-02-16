// ============================================
// APP.JS - Configuration Express Brandia v2.6 CORRIGÉ
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

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CORS CONFIGURATION
// ============================================

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
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
// ROUTES - ORDRE IMPORTANT !
// ============================================

console.log('[App] Loading routes...');

// 1. Health check (toujours accessible)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'brandia-api',
        version: '2.6.0'
    });
});

// 2. 🔥 ROUTES SUPPLIER (montées AVANT les routes générales)
// Cela permet d'avoir /api/supplier/* fonctionnel
try {
    const supplierRoutes = require('./modules/supplier/supplier.routes');
    app.use('/api/supplier', supplierRoutes);
    console.log('[App] ✅ Supplier routes mounted on /api/supplier');
} catch (err) {
    console.error('[App] ❌ FAILED to mount supplier routes:', err.message);
}

// 3. Routes générales (auth, products, orders, etc.)
try {
    const indexRoutes = require('./routes/index');
    app.use('/api', indexRoutes);
    console.log('[App] ✅ Index routes mounted on /api');
} catch (err) {
    console.error('[App] ❌ FAILED to mount index routes:', err.message);
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler - DOIT être après toutes les routes
app.use((req, res, next) => {
    console.log('[404] Not found:', req.method, req.path);
    res.status(404).json({
        success: false,
        message: 'Endpoint non trouvé',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'Fichier trop grand'
        });
    }
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erreur serveur',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;