// ============================================
// BRANDIA API CLIENT - Frontend (CORRIGÉ PROD)
// ============================================

// Détection auto de l'environnement
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:' ||
                window.location.hostname.includes('github.io');

// ✅ CORRECTION : Suppression des espaces fatals à la fin
const API_BASE = isLocal 
  ? 'http://localhost:4000' 
  : 'https://brandia-1.onrender.com'; // ← PAS D'ESPACE ICI

const API_BASE_URL = `${API_BASE}/api`;
const REQUEST_TIMEOUT = 15000;

console.log(`[Brandia API] Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
console.log(`[Brandia API] Endpoint: ${API_BASE_URL}`);

// Stockage
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

// Fetch avec retry
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

        // Gestion 401
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
        
        // Retry sur erreur réseau
        if (retryCount === 0 && (error.name === 'TypeError' || error.name === 'AbortError')) {
            console.warn(`[API] Retry ${url}...`);
            await new Promise(r => setTimeout(r, 1500));
            return apiFetch(endpoint, options, retryCount + 1);
        }

        let userMessage = error.message;
        if (error.name === 'AbortError') {
            userMessage = 'Le serveur met trop de temps à répondre (cold start Render).';
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

// Supplier API (Dashboard) - ✅ ROUTES CORRIGÉES
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

    // ✅ CORRECTION : Route changée de /dashboard à /stats
    getStats: async () => {
        try {
            return await apiFetch('/supplier/stats');
        } catch (error) {
            console.error('Erreur stats:', error);
            return { 
                success: true, 
                data: {
                    totalSales: 0, 
                    totalOrders: 0, 
                    productsCount: 0, 
                    balance: 0,
                    recentOrders: []
                }
            };
        }
    },

    getProducts: async () => {
        try {
            return await apiFetch('/supplier/products');
        } catch (error) {
            return { success: false, data: [], message: error.message };
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
        const query = status ? `?status=${status}` : '';
        return await apiFetch(`/supplier/orders${query}`);
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
        
        if (existing) {
            existing.quantity = (parseInt(existing.quantity) || 0) + quantity;
        } else {
            cart.push({
                product_id: productId,
                name: product.name,
                price: parseFloat(product.price) || 0,
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
    Supplier: SupplierAPI,
    Cart: CartAPI,
    apiFetch
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    CartAPI.updateBadge();
});