// ============================================
// BRANDIA API CLIENT - Frontend (v2.6 CORRIGÉ)
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

  // -------------------------------
  // Auth API
  // -------------------------------
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

  // -------------------------------
  // Products API (v2.5 Promotions)
  // -------------------------------
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
      console.log('[API] getAllWithPromotions:', url);
      return await apiFetch(url);
    },

    getFeaturedWithPromotions: async () => await apiFetch('/products/featured-with-promotions'),

    getByIdWithPromotion: async (id) => {
      if (!id || id === 'null' || id === 'undefined') {
        console.error('[API] Invalid product ID:', id);
        return { success: false, message: 'ID produit invalide' };
      }
      try {
        const response = await apiFetch(`/products/${id}/with-promotion`);
        console.log('[API] getByIdWithPromotion raw response:', response);
        return response;
      } catch (error) {
        console.error('[API] getByIdWithPromotion error:', error);
        // Fallback sur l'API standard sans promotion
        try {
          console.log('[API] Fallback to standard getById');
          const standard = await apiFetch(`/products/${id}`);
          return {
            success: true,
            data: {
              product: standard.data || standard
            }
          };
        } catch (fallbackError) {
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

  // -------------------------------
  // Categories API
  // -------------------------------
  const CategoriesAPI = {
    getAll: async () => {
      try {
        return await apiFetch('/categories');
      } catch {
        return { success: true, data: [] };
      }
    }
  };

  // -------------------------------
  // Orders API
  // -------------------------------
  const OrdersAPI = {
    create: async (orderData) => await apiFetch('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
    getMyOrders: async () => await apiFetch('/orders'),
    getById: async (id) => await apiFetch(`/orders/${id}`)
  };

  // -------------------------------
  // Supplier API (CORRIGÉ - AJOUT deleteCampaign & updateCampaign)
  // -------------------------------
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

    // Promotions
    getPromotions: async () => await apiFetch('/supplier/promotions'),
    createPromotion: async (promotionData) => await apiFetch('/supplier/promotions', { method: 'POST', body: JSON.stringify(promotionData) }),
    updatePromotion: async (id, promotionData) => await apiFetch(`/supplier/promotions/${id}`, { method: 'PUT', body: JSON.stringify(promotionData) }),
    deletePromotion: async (id) => await apiFetch(`/supplier/promotions/${id}`, { method: 'DELETE' }),

    // Stats
    getStats: async () => { 
      try { 
        return await apiFetch('/supplier/stats'); 
      } catch { 
        return { 
          success: true, 
          data: { 
            stats: { totalSales:0, totalOrders:0, productsCount:0, balance:0 }, 
            recentOrders:[], 
            topProducts:[] 
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
        return { success:false, data:{products:[]}, message:e.message }; 
      } 
    },
    createProduct: async (data) => await apiFetch('/supplier/products', { method:'POST', body:JSON.stringify(data) }),
    updateProduct: async (id, data) => {
    // 🔥 CORRECTION STRICTE : N'accepter QUE les champs valides
    const allowedFields = ['name', 'description', 'price', 'stock_quantity', 'main_image_url', 'is_active', 'category_id'];
    
    const cleanData = {};
    for (const key of allowedFields) {
        if (data[key] !== undefined) {
            cleanData[key] = data[key];
        }
    }
    
    // 🔥 CORRECTION : Si on reçoit 'stock', le convertir en 'stock_quantity'
    if (data.stock !== undefined && cleanData.stock_quantity === undefined) {
        cleanData.stock_quantity = data.stock;
    }
    
    // Supprimer tout champ qui contient 'stock' mais n'est pas 'stock_quantity'
    for (const key of Object.keys(cleanData)) {
        if (key.includes('stock') && key !== 'stock_quantity') {
            delete cleanData[key];
        }
    }
    
    console.log('[API] updateProduct FINAL clean data:', cleanData);
    
    return await apiFetch(`/supplier/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(cleanData)
    });
},
    deleteProduct: async (id) => await apiFetch(`/supplier/products/${id}`, { method:'DELETE' }),

    // Orders
    getOrders: async (status=null) => { 
      const query = status && status!=='all' ? `?status=${encodeURIComponent(status)}` : ''; 
      return await apiFetch(`/supplier/orders${query}`); 
    },
    getOrderById: async (id) => await apiFetch(`/supplier/orders/${id}`),
    updateOrderStatus: async (orderId, status) => await apiFetch(`/supplier/orders/${orderId}/status`, { method:'PUT', body:JSON.stringify({status}) }),

      // Paiements (ajoutez ces méthodes dans SupplierAPI)
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

    // Campaigns (CORRIGÉ - AJOUT DES MANQUANTS)
    getCampaigns: async () => await apiFetch('/supplier/campaigns'),
    createCampaign: async (data) => await apiFetch('/supplier/campaigns', { method:'POST', body:JSON.stringify(data) }),
    
    // 🔥 AJOUTÉ : Mise à jour campagne
    updateCampaign: async (id, data) => await apiFetch(`/supplier/campaigns/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    // 🔥 AJOUTÉ : Suppression campagne
    deleteCampaign: async (id) => await apiFetch(`/supplier/campaigns/${id}`, { 
      method: 'DELETE' 
    }),

    getPublicCampaign: async (supplierId, productId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/public/campaigns?supplier=${supplierId}&product=${productId}`, { 
          method:'GET', 
          headers:{'Accept':'application/json'} 
        });
        return await response.json();
      } catch { 
        return { success:false, data:null }; 
      }
    }
  };

  // -------------------------------
  // Cart API
  // -------------------------------
  const CartAPI = {
    get: () => { 
      try { 
        return JSON.parse(localStorage.getItem('brandia_cart') || '[]'); 
      } catch { 
        return []; 
      } 
    },
    
    add: (product, quantity=1) => {
      if (!product) return;
      const cart = CartAPI.get();
      const productId = product.id || product.product_id;
      const existing = cart.find(item => (item.product_id || item.id) == productId);
      const finalPrice = product.final_price || product.price;
      
      if (existing) { 
        existing.quantity = (parseInt(existing.quantity)||0) + quantity; 
      } else { 
        cart.push({ 
          product_id: productId, 
          name: product.name, 
          price: parseFloat(finalPrice)||0, 
          original_price: product.base_price||product.price, 
          has_promotion: product.has_promotion||false, 
          promo_code: product.promo_code||null, 
          image: product.main_image_url||product.image||'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400', 
          quantity: quantity 
        }); 
      }
      
      localStorage.setItem('brandia_cart', JSON.stringify(cart));
      CartAPI.updateBadge();
    },
    
    remove: (productId) => { 
      const cart = CartAPI.get().filter(item => (item.product_id||item.id) != productId); 
      localStorage.setItem('brandia_cart', JSON.stringify(cart)); 
      CartAPI.updateBadge(); 
    },
    
    updateQuantity: (productId, quantity) => { 
      if(quantity < 1){ 
        CartAPI.remove(productId); 
        return; 
      } 
      const cart = CartAPI.get(); 
      const item = cart.find(i => (i.product_id||i.id) == productId); 
      if(item){ 
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
      if(item.original_price && item.price < item.original_price) {
        return sum + ((item.original_price - item.price) * item.quantity); 
      }
      return sum; 
    }, 0),
    
    updateBadge: () => { 
      const badges = document.querySelectorAll('#cart-count, .cart-badge'); 
      const count = CartAPI.getCount(); 
      badges.forEach(b => { 
        if(b){ 
          b.textContent = count; 
          b.style.display = count === 0 ? 'none' : 'flex'; 
        } 
      }); 
    }
  };

  // -------------------------------
  // Export global
  // -------------------------------
  window.BrandiaAPI = {
    Auth: AuthAPI,
    Products: ProductsAPI,
    Categories: CategoriesAPI,
    Orders: OrdersAPI,
    Cart: CartAPI,
    Supplier: SupplierAPI,
    storage: storage,
    config: { baseURL: API_BASE, isLocal: isLocal, apiURL: API_BASE_URL }
  };

  console.log('[Brandia API] ✅ Loaded v2.6 - Campaigns Fix Ready');
})();