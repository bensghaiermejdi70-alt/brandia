// ============================================
// BRANDIA API CLIENT - Frontend (CORRIGÉ PROD)
// ============================================

// Détection auto de l'environnement
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:' ||
                window.location.hostname.includes('github.io');

// ✅ CORRECTION : Suppression de l'espace fatal à la fin
const API_BASE = isLocal 
  ? 'http://localhost:4000' 
  : 'https://brandia-1.onrender.com';

const API_BASE_URL = `${API_BASE}/api`;
const REQUEST_TIMEOUT = 15000; // 15 secondes pour Render (cold start)

console.log(`[Brandia API] Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
console.log(`[Brandia API] Endpoint: ${API_BASE_URL}`);

// ============================================
// STOCKAGE (Cohérent avec login.html existant)
// ============================================
const storage = {
    // ✅ Uniformisé : utilise 'token' partout (pas 'brandia_token')
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
// FETCH AVANCÉ (avec retry et gestion erreurs)
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
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}&expired=1`;
                return { success: false, message: 'Session expirée' };
            }
        }

        // Gestion 404
        if (response.status === 404) {
            throw new Error('Ressource non trouvée');
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
        
        // Retry sur erreur réseau (1 retry max)
        if (retryCount === 0 && (error.name === 'TypeError' || error.name === 'AbortError')) {
            console.warn(`[API] Retry ${url}...`);
            await new Promise(r => setTimeout(r, 1000));
            return apiFetch(endpoint, options, retryCount + 1);
        }

        // Messages utilisateur friendly
        let userMessage = error.message;
        if (error.name === 'AbortError') {
            userMessage = 'Le serveur met trop de temps à répondre. Réessayez.';
        } else if (error.message === 'Failed to fetch') {
            userMessage = 'Connexion impossible. Vérifiez votre internet ou réessayez dans 30s (cold start Render).';
        }
        
        console.error('[API Error]', error);
        throw new Error(userMessage);
    }
}

// ============================================
// AUTH API
// ============================================
const AuthAPI = {
    register: async (userData) => {
        try {
            const data = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            if (data.success && data.data) {
                storage.setToken(data.data.accessToken);
                storage.setUser(data.data.user);
            }
            return data;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

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
                
                // Synchroniser le panier guest si existe
                CartAPI.syncWithServer();
            }
            return data;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    logout: () => {
        // Appel API pour invalider le token côté serveur (optionnel mais propre)
        apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
        storage.clear();
        window.location.href = 'index.html';
    },

    isLoggedIn: () => !!storage.getToken(),

    getUser: () => storage.getUser(),
    
    getRole: () => {
        const user = storage.getUser();
        return user?.role || null;
    },

    // Vérifier si token encore valide (appel /api/auth/me)
    checkAuth: async () => {
        try {
            const data = await apiFetch('/auth/me');
            return data.success;
        } catch {
            return false;
        }
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

    getFeatured: async () => {
        return await apiFetch('/products/featured');
    },

    getById: async (id) => {
        return await apiFetch(`/products/${id}`);
    },

    getBySlug: async (slug) => {
        return await apiFetch(`/products/slug/${slug}`);
    },
    
    // Recherche
    search: async (query) => {
        return await apiFetch(`/products?search=${encodeURIComponent(query)}`);
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
            // Fallback local si API down
            if (typeof BRANDIA_CATEGORIES !== 'undefined') {
                return { success: true, data: BRANDIA_CATEGORIES };
            }
            throw new Error('Catégories non disponibles');
        }
    }
};

// ============================================
// COUNTRIES API
// ============================================
const CountriesAPI = {
    getAll: async () => {
        return await apiFetch('/countries');
    },
    
    getCurrent: () => {
        return localStorage.getItem('country') || 'FR';
    }
};

// ============================================
// ORDERS API
// ============================================
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

// ============================================
// SUPPLIER API (Dashboard Fournisseur)
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

    logout: () => AuthAPI.logout(),

    getStats: async () => {
        try {
            return await apiFetch('/supplier/dashboard');
        } catch (error) {
            console.error('Erreur stats:', error);
            // Données mockées si API down (pour démo)
            return { 
                success: true, 
                data: {
                    stats: { totalSales: 0, totalOrders: 0, productsCount: 0, balance: 0 },
                    recentOrders: [],
                    salesChart: []
                }
            };
        }
    },

    getProducts: async () => {
        try {
            return await apiFetch('/supplier/products');
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

    getProfile: async () => {
        return await apiFetch('/supplier/profile');
    },

    updateProfile: async (profileData) => {
        return await apiFetch('/supplier/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }
};

// ============================================
// CART API (LocalStorage + Sync serveur)
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
        if (!product || (!product.id && !product.product_id)) {
            console.error('Produit invalide pour le panier');
            return;
        }
        
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
                image: product.main_image_url || product.image || product.image_url || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400',
                quantity: quantity
            });
        }
        
        localStorage.setItem('brandia_cart', JSON.stringify(cart));
        CartAPI.updateBadge();
        
        // Toast si disponible
        if (typeof showToast === 'function') {
            showToast('Produit ajouté au panier');
        }
    },

    remove: (productId) => {
        let cart = CartAPI.get();
        cart = cart.filter(item => (item.product_id || item.id) != productId);
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

    getCount: () => {
        return CartAPI.get().reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    },

    getTotal: () => {
        return CartAPI.get().reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 0;
            return sum + (price * qty);
        }, 0);
    },

    updateBadge: () => {
        const badges = document.querySelectorAll('#cart-count');
        const count = CartAPI.getCount();
        
        badges.forEach(badge => {
            if (badge) {
                badge.textContent = count;
                badge.classList.toggle('hidden', count === 0);
            }
        });
    },

    // Sync avec serveur si connecté (pour panier persistant)
    syncWithServer: async () => {
        if (!AuthAPI.isLoggedIn()) return;
        // TODO: Implémenter sync panier serveur quand endpoint prêt
    },

    // Préparer pour checkout (transfert vers checkout.html)
    prepareCheckout: () => {
        const cart = CartAPI.get();
        if (cart.length === 0) return false;
        
        const subtotal = CartAPI.getTotal();
        const shipping = subtotal >= 50 ? 0 : 5.90;
        
        localStorage.setItem('brandia_checkout_cart', JSON.stringify({
            items: cart,
            totals: {
                subtotal: subtotal,
                shipping: shipping,
                total: subtotal + shipping
            },
            timestamp: Date.now()
        }));
        
        return true;
    }
};

// ============================================
// GESTION ERREURS GLOBALES
// ============================================
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && 
        (event.reason.message.includes('Failed to fetch') || event.reason.message.includes('NetworkError'))) {
        console.warn('[Brandia] Connexion API perdue - Mode dégradé');
        // Tu peux afficher une bannière "Mode offline" ici
    }
});

// ============================================
// EXPORT GLOBAL
// ============================================
window.BrandiaAPI = {
    Auth: AuthAPI,
    Products: ProductsAPI,
    Categories: CategoriesAPI,
    Countries: CountriesAPI,
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

// Initialisation auto
document.addEventListener('DOMContentLoaded', () => {
    CartAPI.updateBadge();
    
    // Si URL contient ?expired=1, afficher message
    if (window.location.search.includes('expired=1')) {
        if (typeof showToast === 'function') {
            showToast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
        }
    }
});