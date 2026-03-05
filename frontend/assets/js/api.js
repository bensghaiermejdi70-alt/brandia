// ============================================
// BRANDIA API CLIENT - v4.1 FIX
// Correction: Token storage, 401 handling, request retry
// ============================================

(function() {
  'use strict';
  
  if (window.BrandiaAPI) {
    console.log('[Brandia API] Already loaded, skipping...');
    return;
  }

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.protocol === 'file:' ||
                  window.location.hostname.includes('github.io');

  const API_BASE = isLocal 
    ? 'http://localhost:4000' 
    : 'https://brandia-1.onrender.com';

  const API_BASE_URL = `${API_BASE}/api`;
  const REQUEST_TIMEOUT = 15000;
  const MAX_RETRIES = 2;

  console.log(`[Brandia API] Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`[Brandia API] URL: ${API_BASE_URL}`);

  // ============================================
  // STORAGE UNIFIÉ - CLÉS CONSISTANTES
  // ============================================
  
  const TOKEN_KEYS = ['brandia_token', 'token', 'accessToken'];
  const USER_KEYS = ['brandia_user', 'user'];
  
  const storage = {
    getToken: () => {
      for (const key of TOKEN_KEYS) {
        const token = localStorage.getItem(key);
        if (token) return token;
      }
      return null;
    },
    
    setToken: (token) => {
      if (!token) return;
      // Synchroniser toutes les clés pour compatibilité
      TOKEN_KEYS.forEach(key => localStorage.setItem(key, token));
    },
    
    removeToken: () => {
      TOKEN_KEYS.forEach(key => localStorage.removeItem(key));
    },
    
    getUser: () => {
      for (const key of USER_KEYS) {
        const userStr = localStorage.getItem(key);
        if (userStr) {
          try {
            return JSON.parse(userStr);
          } catch (e) {
            continue;
          }
        }
      }
      return null;
    },
    
    setUser: (user) => {
      const userStr = JSON.stringify(user);
      USER_KEYS.forEach(key => localStorage.setItem(key, userStr));
    },
    
    clear: () => {
      [...TOKEN_KEYS, ...USER_KEYS, 'refreshToken'].forEach(key => {
        localStorage.removeItem(key);
      });
    }
  };

  // ============================================
  // FETCH API CORE - AVEC RETRY ET GESTION 401
  // ============================================

  async function apiFetch(endpoint, options = {}, retryCount = 0) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Préparer les headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Ajouter le token si disponible
    const token = storage.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      console.log(`[API] ${options.method || 'GET'} ${url}`);
      if (token) {
        console.log(`[API] Token present: ${token.substring(0, 20)}...`);
      }
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Gestion 401 - Token invalide ou expiré
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`[API] 401 on ${endpoint}:`, errorData);
        
        // Si c'est la première tentative et qu'on a un token, essayer de rafraîchir
        if (retryCount === 0 && token && errorData.code === 'TOKEN_EXPIRED') {
          console.log('[API] Attempting token refresh...');
          // TODO: Implémenter le refresh token ici
          // Pour l'instant, on redirige vers login
        }
        
        // Rediriger vers login si pas de retry possible
        if (retryCount >= MAX_RETRIES) {
          console.error('[API] Max retries reached, redirecting to login');
          storage.clear();
          window.location.href = `../login.html?expired=1&reason=token_invalid`;
          return { success: false, message: 'Session expirée', code: 'SESSION_EXPIRED' };
        }
        
        return { 
          success: false, 
          message: errorData.message || 'Non authentifié', 
          code: errorData.code || 'UNAUTHORIZED',
          status: 401
        };
      }

      // Gestion 403 - Forbidden
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || 'Accès refusé',
          code: 'FORBIDDEN',
          status: 403
        };
      }

      // Erreurs serveur
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Erreur serveur (${response.status})` };
        }
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      // Réponse vide (204)
      if (response.status === 204) {
        return { success: true };
      }

      // Parse JSON
      const data = await response.json();
      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Retry en cas d'erreur réseau
      if (retryCount < MAX_RETRIES && (error.name === 'TypeError' || error.name === 'AbortError')) {
        console.warn(`[API] Network error, retrying ${retryCount + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return apiFetch(endpoint, options, retryCount + 1);
      }

      // Formater le message d'erreur
      let userMessage = error.message;
      if (error.name === 'AbortError') {
        userMessage = 'Le serveur met trop de temps à répondre.';
      } else if (error.message === 'Failed to fetch') {
        userMessage = 'Connexion impossible. Vérifiez votre connexion internet.';
      }
      
      console.error('[API Error]', error);
      throw new Error(userMessage);
    }
  }

  // ============================================
  // MÉTHODES HTTP
  // ============================================
  
  const httpMethods = {
    get: async (endpoint, params = null) => {
      let url = endpoint;
      if (params && Object.keys(params).length > 0) {
        const queryString = new URLSearchParams(params).toString();
        url += (endpoint.includes('?') ? '&' : '?') + queryString;
      }
      return apiFetch(url, { method: 'GET' });
    },
    
    post: async (endpoint, data = null) => {
      return apiFetch(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
      });
    },
    
    put: async (endpoint, data = null) => {
      return apiFetch(endpoint, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
      });
    },
    
    patch: async (endpoint, data = null) => {
      return apiFetch(endpoint, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined
      });
    },
    
    delete: async (endpoint) => {
      return apiFetch(endpoint, { method: 'DELETE' });
    },
    
    upload: async (endpoint, formData, onProgress = null) => {
      const token = storage.getToken();
      
      if (onProgress && typeof onProgress === 'function') {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                resolve({ success: true, data: xhr.responseText });
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          
          xhr.open('POST', `${API_BASE_URL}${endpoint}`);
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });
      }
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });
      
      return await response.json();
    }
  };

  // ============================================
  // AUTH API - CORRIGÉ
  // ============================================
  
  const AuthAPI = {
    login: async (email, password) => {
      try {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        
        if (data.success && data.data) {
          const token = data.data.accessToken || data.data.token;
          const user = data.data.user || data.data;
          
          if (!token) {
            console.error('[Auth] No token in response:', data);
            return { success: false, message: 'Token manquant dans la réponse' };
          }
          
          storage.setToken(token);
          storage.setUser(user);
          
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          
          console.log('[Auth] ✅ Login successful, token stored');
        }
        return data;
      } catch (error) {
        console.error('[Auth] Login error:', error);
        return { success: false, message: error.message };
      }
    },

    register: async (userData) => {
      try {
        const data = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        
        if (data.success && data.data) {
          const token = data.data.accessToken || data.data.token;
          const user = data.data.user || data.data;
          
          storage.setToken(token);
          storage.setUser(user);
          
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
        }
        return data;
      } catch (error) {
        return { success: false, message: error.message };
      }
    },

    logout: () => {
      // Appeler l'API de logout (optionnel)
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      
      // Toujours clear le storage local
      storage.clear();
      
      // Rediriger
      window.location.href = '../login.html';
    },

    isLoggedIn: () => {
      const token = storage.getToken();
      const user = storage.getUser();
      return !!(token && user);
    },
    
    getToken: () => storage.getToken(),
    
    getUser: () => storage.getUser(),
    
    getRole: () => {
      const user = storage.getUser();
      return user?.role || null;
    },
    
    isSupplier: () => {
      const user = storage.getUser();
      return user && user.role === 'supplier';
    },
    
    // Validation du token avec le backend
    validateToken: async () => {
      try {
        const response = await apiFetch('/auth/me', { method: 'GET' });
        return response.success;
      } catch (error) {
        return false;
      }
    }
  };

  // ============================================
  // SUPPLIER API - CORRIGÉ
  // ============================================
  
  const SupplierAPI = {
    init: () => {
      const user = storage.getUser();
      const token = storage.getToken();
      
      if (!token) { 
        console.warn('[SupplierAPI] No token found');
        return false; 
      }
      if (user?.role !== 'supplier') { 
        console.warn('[SupplierAPI] User is not supplier:', user?.role);
        return false; 
      }
      return true;
    },

    getStats: async () => { 
      try { 
        return await apiFetch('/supplier/stats'); 
      } catch (e) { 
        console.error('[SupplierAPI] getStats error:', e);
        return { 
          success: false, 
          data: { 
            totalSales: 0, 
            totalOrders: 0, 
            productsCount: 0, 
            balance: 0 
          },
          message: e.message
        }; 
      } 
    },

    getProducts: async (params = {}) => { 
      try { 
        const queryString = new URLSearchParams(params).toString(); 
        return await apiFetch(`/supplier/products${queryString ? '?' + queryString : ''}`); 
      } catch (e) { 
        console.error('[SupplierAPI] getProducts error:', e);
        return { success: false, data: { products: [] }, message: e.message }; 
      } 
    },
    
    createProduct: async (data) => {
      try {
        return await apiFetch('/supplier/products', { 
          method: 'POST', 
          body: JSON.stringify(data) 
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    
    updateProduct: async (id, data) => {
      try {
        return await apiFetch(`/supplier/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    
    deleteProduct: async (id) => {
      try {
        return await apiFetch(`/supplier/products/${id}`, { 
          method: 'DELETE' 
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },

    getOrders: async (status = null) => { 
      const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''; 
      return await apiFetch(`/supplier/orders${query}`); 
    },
    
    getOrderById: async (id) => {
      try {
        return await apiFetch(`/supplier/orders/${id}`);
      } catch (error) {
        return { success: false, message: error.message };
      }
    },
    
    updateOrderStatus: async (orderId, status) => {
      try {
        return await apiFetch(`/supplier/orders/${orderId}/status`, { 
          method: 'PUT', 
          body: JSON.stringify({ status }) 
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },

    getPayments: async () => {
      try {
        return await apiFetch('/supplier/payments');
      } catch (error) {
        return { 
          success: false, 
          data: { balance: { available: 0, pending: 0, total: 0 }, transactions: [] },
          message: error.message 
        };
      }
    },
    
    requestPayout: async (amount) => {
      return await apiFetch('/supplier/payments/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
    },
    
    getPayouts: async () => {
      try {
        return await apiFetch('/supplier/payments/payouts');
      } catch (error) {
        return { success: false, data: [], message: error.message };
      }
    },

    getPromotions: async () => {
      try {
        return await apiFetch('/supplier/promotions');
      } catch (error) {
        return { success: false, data: [], message: error.message };
      }
    },
    
    createPromotion: async (data) => {
      try {
        return await apiFetch('/supplier/promotions', { 
          method: 'POST', 
          body: JSON.stringify(data) 
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    
    updatePromotion: async (id, data) => {
      try {
        return await apiFetch(`/supplier/promotions/${id}`, { 
          method: 'PUT', 
          body: JSON.stringify(data) 
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    
    deletePromotion: async (id) => {
      try {
        return await apiFetch(`/supplier/promotions/${id}`, { 
          method: 'DELETE' 
        });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },

    getCampaigns: async () => {
      try {
        return await apiFetch('/supplier/campaigns');
      } catch (error) {
        console.error('[SupplierAPI] getCampaigns error:', error);
        return { success: false, data: [], message: error.message };
      }
    },
    
    getCampaignLimit: async () => {
      try {
        return await apiFetch('/supplier/campaigns/limit');
      } catch (error) {
        return { success: true, data: { current: 0, max: 5, can_create: true } };
      }
    },
    
    createCampaign: async (data) => {
      try {
        return await apiFetch('/supplier/campaigns', { 
          method: 'POST', 
          body: JSON.stringify(data) 
        });
      } catch (error) {
        console.error('[SupplierAPI] createCampaign error:', error);
        return { success: false, message: error.message };
      }
    },
    
    updateCampaign: async (id, data) => {
      try {
        return await apiFetch(`/supplier/campaigns/${id}`, { 
          method: 'PUT', 
          body: JSON.stringify(data) 
        });
      } catch (error) {
        console.error('[SupplierAPI] updateCampaign error:', error);
        return { success: false, message: error.message };
      }
    },
    
    deleteCampaign: async (id) => {
      try {
        return await apiFetch(`/supplier/campaigns/${id}`, { 
          method: 'DELETE' 
        });
      } catch (error) {
        console.error('[SupplierAPI] deleteCampaign error:', error);
        return { success: false, message: error.message };
      }
    },

    // Routes publiques (pas besoin de token)
    getPublicCampaign: async (supplierId, productId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`, { 
          method: 'GET', 
          headers: { 'Accept': 'application/json' } 
        });
        return await response.json();
      } catch { 
        return { success: false, data: null }; 
      }
    },

    trackCampaignView: async (campaignId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/supplier/public/campaigns/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId })
        });
        return await response.json();
      } catch {
        return { success: false };
      }
    },

    trackCampaignClick: async (campaignId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/supplier/public/campaigns/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId })
        });
        return await response.json();
      } catch {
        return { success: false };
      }
    },

    getAdSettings: async (supplierId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/supplier/public/ad-settings?supplier=${supplierId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        return await response.json();
      } catch (error) {
        return { 
          success: true, 
          data: { 
            max_ads_per_session: 1, 
            priority: 5,
            is_default: true 
          } 
        };
      }
    }
  };

  // ============================================
  // EXPORT FINAL
  // ============================================
  
  window.BrandiaAPI = {
    ...httpMethods,
    Auth: AuthAPI,
    Supplier: SupplierAPI,
    storage: storage,
    config: { 
      baseURL: API_BASE, 
      isLocal: isLocal, 
      apiURL: API_BASE_URL,
      version: '4.1'
    }
  };

  // Exposer les fonctions utilitaires globalement
  window.logout = () => BrandiaAPI.Auth.logout();
  window.isLoggedIn = () => BrandiaAPI.Auth.isLoggedIn();
  window.getUser = () => BrandiaAPI.Auth.getUser();
  window.isSupplier = () => BrandiaAPI.Auth.isSupplier();

  console.log('[Brandia API] ✅ Loaded v4.1');
})();