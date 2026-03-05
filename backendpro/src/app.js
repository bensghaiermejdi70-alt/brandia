// ============================================
// APP.JS - Brandia Backend v4.1 STABLE
// Fix: Ordre de chargement des routes, CORS, auth middleware
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
// MIDDLEWARES DE BASE (ORDRE CRITIQUE)
// ============================================

// 1. Logging en premier pour capturer toutes les requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// 2. Helmet pour la sécurité (avec configuration permissive pour CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 3. CORS - Configuration explicite et permissive pour le développement
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les origines locales et le domaine de production
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000',
      'https://brandia-1.onrender.com',
      'https://brandia-marketplace.netlify.app',
      undefined // Pour les requêtes sans origine (Postman, mobile apps)
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(null, true); // Temporairement permissif pour debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Auth-Token'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Auth-Token']
};

app.use(cors(corsOptions));

// 4. Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// PROXY VIDÉO
// ============================================
app.options('/api/proxy/video', cors());

app.get('/api/proxy/video', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL vidéo requise (paramètre ?url=)' 
      });
    }

    const allowedDomains = ['res.cloudinary.com', 'cloudinary.com'];
    let urlObj;
    try {
      urlObj = new URL(videoUrl);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'URL invalide'
      });
    }
    
    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));
    
    if (!isAllowed) {
      return res.status(403).json({ 
        success: false, 
        message: 'Domaine non autorisé' 
      });
    }

    console.log('[Proxy] Streaming:', videoUrl);

    const client = videoUrl.startsWith('https:') ? https : http;
    
    const proxyReq = client.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'video/mp4,video/*,*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      },
      timeout: 30000
    }, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        console.error('[Proxy] Upstream error:', proxyRes.statusCode);
        if (!res.headersSent) {
          return res.status(502).json({
            success: false,
            message: 'Erreur source vidéo: ' + proxyRes.statusCode
          });
        }
        return;
      }

      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
      res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      res.set('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
      if (proxyRes.headers['content-length']) {
        res.set('Content-Length', proxyRes.headers['content-length']);
      }
      res.set('Cache-Control', 'public, max-age=3600');
      res.set('Accept-Ranges', 'bytes');
      
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Request error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: 'Erreur de connexion au serveur vidéo'
        });
      }
    });

    proxyReq.on('timeout', () => {
      console.error('[Proxy] Timeout');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ 
          success: false, 
          message: 'Timeout - La vidéo met trop de temps à répondre'
        });
      }
    });

  } catch (error) {
    console.error('[Proxy] Fatal error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Erreur interne du proxy vidéo'
      });
    }
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
  console.warn('[App] Frontend not found in standard paths');
  return null;
}

const publicPath = findFrontendPath();

// ============================================
// FICHIERS STATIQUES
// ============================================
if (publicPath) {
  app.use(express.static(publicPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// ============================================
// ROUTES API - ORDRE CRITIQUE
// ============================================

// 1. Health check (toujours accessible)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    frontend: publicPath ? 'connected' : 'not found',
    proxy: 'available',
    node_version: process.version,
    uptime: process.uptime()
  });
});

// 2. Routes API principales (chargées depuis index.js)
try {
  const indexRoutes = require('./routes/index');
  app.use('/api', indexRoutes);
  console.log('[App] ✅ All API routes loaded via index.js');
} catch (e) {
  console.error('[App] ❌ Failed to load index routes:', e.message);
  console.error(e.stack);
  
  // Fallback minimal pour ne pas crasher
  app.use('/api', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable - routes not loaded'
    });
  });
}

// ============================================
// CATCH-ALL FRONTEND (SPA)
// ============================================
if (publicPath) {
  app.get('*', (req, res) => {
    // Ne pas interférer avec les routes API
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint non trouvé: ' + req.path
      });
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Brandia API',
      version: '4.1',
      endpoints: [
        '/api/health',
        '/api/products',
        '/api/supplier',
        '/api/proxy/video?url=VIDEO_URL'
      ],
      status: 'API only mode (no frontend)'
    });
  });
}

// ============================================
// ERROR HANDLING (DOIT ÊTRE DERNIER)
// ============================================
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err);
  
  // Ne pas exposer les détails en production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    ...(isDev && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

module.exports = app;