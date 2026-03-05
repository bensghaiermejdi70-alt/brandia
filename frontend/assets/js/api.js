// ============================================
// BRANDIA API CLIENT - v3.7 FIX
// Correction: Ordre des fonctions - apiFetch défini avant utilisation
// ============================================

(function() {
  'use strict';
  
  if (window.BrandiaAPI) {
    console.log('[Brandia API] Already loaded, skipping...');
    return;
  }

  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.protocol === 'file:' ||
                  window.location.hostname.includes('github.io');

  // URL sans espace
  const API_BASE = isLocal 
    ? 'http://localhost:4000' 
    : 'https://brandia-1.onrender.com';

  const API_BASE_URL = `${API_BASE}/api`;
  const REQUEST_TIMEOUT = 15000;

  console.log(`[Brandia API] Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`[Brandia API] URL: ${API_BASE_URL}`);

  // ============================================
  // STORAGE UNIFIÉ (défini en premier)
  // ============================================
  
  const storage = {
    getToken: () => {
      return localStorage.getItem('token') || localStorage.getItem('brandia_token') || localStorage.getItem('accessToken') || null;
    },
    
    setToken: (token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('brandia_token', token);
      localStorage.setItem('accessToken', token);
    },
    
    removeToken: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('brandia_token');
    },
    
    getUser: () => {
      try {
        const userStr = localStorage.getItem('user') || localStorage.getItem('brandia_user');
        return userStr ? JSON.parse(userStr) : null;
      } catch {
        return null;
      }
    },
    
    setUser: (user) => {
      const userStr = JSON.stringify(user);
      localStorage.setItem('user', userStr);
      localStorage.setItem('brandia_user', userStr);
    },
    
    clear: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('brandia_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      localStorage.removeItem('brandia_user');
      localStorage.removeItem('refreshToken');
    }
  };

  // ============================================
  // FETCH API CORE - DÉFINI AVANT LES API
  // ============================================

  let isRefreshing = false;
  let refreshSubscribers = [];

  function subscribeTokenRefresh(callback) {
    refreshSubscribers.push(callback);
  }

  function onTokenRefreshed(newToken) {
    refreshSubscribers.forEach(callback => callback(newToken));
    refreshSubscribers = [];
  }

  async function refreshAccessToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      
      if (data.success && data.data?.accessToken) {
        storage.setToken(data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        return data.data.accessToken;
      }
      
      throw new Error('Invalid refresh response');
      
    } catch (error) {
      console.error('[Token Refresh] Failed:', error);
      // Ne pas rediriger ici — laisser apiFetch gérer selon le contexte
      storage.clear();
      throw error;
    }
  }

  // 🔥 DÉFINITION DE apiFetch AVANT TOUTE UTILISATION
  async function apiFetch(endpoint, options = {}, retryCount = 0) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = storage.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      console.log(`[API] ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Gestion token expiré (401)
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData.message?.includes('expired') || errorData.code === 'TOKEN_EXPIRED') {
          console.warn('[API] Token expired, attempting refresh...');
          
          if (isRefreshing) {
            return new Promise((resolve) => {
              subscribeTokenRefresh((newToken) => {
                headers['Authorization'] = `Bearer ${newToken}`;
                resolve(fetch(url, { ...options, headers }).then(r => r.json()));
              });
            });
          }
          
          isRefreshing = true;
          
          try {
            const newToken = await refreshAccessToken();
            onTokenRefreshed(newToken);
            
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(url, { ...options, headers });
            
            if (!retryResponse.ok) {
              throw new Error(`Retry failed: ${retryResponse.status}`);
            }
            
            return await retryResponse.json();
            
          } catch (refreshError) {
            throw refreshError;
          } finally {
            isRefreshing = false;
          }
        }
        
        // FIX: Ne pas effacer le storage ni rediriger automatiquement sur un 401
        // Le serveur Render (free tier) peut retourner 401 temporairement au réveil.
        // On retourne l'erreur — la page décide quoi faire.
        console.warn('[API] 401 reçu - session invalide ou serveur en réveil');
        return { success: false, message: 'Session invalide', status: 401 };
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Erreur serveur (${response.status})` };
        }
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (retryCount === 0 && (error.name === 'TypeError' || error.name === 'AbortError')) {
        console.warn(`[API] Retry ${url}...`);
        await new Promise(r => setTimeout(r, 1500));
        return apiFetch(endpoint, options, retryCount + 1);
      }

      let userMessage = error.message;
      if (error.name === 'AbortError') {
        userMessage = 'Le serveur met trop de temps à répondre.';
      } else if (error.message === 'Failed to fetch') {
        userMessage = 'Connexion impossible. Vérifiez votre internet.';
      }
      
      console.error('[API Error]', error);
      throw new Error(userMessage);
    }
  }

  // ============================================
  // MÉTHODES HTTP DIRECTES (utilisent apiFetch)
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
  // AUTH API
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
          
          storage.setToken(token);
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          storage.setUser(user);
        }
        return data;
      } catch (error) {
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
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          storage.setUser(user);
        }
        return data;
      } catch (error) {
        return { success: false, message: error.message };
      }
    },

    logout: () => {
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      storage.clear();
      window.location.href = 'index.html';
    },

    isLoggedIn: () => !!storage.getToken(),
    getUser: () => storage.getUser(),
    getRole: () => storage.getUser()?.role || null,
    isSupplier: () => {
      const user = storage.getUser();
      return user && user.role === 'supplier';
    }
  };

  // ============================================
  // PRODUCTS API
  // ============================================
  
  const ProductsAPI = {
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return await apiFetch(`/products${queryString ? '?' + queryString : ''}`);
    },

    getFeatured: async () => await apiFetch('/products/featured'),

    getById: async (id) => await apiFetch(`/products/${id}`),

    search: async (query) => await apiFetch(`/products?search=${encodeURIComponent(query)}`),

    getAllWithPromotions: async (params = {}) => {
      const queryString = new URLSearchParams();
      if (params.category) queryString.append('category', params.category);
      if (params.search) queryString.append('search', params.search);
      if (params.limit) queryString.append('limit', params.limit);
      
      const url = `/products/with-promotions${queryString.toString() ? '?' + queryString.toString() : ''}`;
      return await apiFetch(url);
    },

    getFeaturedWithPromotions: async () => await apiFetch('/products/featured'),

    getByIdWithPromotion: async (id) => {
      if (!id || id === 'null' || id === 'undefined') {
        return { success: false, message: 'ID produit invalide' };
      }
      try {
        return await apiFetch(`/products/${id}/with-promotion`);
      } catch (error) {
        try {
          const standard = await apiFetch(`/products/${id}`);
          return {
            success: true,
            data: { product: standard.data || standard }
          };
        } catch {
          return { success: false, message: error.message };
        }
      }
    },

    calculateFinalPrice: (product, promotion) => {
      if (!promotion || !promotion.type) return parseFloat(product.price);
      const basePrice = parseFloat(product.price);
      if (promotion.type === 'percentage') return basePrice * (1 - promotion.value / 100);
      if (promotion.type === 'fixed') return Math.max(0, basePrice - promotion.value);
      return basePrice;
    }
  };

  // ============================================
  // CATEGORIES API
  // ============================================
  
  const CategoriesAPI = {
    getAll: async () => {
      try {
        return await apiFetch('/categories');
      } catch {
        return { success: true, data: [] };
      }
    }
  };

  // ============================================
  // ORDERS API
  // ============================================
  
  const OrdersAPI = {
    create: async (orderData) => await apiFetch('/orders', { 
      method: 'POST', 
      body: JSON.stringify(orderData) 
    }),
    
    getMyOrders: async () => await apiFetch('/orders'),
    
    getById: async (id) => await apiFetch(`/orders/${id}`)
  };

  // ============================================
  // UPLOAD API
  // ============================================
  
  const UploadAPI = {
    uploadImage: async (fileOrFormData) => {
      try {
        const token = storage.getToken();
        let formData;
        
        if (fileOrFormData instanceof FormData) {
          formData = fileOrFormData;
        } else {
          formData = new FormData();
          formData.append('media', fileOrFormData);
        }
        
        const response = await fetch(`${API_BASE_URL}/supplier/upload-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `Erreur ${response.status}` }));
          throw new Error(error.message || `Erreur ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('[Upload] Error:', error);
        return { success: false, message: error.message };
      }
    },
    
    uploadVideo: async (fileOrFormData) => {
      try {
        const token = storage.getToken();
        let formData;
        
        if (fileOrFormData instanceof FormData) {
          formData = fileOrFormData;
        } else {
          formData = new FormData();
          formData.append('media', fileOrFormData);
        }
        
        const response = await fetch(`${API_BASE_URL}/supplier/upload-video`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `Erreur ${response.status}` }));
          throw new Error(error.message || `Erreur ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('[Upload Video] Error:', error);
        return { success: false, message: error.message };
      }
    }
  };

  // ============================================
  // SUPPLIER API
  // ============================================
  
  const SupplierAPI = {
    init: () => {
      const user = storage.getUser();
      if (!storage.getToken()) { 
        window.location.href = '../login.html?redirect=supplier/dashboard'; 
        return false; 
      }
      if (user?.role !== 'supplier') { 
        alert('Accès réservé aux fournisseurs'); 
        window.location.href = '../index.html'; 
        return false; 
      }
      return true;
    },

    getStats: async () => { 
      try { 
        return await apiFetch('/supplier/stats'); 
      } catch (e) { 
        return { 
          success: true, 
          data: { 
            stats: { totalSales: 0, totalOrders: 0, productsCount: 0, balance: 0 }, 
            recentOrders: [], 
            topProducts: [] 
          } 
        }; 
      } 
    },

    getProducts: async (params = {}) => { 
      try { 
        const queryString = new URLSearchParams(params).toString(); 
        return await apiFetch(`/supplier/products${queryString ? '?' + queryString : ''}`); 
      } catch (e) { 
        return { success: false, data: { products: [] }, message: e.message }; 
      } 
    },
    
    createProduct: async (data) => await apiFetch('/supplier/products', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    updateProduct: async (id, data) => {
      const allowedFields = ['name', 'description', 'price', 'stock_quantity', 'main_image_url', 'is_active', 'category_id'];
      const cleanData = {};
      
      for (const key of allowedFields) {
        if (data[key] !== undefined) cleanData[key] = data[key];
      }
      
      if (data.stock !== undefined && cleanData.stock_quantity === undefined) {
        cleanData.stock_quantity = data.stock;
      }
      
      return await apiFetch(`/supplier/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(cleanData)
      });
    },
    
    deleteProduct: async (id) => await apiFetch(`/supplier/products/${id}`, { 
      method: 'DELETE' 
    }),

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
    
    updateOrderStatus: async (orderId, status) => await apiFetch(`/supplier/orders/${orderId}/status`, { 
      method: 'PUT', 
      body: JSON.stringify({ status }) 
    }),

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
      return await apiFetch('/supplier/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
    },
    
    getPayouts: async () => {
      try {
        return await apiFetch('/supplier/payouts');
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
    
    createPromotion: async (data) => await apiFetch('/supplier/promotions', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    updatePromotion: async (id, data) => await apiFetch(`/supplier/promotions/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    deletePromotion: async (id) => await apiFetch(`/supplier/promotions/${id}`, { 
      method: 'DELETE' 
    }),

    getCampaigns: async () => {
      try {
        return await apiFetch('/supplier/campaigns');
      } catch (error) {
        return { success: false, data: [], message: error.message };
      }
    },
    
    createCampaign: async (data) => await apiFetch('/supplier/campaigns', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    updateCampaign: async (id, data) => await apiFetch(`/supplier/campaigns/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    deleteCampaign: async (id) => await apiFetch(`/supplier/campaigns/${id}`, { 
      method: 'DELETE' 
    }),

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
  // CART API
  // ============================================
  
  const CartAPI = {
    get: () => { 
      try { 
        return JSON.parse(localStorage.getItem('brandia_cart') || '[]'); 
      } catch { 
        return []; 
      } 
    },
    
    add: (product, quantity = 1) => {
      if (!product) return;
      const cart = CartAPI.get();
      const productId = product.id || product.product_id;
      const existing = cart.find(item => (item.product_id || item.id) == productId);
      const finalPrice = product.final_price || product.price;
      
      if (existing) { 
        existing.quantity += quantity; 
      } else { 
        cart.push({ 
          product_id: productId, 
          name: product.name, 
          price: parseFloat(finalPrice) || 0, 
          original_price: product.base_price || product.price, 
          has_promotion: product.has_promotion || false, 
          promo_code: product.promo_code || null, 
          image: product.main_image_url || product.image || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400', 
          quantity: quantity 
        }); 
      }
      
      localStorage.setItem('brandia_cart', JSON.stringify(cart));
      CartAPI.updateBadge();
    },
    
    remove: (productId) => { 
      const cart = CartAPI.get().filter(item => (item.product_id || item.id) != productId); 
      localStorage.setItem('brandia_cart', JSON.stringify(cart)); 
      CartAPI.updateBadge(); 
    },
    
    updateQuantity: (productId, quantity) => { 
      if (quantity < 1) { 
        CartAPI.remove(productId); 
        return; 
      } 
      const cart = CartAPI.get(); 
      const item = cart.find(i => (i.product_id || i.id) == productId); 
      if (item) { 
        item.quantity = parseInt(quantity); 
        localStorage.setItem('brandia_cart', JSON.stringify(cart)); 
        CartAPI.updateBadge(); 
      } 
    },
    
    clear: () => { 
      localStorage.removeItem('brandia_cart'); 
      CartAPI.updateBadge(); 
    },
    
    getCount: () => CartAPI.get().reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0),
    
    getTotal: () => CartAPI.get().reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)), 0),
    
    getSavings: () => CartAPI.get().reduce((sum, item) => { 
      if (item.original_price && item.price < item.original_price) {
        return sum + ((item.original_price - item.price) * item.quantity); 
      }
      return sum; 
    }, 0),
    
    updateBadge: () => { 
      const badges = document.querySelectorAll('#cart-count, .cart-badge'); 
      const count = CartAPI.getCount(); 
      badges.forEach(b => { 
        if (b) { 
          b.textContent = count; 
          b.style.display = count === 0 ? 'none' : 'flex'; 
        } 
      }); 
    }
  };

  // ============================================
  // EXPORT FINAL
  // ============================================
  
  window.BrandiaAPI = {
    // Méthodes HTTP directes
    ...httpMethods,
    
    // Sous-objets
    Auth: AuthAPI,
    Products: ProductsAPI,
    Categories: CategoriesAPI,
    Orders: OrdersAPI,
    Upload: UploadAPI,
    Cart: CartAPI,
    Supplier: SupplierAPI,
    storage: storage,
    config: { 
      baseURL: API_BASE, 
      isLocal: isLocal, 
      apiURL: API_BASE_URL,
      version: '3.7-fixed'
    }
  };

  // Fonctions globales
  window.logout = () => BrandiaAPI.Auth.logout();
  window.isLoggedIn = () => BrandiaAPI.Auth.isLoggedIn();
  window.getUser = () => BrandiaAPI.Auth.getUser();
  window.isSupplier = () => BrandiaAPI.Auth.isSupplier();

  console.log('[Brandia API] ✅ Loaded v3.7 - apiFetch fixed');
})();