// ============================================
// BRANDIA API CLIENT - Frontend (v3.0 PURE JS)
// PAS DE NODE.JS ICI - Uniquement pour le navigateur
// ============================================

(function() {
  'use strict';
  
  // Éviter double chargement
  if (window.BrandiaAPI) {
    console.log('[Brandia API] Already loaded, skipping...');
    return;
  }

  // Détection environnement
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.protocol === 'file:' ||
                  window.location.hostname.includes('github.io');

  const API_BASE = isLocal 
    ? 'http://localhost:4000' 
    : 'https://brandia-1.onrender.com';

  const API_BASE_URL = `${API_BASE}/api`;
  const REQUEST_TIMEOUT = 15000;

  console.log(`[Brandia API] Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`[Brandia API] URL: ${API_BASE_URL}`);

  // ============================================
  // STORAGE HELPERS
  // ============================================
  
  const storage = {
    getToken: () => localStorage.getItem('token'),
    setToken: (token) => localStorage.setItem('token', token),
    removeToken: () => localStorage.removeItem('token'),
    
    getUser: () => {
      try {
        return JSON.parse(localStorage.getItem('user') || 'null');
      } catch {
        return null;
      }
    },
    setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
    
    clear: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
    }
  };

  // ============================================
  // FETCH API CORE
  // ============================================
  
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

      // Gestion 401 - Token expiré
      if (response.status === 401) {
        storage.clear();
        if (!window.location.pathname.includes('login')) {
          window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}&expired=1`;
          return { success: false, message: 'Session expirée' };
        }
      }

      // Gestion erreurs HTTP
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

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Retry une fois en cas de problème réseau
      if (retryCount === 0 && (error.name === 'TypeError' || error.name === 'AbortError')) {
        console.warn(`[API] Retry ${url}...`);
        await new Promise(r => setTimeout(r, 1500));
        return apiFetch(endpoint, options, retryCount + 1);
      }

      // Messages utilisateur friendly
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
          storage.setToken(data.data.accessToken);
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          storage.setUser(data.data.user);
        }
        return data;
      } catch (error) {
        return { success: false, message: error.message };
      }
    },

    logout: () => {
      // Appel API optionnel (ne pas bloquer si échoue)
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      storage.clear();
      window.location.href = 'index.html';
    },

    isLoggedIn: () => !!storage.getToken(),
    getUser: () => storage.getUser(),
    getRole: () => storage.getUser()?.role || null,
    
    // 🔥 NOUVEAU : Vérifier si fournisseur
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

    getFeaturedWithPromotions: async () => await apiFetch('/products/featured-with-promotions'),

    getByIdWithPromotion: async (id) => {
      if (!id || id === 'null' || id === 'undefined') {
        return { success: false, message: 'ID produit invalide' };
      }
      try {
        return await apiFetch(`/products/${id}/with-promotion`);
      } catch (error) {
        // Fallback
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
  // SUPPLIER API (Dashboard Fournisseur)
  // ============================================
  
  const SupplierAPI = {
    // Vérifier accès
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

    // 🔥 STATS (la route qui manquait)
    getStats: async () => { 
      try { 
        return await apiFetch('/supplier/stats'); 
      } catch (e) { 
        console.error('[SupplierAPI] getStats error:', e);
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

    // Products
    getProducts: async (params = {}) => { 
      try { 
        const queryString = new URLSearchParams(params).toString(); 
        return await apiFetch(`/supplier/products${queryString ? '?' + queryString : ''}`); 
      } catch (e) { 
        console.error('[SupplierAPI] getProducts error:', e);
        return { success: false, data: { products: [] }, message: e.message }; 
      } 
    },
    
    createProduct: async (data) => await apiFetch('/supplier/products', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    updateProduct: async (id, data) => {
      // Nettoyer les données
      const allowedFields = ['name', 'description', 'price', 'stock_quantity', 'main_image_url', 'is_active', 'category_id'];
      const cleanData = {};
      
      for (const key of allowedFields) {
        if (data[key] !== undefined) cleanData[key] = data[key];
      }
      
      if (data.stock !== undefined && cleanData.stock_quantity === undefined) {
        cleanData.stock_quantity = data.stock;
      }
      
      console.log('[API] updateProduct clean data:', cleanData);
      
      return await apiFetch(`/supplier/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(cleanData)
      });
    },
    
    deleteProduct: async (id) => await apiFetch(`/supplier/products/${id}`, { 
      method: 'DELETE' 
    }),

    // Orders
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

    // Payments
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

    // Promotions
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

    // Campaigns
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

    // 🔥 Public Campaigns (pour le système d'ads)
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

    // 🔥 Ad Settings (quota par marque)
    getAdSettings: async (supplierId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/supplier/public/ad-settings?supplier=${supplierId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        return await response.json();
      } catch (error) {
        console.error('[SupplierAPI] getAdSettings error:', error);
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
  // CART API (LocalStorage)
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
  // EXPORT GLOBAL
  // ============================================
  
  window.BrandiaAPI = {
    Auth: AuthAPI,
    Products: ProductsAPI,
    Categories: CategoriesAPI,
    Orders: OrdersAPI,
    Cart: CartAPI,
    Supplier: SupplierAPI,
    storage: storage,
    config: { 
      baseURL: API_BASE, 
      isLocal: isLocal, 
      apiURL: API_BASE_URL,
      version: '3.0'
    }
  };

  // Fonctions globales pour onclick inline
  window.logout = () => BrandiaAPI.Auth.logout();
  window.isLoggedIn = () => BrandiaAPI.Auth.isLoggedIn();
  window.getUser = () => BrandiaAPI.Auth.getUser();
  window.isSupplier = () => BrandiaAPI.Auth.isSupplier();

  console.log('[Brandia API] ✅ Loaded v3.0 - Pure JavaScript (No Node.js)');
})();

// ============================================
// POLYFILLS (si nécessaire pour anciens navigateurs)
// ============================================

// fetch polyfill check
if (!window.fetch) {
  console.error('[Brandia API] Fetch API not supported. Please use a modern browser.');
}