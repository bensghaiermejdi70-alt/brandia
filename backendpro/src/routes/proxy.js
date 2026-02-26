// ============================================
// PROXY VIDEO ROUTE - Contourne Tracking Prevention
// ============================================
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // ou 'undici' si vous utilisez Node 18+

// Proxy vidéo pour contourner le Tracking Prevention
router.get('/video', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL vidéo requise' 
      });
    }

    // Validation URL Cloudinary uniquement (sécurité)
    if (!videoUrl.includes('res.cloudinary.com') && !videoUrl.includes('cloudinary.com')) {
      return res.status(403).json({ 
        success: false, 
        message: 'URL non autorisée' 
      });
    }

    console.log('[Proxy] Fetching video:', videoUrl);

    // Récupérer la vidéo depuis Cloudinary
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Brandia-Proxy/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Cloudinary error: ${response.status}`);
    }

    // Stream la réponse au client
    res.set('Content-Type', response.headers.get('content-type') || 'video/mp4');
    res.set('Content-Length', response.headers.get('content-length'));
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Accept-Ranges', 'bytes');
    
    // Pipe le stream
    response.body.pipe(res);

  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur proxy vidéo',
      error: error.message 
    });
  }
});

module.exports = router;