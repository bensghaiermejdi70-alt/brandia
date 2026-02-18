// ============================================
// APP.JS - Configuration Express Brandia v3.4 PRODUCTION READY
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();

// ============================================
// MIDDLEWARES DE SÉCURITÉ (AVANT TOUT)
// ============================================

// Helmet pour la sécurité des headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
            connectSrc: ["'self'", "https:", "http:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:", "http:"],
            frameSrc: ["'self'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Logging des requêtes
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Parsing JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CONFIGURATION CORS DYNAMIQUE
// ============================================

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://brandia-marketplace.netlify.app',
    'https://brandia.company',
    'https://www.brandia.company'
];

app.use(cors({
    origin: function(origin, callback) {
        // Autoriser les requêtes sans origin (Postman, mobile apps)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origin rejected: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ============================================
// 🔥 FICHIERS STATIQUES - AVANT LES ROUTES API
// ============================================

// Déterminer le chemin correct du frontend
const possiblePaths = [
    path.join(__dirname, '../../frontend'),      // Structure standard
    path.join(__dirname, '../public'),           // Alternative
    path.join(__dirname, '../../public'),        // Autre alternative
    path.join(__dirname, '../frontend'),         // Encore une autre
    '/opt/render/project/src/frontend'          // Render specific
];

let publicPath = null;
for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
        publicPath = testPath;
        console.log(`[App] ✅ Frontend found at: ${publicPath}`);
        break;
    }
}

if (!publicPath) {
    console.error('[App] ❌ WARNING: Frontend directory not found!');
    console.error('[App] Searched paths:', possiblePaths);
    // Créer un fallback pour éviter le crash
    publicPath = path.join(__dirname, '../../frontend');
}

// Servir les fichiers statiques avec cache control
app.use(express.static(publicPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Uploads directory
const uploadsPath = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
    console.log(`[App] ✅ Uploads directory served from: ${uploadsPath}`);
}

// ============================================
// 🔥 ROUTES API - APRÈS LES FICHIERS STATIQUES
// ============================================

console.log('[App] Loading API routes...');

// 1. Health check (public)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '3.4',
        environment: process.env.NODE_ENV || 'development'
    });
});

// 2. Product routes (PUBLIC - sans auth)
try {
    const productRoutes = require('./modules/products/product.routes');
    app.use('/api/products', productRoutes);
    console.log('[App] ✅ Product routes mounted at /api/products');
} catch (err) {
    console.error('[App] ❌ Error loading product routes:', err.message);
}

// 3. Auth routes (PUBLIC)
try {
    const authRoutes = require('./modules/auth/auth.routes');
    app.use('/api/auth', authRoutes);
    console.log('[App] ✅ Auth routes mounted at /api/auth');
} catch (err) {
    console.error('[App] ❌ Error loading auth routes:', err.message);
}

// 4. Categories routes (PUBLIC)
try {
    const countryRoutes = require('./modules/countries/country.routes');
    app.use('/api/countries', countryRoutes);
    console.log('[App] ✅ Country routes mounted at /api/countries');
} catch (err) {
    console.error('[App] ❌ Error loading country routes:', err.message);
}

// 5. Orders routes (PROTECTED)
try {
    const orderRoutes = require('./modules/orders/order.routes');
    app.use('/api/orders', orderRoutes);
    console.log('[App] ✅ Order routes mounted at /api/orders');
} catch (err) {
    console.error('[App] ❌ Error loading order routes:', err.message);
}

// 6. Payments routes (PROTECTED)
try {
    const paymentRoutes = require('./modules/payments/payment.routes');
    app.use('/api/payments', paymentRoutes);
    console.log('[App] ✅ Payment routes mounted at /api/payments');
} catch (err) {
    console.error('[App] ❌ Error loading payment routes:', err.message);
}

// 7. Supplier routes (MIXTE - public campaigns + protected)
// 🔥 CORRECTION CRITIQUE : Chemin avec 's' à modules
try {
    const supplierRoutes = require('./modules/supplier/supplier.routes');
    app.use('/api/supplier', supplierRoutes);
    console.log('[App] ✅ Supplier routes mounted at /api/supplier');
} catch (err) {
    console.error('[App] ❌ Error loading supplier routes:', err.message);
    console.error('[App] Stack:', err.stack);
}

// ============================================
// 🔥 ROUTE CATCH-ALL POUR LE FRONTEND (SPA)
// ============================================

// Gestion des routes frontend (React Router ou HTML pur)
app.get('*', (req, res) => {
    // Ne pas interférer avec les routes API
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found',
            path: req.path
        });
    }
    
    // Ne pas interférer avec les fichiers statiques existants
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') {
        return res.status(404).send('Not found');
    }
    
    // Servir index.html pour les routes client-side
    const indexPath = path.join(publicPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).json({
            success: false,
            message: 'Frontend not properly deployed',
            searchedPath: indexPath
        });
    }
});

// ============================================
// ERROR HANDLING GLOBAL
// ============================================

// 404 API
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('[Error]', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    
    // Ne pas exposer les détails en production
    const isDev = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(isDev && { stack: err.stack })
    });
});

module.exports = app;