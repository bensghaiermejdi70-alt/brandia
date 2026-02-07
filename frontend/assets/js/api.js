// ============================================
// BRANDIA API CLIENT - Frontend (v2.5 AVEC PROMOTIONS)
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

  const API_BASE = isLocal 
    ? 'http://localhost:4000' 
    : 'https://brandia-1.onrender.com';

  const API_BASE_URL = `${API_BASE}/api`;
  const REQUEST_TIMEOUT = 15000;

  console.log(`[Brandia API] Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`[Brandia API] URL: ${API_BASE_URL}`);

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

      if (response.status === 401) {
        storage.clear();
        if (!window.location.pathname.includes('login')) {
          window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}&expired=1`;
          return { success: false, message: 'Session expirée' };
        }
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

  // Auth API
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
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      storage.clear();
      window.location.href = 'index.html';
    },

    isLoggedIn: () => !!storage.getToken(),
    getUser: () => storage.getUser(),
    getRole: () => storage.getUser()?.role || null,
  };

  // ==========================================
  // PRODUCTS API (AVEC PROMOTIONS)
  // ==========================================
  const ProductsAPI = {
    // Méthodes classiques (sans promotions)
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return await apiFetch(`/products${queryString ? '?' + queryString : ''}`);
    },

    getFeatured: async () => {
      return await apiFetch('/products/featured');
    },

    getById: async (id) => {
      return await apiFetch(`/products/${id}`);
    },
    
    search: async (query) => {
      return await apiFetch(`/products?search=${encodeURIComponent(query)}`);
    },

    // ==========================================
    // NOUVEAU: Méthodes avec promotions
    // ==========================================
    
    /**
     * Récupère tous les produits avec leurs promotions actives intégrées
     * Chaque produit contient: has_promotion, final_price, promo_type, etc.
     */
    /**
 * Récupère tous les produits avec leurs promotions actives intégrées
 * Filtre les params null/undefined pour éviter les erreurs
 */
getAllWithPromotions: async (params = {}) => {
  const queryString = new URLSearchParams();
  
  // ✅ Ne pas ajouter si null/undefined/vide
  if (params.category && params.category !== 'null' && params.category !== '') {
    queryString.append('category', params.category);
  }
  if (params.search && params.search.trim() !== '') {
    queryString.append('search', params.search.trim());
  }
  if (params.limit && !isNaN(params.limit)) {
    queryString.append('limit', parseInt(params.limit));
  }
  if (params.offset && !isNaN(params.offset)) {
    queryString.append('offset', parseInt(params.offset));
  }
  if (params.sort && params.sort !== '') {
    queryString.append('sort', params.sort);
  }
  
  const url = `/products/with-promotions${queryString.toString() ? '?' + queryString.toString() : ''}`;
  console.log('[API] getAllWithPromotions:', url);
  
  return await apiFetch(url);
},

    /**
     * Helper: Calcule le prix final d'un produit (côté client)
     * Utilisé si les données ne viennent pas de l'API avec promo
     */
    calculateFinalPrice: (product, promotion) => {
      if (!promotion || !promotion.type) return parseFloat(product.price);
      
      const basePrice = parseFloat(product.price);
      if (promotion.type === 'percentage') {
        return basePrice * (1 - promotion.value / 100);
      } else if (promotion.type === 'fixed') {
        return Math.max(0, basePrice - promotion.value);
      }
      return basePrice;
    }
  };

  // Categories API
  const CategoriesAPI = {
    getAll: async () => {
      try {
        return await apiFetch('/categories');
      } catch {
        return { success: true, data: [] };
      }
    }
  };

  // Orders API
  const OrdersAPI = {
    create: async (orderData) => {
      return await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
    },

    getMyOrders: async () => {
      return await apiFetch('/orders');
    },

    getById: async (id) => {
      return await apiFetch(`/orders/${id}`);
    }
  };

  // Supplier API
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

    getPromotions: async () => {
      return await apiFetch('/supplier/promotions');
    },

    createPromotion: async (promotionData) => {
      return await apiFetch('/supplier/promotions', {
        method: 'POST',
        body: JSON.stringify(promotionData)
      });
    },

    updatePromotion: async (id, promotionData) => {
      return await apiFetch(`/supplier/promotions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(promotionData)
      });
    },

    deletePromotion: async (id) => {
      return await apiFetch(`/supplier/promotions/${id}`, {
        method: 'DELETE'
      });
    },

    getStats: async () => {
      try {
        return await apiFetch('/supplier/stats');
      } catch (error) {
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
      } catch (error) {
        return { success: false, data: { products: [] }, message: error.message };
      }
    },

    createProduct: async (productData) => {
      return await apiFetch('/supplier/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      });
    },

    updateProduct: async (id, productData) => {
      return await apiFetch(`/supplier/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
      });
    },

    deleteProduct: async (id) => {
      return await apiFetch(`/supplier/products/${id}`, {
        method: 'DELETE'
      });
    },

    getOrders: async (status = null) => {
      const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
      return await apiFetch(`/supplier/orders${query}`);
    },

    getOrderById: async (id) => {
      return await apiFetch(`/supplier/orders/${id}`);
    },

    updateOrderStatus: async (orderId, status) => {
      return await apiFetch(`/supplier/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
    },

    getPayments: async () => {
      return await apiFetch('/supplier/payments');
    },

    requestPayout: async (amount) => {
      return await apiFetch('/supplier/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
    },

    getCampaigns: async () => {
      return await apiFetch('/supplier/campaigns');
    },

    createCampaign: async (campaignData) => {
      return await apiFetch('/supplier/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData)
      });
    },

    getPublicCampaign: async (supplierId, productId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/public/campaigns?supplier=${supplierId}&product=${productId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        return await response.json();
      } catch (error) {
        return { success: false, data: null };
      }
    }
  };

  // Cart API
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
      
      // Utiliser le prix final si promotion active
      const finalPrice = product.final_price || product.price;
      
      if (existing) {
        existing.quantity = (parseInt(existing.quantity) || 0) + quantity;
      } else {
        cart.push({
          product_id: productId,
          name: product.name,
          price: parseFloat(finalPrice) || 0, // Prix promo appliqué
          original_price: product.base_price || product.price, // Prix d'origine pour référence
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
      let cart = CartAPI.get().filter(item => (item.product_id || item.id) != productId);
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

    // ==========================================
    // NOUVEAU: Calcule les économies totales dans le panier
    // ==========================================
    getSavings: () => {
      return CartAPI.get().reduce((sum, item) => {
        if (item.original_price && item.price < item.original_price) {
          return sum + ((item.original_price - item.price) * item.quantity);
        }
        return sum;
      }, 0);
    },

    updateBadge: () => {
      const badges = document.querySelectorAll('#cart-count, .cart-badge');
      const count = CartAPI.getCount();
      badges.forEach(badge => {
        if (badge) {
          badge.textContent = count;
          badge.style.display = count === 0 ? 'none' : 'flex';
        }
      });
    }
  };

  // Export global
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
      apiURL: API_BASE_URL
    }
  };

  console.log('[Brandia API] ✅ Loaded v2.5 - Promotions Ready');
})();