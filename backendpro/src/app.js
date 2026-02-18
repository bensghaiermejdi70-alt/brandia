// ============================================
// APP.JS - Configuration Express Brandia v3.5 CORRIGÉ (Chemins Render)
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

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
// 🔥 DÉTECTION DU DOSSIER FRONTEND
// ============================================

function findFrontendPath() {
    const possiblePaths = [
        // Structure Render (frontend à la racine du projet)
        path.join(__dirname, '../../frontend'),
        path.join(__dirname, '../frontend'),
        // Structure locale/backendpro
        path.join(__dirname, '../public'),
        path.join(__dirname, '../../public'),
        // Dossier courant
        path.join(process.cwd(), 'frontend'),
        path.join(process.cwd(), 'public')
    ];

    for (const testPath of possiblePaths) {
        console.log(`[App] Checking path: ${testPath}`);
        if (fs.existsSync(testPath) && fs.existsSync(path.join(testPath, 'index.html'))) {
            console.log(`[App] ✅ Frontend found at: ${testPath}`);
            return testPath;
        }
    }

    console.warn('[App] ⚠️ No frontend folder found, serving API only');
    return null;
}

const publicPath = findFrontendPath();

// ============================================
// FICHIERS STATIQUES
// ============================================

if (publicPath) {
    app.use(express.static(publicPath));
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    console.log(`[App] Serving static files from: ${publicPath}`);
} else {
    console.log('[App] Running in API-only mode');
}

// ============================================
// ROUTES API
// ============================================

console.log('[App] Loading API routes...');

// 1. Health check (public)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        frontend: publicPath ? 'connected' : 'not found'
    });
});

// 2. Supplier routes (public campaigns + protected)
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);
console.log('[App] ✅ Supplier routes mounted at /api/supplier');

// 3. Product routes (public)
const productRoutes = require('./modules/products/product.routes');
app.use('/api/products', productRoutes);
console.log('[App] ✅ Product routes mounted at /api/products');

// 4. Other routes (index.js)
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);
console.log('[App] ✅ Index routes mounted at /api');

// ============================================
// ROUTE CATCH-ALL POUR LE FRONTEND (SPA)
// ============================================

if (publicPath) {
    app.get('*', (req, res) => {
        // Ne pas interférer avec les routes API
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({
                success: false,
                message: 'API endpoint non trouvé',
                path: req.path
            });
        }
        
        // Servir index.html pour les routes client-side
        const indexPath = path.join(publicPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).json({
                success: false,
                message: 'Frontend not found'
            });
        }
    });
} else {
    // Fallback si pas de frontend
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'Brandia API is running',
            endpoints: {
                health: '/api/health',
                products: '/api/products',
                supplier: '/api/supplier'
            }
        });
    });
}

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