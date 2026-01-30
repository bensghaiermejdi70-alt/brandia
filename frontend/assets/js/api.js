// ============================================
// BRANDIA API CLIENT - Frontend (CORRIGÉ)
// ============================================

// Détection auto de l'environnement
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:' ||
                window.location.hostname.includes('github.io');

// CORRECTION : Suppression de l'espace à la fin de l'URL
const API_BASE = isLocal 
  ? 'http://localhost:4000' 
  : 'https://brandia-1.onrender.com';

const API_BASE_URL = `${API_BASE}/api`;
const REQUEST_TIMEOUT = 10000; // 10 secondes

console.log(`[Brandia API] Environnement: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
console.log(`[Brandia API] URL Base: ${API_BASE_URL}`);

// Stockage local
const storage = {
    getToken: () => localStorage.getItem('brandia_token'),
    setToken: (token) => localStorage.setItem('brandia_token', token),
    removeToken: () => localStorage.removeItem('brandia_token'),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('brandia_user') || 'null');
        } catch {
            return null;
        }
    },
    setUser: (user) => localStorage.setItem('brandia_user', JSON.stringify(user)),
    clear: () => {
        localStorage.removeItem('brandia_token');
        localStorage.removeItem('brandia_user');
    }
};

// Fonction fetch avec auth et timeout
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = storage.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Gestion du timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Gestion des erreurs HTTP
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { message: `Erreur HTTP ${response.status}` };
            }
            
            // Si 401, supprimer le token (session expirée)
            if (response.status === 401) {
                storage.clear();
                // Rediriger vers login si pas déjà sur login
                if (!window.location.pathname.includes('login')) {
                    window.location.href = 'login.html?expired=1';
                    return;
                }
            }
            
            throw new Error(errorData.message || `Erreur ${response.status}`);
        }

        // Si la réponse est vide (204 No Content par exemple)
        if (response.status === 204) {
            return { success: true };
        }

        return await response.json();

    } catch (error) {
        clearTimeout(timeoutId);
        
        // Gestion spécifique des erreurs
        if (error.name === 'AbortError') {
            throw new Error('La connexion a pris trop de temps. Vérifiez votre connexion internet.');
        }
        
        if (error.message === 'Failed to fetch') {
            throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion ou réessayez plus tard.');
        }
        
        console.error('[API Error]', error);
        throw error;
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
                storage.setUser(data.data.user);
            }
            return data;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    logout: () => {
        storage.clear();
        window.location.href = 'index.html';
    },

    isLoggedIn: () => !!storage.getToken(),

    getUser: () => storage.getUser(),
    
    // Récupérer le rôle de l'utilisateur
    getRole: () => {
        const user = storage.getUser();
        return user?.role || null;
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
    }
};

// ============================================
// CATEGORIES API (Ajouté - manquant dans l'original)
// ============================================

const CategoriesAPI = {
    getAll: async () => {
        // Si l'API backend n'a pas encore de endpoint /categories, on utilise les données locales
        if (typeof BRANDIA_CATEGORIES !== 'undefined') {
            return { success: true, data: BRANDIA_CATEGORIES };
        }
        return await apiFetch('/categories');
    }
};

// ============================================
// COUNTRIES API
// ============================================

const CountriesAPI = {
    getAll: async () => {
        return await apiFetch('/countries');
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

    logout: () => AuthAPI.logout(),

    getStats: async () => {
        try {
            return await apiFetch('/supplier/dashboard');
        } catch (error) {
            console.error('Erreur stats:', error);
            return { success: false, data: null, message: error.message };
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
        try {
            return await apiFetch('/supplier/products', {
                method: 'POST',
                body: JSON.stringify(productData)
            });
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    updateProduct: async (id, productData) => {
        try {
            return await apiFetch(`/supplier/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify(productData)
            });
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    deleteProduct: async (id) => {
        try {
            return await apiFetch(`/supplier/products/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    getOrders: async (status = null) => {
        try {
            const query = status ? `?status=${status}` : '';
            return await apiFetch(`/supplier/orders${query}`);
        } catch (error) {
            return { success: false, data: { orders: [] }, message: error.message };
        }
    },

    updateOrderStatus: async (orderId, status) => {
        try {
            return await apiFetch(`/supplier/orders/${orderId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    getPayments: async () => {
        try {
            return await apiFetch('/supplier/payments');
        } catch (error) {
            return { success: false, data: null, message: error.message };
        }
    },

    requestPayout: async (amount) => {
        try {
            return await apiFetch('/supplier/payouts', {
                method: 'POST',
                body: JSON.stringify({ amount })
            });
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    getProfile: async () => {
        try {
            return await apiFetch('/supplier/profile');
        } catch (error) {
            return { success: false, data: null, message: error.message };
        }
    },

    updateProfile: async (profileData) => {
        try {
            return await apiFetch('/supplier/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
        } catch (error) {
            return { success: false, message: error.message };
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
        if (!product || !product.id) {
            console.error('Produit invalide pour le panier');
            return;
        }
        
        const cart = CartAPI.get();
        const existing = cart.find(item => item.product_id === product.id);
        
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({
                product_id: product.id,
                name: product.name,
                price: parseFloat(product.price) || 0,
                image: product.main_image_url || product.image || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400',
                quantity: quantity
            });
        }
        
        localStorage.setItem('brandia_cart', JSON.stringify(cart));
        CartAPI.updateBadge();
        
        // Notification visuelle si fonction disponible
        if (typeof showToast === 'function') {
            showToast('Produit ajouté au panier');
        }
    },

    remove: (productId) => {
        let cart = CartAPI.get();
        cart = cart.filter(item => item.product_id !== productId);
        localStorage.setItem('brandia_cart', JSON.stringify(cart));
        CartAPI.updateBadge();
    },

    updateQuantity: (productId, quantity) => {
        if (quantity < 1) {
            CartAPI.remove(productId);
            return;
        }
        
        const cart = CartAPI.get();
        const item = cart.find(i => i.product_id === productId);
        if (item) {
            item.quantity = quantity;
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
        return CartAPI.get().reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)), 0);
    },

    updateBadge: () => {
        const badges = document.querySelectorAll('#cart-count');
        const count = CartAPI.getCount();
        
        badges.forEach(badge => {
            if (badge) {
                badge.textContent = count;
                if (count === 0) {
                    badge.classList.add('hidden');
                } else {
                    badge.classList.remove('hidden');
                }
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
    Categories: CategoriesAPI,  // Ajouté
    Countries: CountriesAPI,
    Orders: OrdersAPI,
    Cart: CartAPI,
    Supplier: SupplierAPI,
    storage: storage,
    config: {
        baseURL: API_BASE,
        isLocal: isLocal
    }
};

// Initialisation auto du badge panier au chargement
document.addEventListener('DOMContentLoaded', () => {
    CartAPI.updateBadge();
});