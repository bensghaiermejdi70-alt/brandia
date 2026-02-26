// ============================================
// APP.JS - Brandia Backend v3.7 STABLE
// Compatible Node 18+ (fetch natif)
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

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

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ============================================
// 🔥 PROXY VIDÉO - Version simple avec http/https natif
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

        // Validation URL Cloudinary uniquement
        const allowedDomains = ['res.cloudinary.com', 'cloudinary.com'];
        const urlObj = new URL(videoUrl);
        const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));
        
        if (!isAllowed) {
            return res.status(403).json({ 
                success: false, 
                message: 'Domaine non autorisé' 
            });
        }

        console.log('[Proxy] Streaming:', videoUrl);

        // Utiliser http ou https selon l'URL
        const client = videoUrl.startsWith('https:') ? https : http;
        
        const proxyReq = client.get(videoUrl, (proxyRes) => {
            // Headers
            res.set('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
            if (proxyRes.headers['content-length']) {
                res.set('Content-Length', proxyRes.headers['content-length']);
            }
            res.set('Cache-Control', 'public, max-age=3600');
            res.set('Accept-Ranges', 'bytes');
            
            // Stream
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('[Proxy] Error:', err);
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Erreur streaming vidéo' 
                });
            }
        });

        // Timeout
        proxyReq.setTimeout(30000, () => {
            proxyReq.destroy();
            if (!res.headersSent) {
                res.status(504).json({ 
                    success: false, 
                    message: 'Timeout' 
                });
            }
        });

    } catch (error) {
        console.error('[Proxy] Error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur proxy vidéo'
        });
    }
});

// ============================================
// DÉTECTION FRONTEND
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
        if (fs.existsSync(testPath) && fs.existsSync(path.join(testPath, 'index.html'))) {
            console.log(`[App] Frontend found: ${testPath}`);
            return testPath;
        }
    }
    return null;
}

const publicPath = findFrontendPath();

// ============================================
// FICHIERS STATIQUES
// ============================================

if (publicPath) {
    app.use(express.static(publicPath));
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// ============================================
// ROUTES API
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        frontend: publicPath ? 'connected' : 'not found',
        proxy: 'available',
        node_version: process.version
    });
});

// Routes existantes
const supplierRoutes = require('./modules/supplier/supplier.routes');
app.use('/api/supplier', supplierRoutes);

const productRoutes = require('./modules/products/product.routes');
app.use('/api/products', productRoutes);

const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);

// ============================================
// CATCH-ALL FRONTEND
// ============================================

if (publicPath) {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({
                success: false,
                message: 'API endpoint non trouvé'
            });
        }
        res.sendFile(path.join(publicPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'Brandia API',
            endpoints: ['/api/health', '/api/products', '/api/supplier', '/api/proxy/video']
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