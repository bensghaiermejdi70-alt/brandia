// ==========================================
// CONFIGURATION API - S'adapte auto à l'environnement
// ==========================================

const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:';

const API_URL = isLocal 
  ? 'http://localhost:4000' 
  : 'https://brandia-1.onrender.com';

console.log(`[API Config] Environnement: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
console.log(`[API Config] API URL: ${API_URL}`);

// Override BrandiaAPI avec la bonne URL
window.BrandiaAPI = window.BrandiaAPI || {};
window.BrandiaAPI.baseURL = API_URL;