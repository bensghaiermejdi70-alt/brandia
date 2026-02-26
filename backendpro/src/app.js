// ============================================
// APP.JS - Brandia Backend v3.6 PRODUCTION
// Avec Proxy Vidéo pour contourner Tracking Prevention
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

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
// 🔥 PROXY VIDÉO - Contourne Tracking Prevention
// ============================================

app.get('/api/proxy/video', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        
        if (!videoUrl) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL vidéo requise' 
            });
        }

        // Validation URL Cloudinary uniquement (sécurité)
        const allowedDomains = [
            'res.cloudinary.com',
            'cloudinary.com',
            'video.cloudinary.com'
        ];
        
        const urlObj = new URL(videoUrl);
        const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));
        
        if (!isAllowed) {
            console.warn('[Proxy] Blocked domain:', urlObj.hostname);
            return res.status(403).json({ 
                success: false, 
                message: 'Domaine non autorisé' 
            });
        }

        console.log('[Proxy] Fetching video:', videoUrl);

        // Récupérer la vidéo depuis Cloudinary avec timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(videoUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Brandia-Proxy/1.0',
                'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Cloudinary error: ${response.status} ${response.statusText}`);
        }

        // Headers de la réponse
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');

        // Stream la réponse au client
        res.set('Content-Type', contentType);
        if (contentLength) res.set('Content-Length', contentLength);
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Accept-Ranges', 'bytes');
        res.set('Access-Control-Allow-Origin', '*');

        // Pipe le stream vidéo
        response.body.pipe(res);

        // Gestion erreur stream
        response.body.on('error', (err) => {
            console.error('[Proxy] Stream error:', err);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

    } catch (error) {
        console.error('[Proxy] Error:', error.message);
        
        if (error.name === 'AbortError') {
            return res.status(504).json({ 
                success: false, 
                message: 'Timeout lors du chargement vidéo' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Erreur proxy vidéo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// DÉTECTION DU DOSSIER FRONTEND
// ============================================

function findFrontendPath() {
    const possiblePaths = [
        path.join(__dirname, '../../frontend'),
        path.join(__dirname, '../frontend'),
        path.join(__dirname, '../public'),
        path.join(__dirname, '../../public'),
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
        frontend: publicPath ? 'connected' : 'not found',
        proxy: 'available'
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
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({
                success: false,
                message: 'API endpoint non trouvé',
                path: req.path
            });
        }
        
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
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'Brandia API is running',
            endpoints: {
                health: '/api/health',
                products: '/api/products',
                supplier: '/api/supplier',
                proxy: '/api/proxy/video?url=VIDEO_URL'
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