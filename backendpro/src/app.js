// ============================================
// APP.JS - Configuration Express Brandia v3.1
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARES DE BASE (appliqués à TOUTES les routes)
// ============================================

// Sécurité HTTP headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Désactivé pour éviter conflits avec frontend
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Logging des requêtes
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const origin = req.headers.origin || 'no-origin';
    
    console.log(`[${timestamp}] ${method} ${url} | Origin: ${origin}`);
    
    // Log body pour POST/PUT en development
    if (process.env.NODE_ENV === 'development' && ['POST', 'PUT', 'PATCH'].includes(method)) {
        console.log('[Body]', req.body);
    }
    
    next();
});

// Parsing JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CORS CONFIGURATION
// ============================================

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'https://brandia-marketplace.netlify.app',
    'https://www.brandia.company',
    'https://brandia.company'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.warn('[CORS] Origin not allowed:', origin);
            callback(null, true); // Autoriser quand même en production pour éviter les blocages
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// ============================================
// STATIC FILES
// ============================================

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// 🔥 ROUTES - ORDRE TRÈS IMPORTANT !
// ============================================

console.log('[App] Loading routes...');

// 1. Health check (toujours accessible)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'brandia-api',
        version: '3.1.0',
        environment: process.env.NODE_ENV || 'production'
    });
});

// 2. 🔥 SUPPLIER ROUTES (montées AVANT les routes générales)
// Contient les routes publiques pour les campagnes publicitaires
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);
console.log('[App] ✅ Supplier routes mounted on /api/supplier');

// 3. 🔥 PRODUCT ROUTES (PUBLIQUES - pas d'auth middleware ici!)
const productRoutes = require('./modules/products/product.routes');
app.use('/api/products', productRoutes);
console.log('[App] ✅ Product routes mounted on /api/products');

// 4. Routes générales (index.js)
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);
console.log('[App] ✅ Index routes mounted on /api');

// ============================================
// ERROR HANDLING - DOIT ÊTRE APRÈS TOUTES LES ROUTES
// ============================================

// 404 - Route non trouvée
app.use((req, res) => {
    console.log('[404] Not found:', req.method, req.path);
    res.status(404).json({
        success: false,
        message: 'Endpoint non trouvé',
        path: req.path,
        method: req.method
    });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('[Error Handler]', err);
    
    // Erreur de taille de fichier
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'Fichier trop grand (max 5MB pour images, 50MB pour vidéos)'
        });
    }
    
    // Erreur JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token invalide'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expiré'
        });
    }
    
    // Erreur par défaut
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erreur serveur interne',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

console.log('[App] ✅ All middlewares and routes loaded');

module.exports = app;