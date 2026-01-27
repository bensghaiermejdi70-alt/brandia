// ============================================
// BRANDIA API CLIENT - Frontend
// ============================================

const API_BASE_URL = 'http://localhost:4000/api';

// Stockage local
const storage = {
    getToken: () => localStorage.getItem('brandia_token'),
    setToken: (token) => localStorage.setItem('brandia_token', token),
    removeToken: () => localStorage.removeItem('brandia_token'),
    getUser: () => JSON.parse(localStorage.getItem('brandia_user') || '{}'),
    setUser: (user) => localStorage.setItem('brandia_user', JSON.stringify(user))
};

// Fonction fetch avec auth
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

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur API');
        }

        return data;

    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// AUTH API
// ============================================

const AuthAPI = {
    register: async (userData) => {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        if (data.success) {
            storage.setToken(data.data.accessToken);
            storage.setUser(data.data.user);
        }
        return data;
    },

    login: async (email, password) => {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (data.success) {
            storage.setToken(data.data.accessToken);
            storage.setUser(data.data.user);
        }
        return data;
    },

    logout: () => {
        storage.removeToken();
        localStorage.removeItem('brandia_user');
        window.location.href = 'index.html';
    },

    isLoggedIn: () => !!storage.getToken(),

    getUser: () => storage.getUser()
};

// ============================================
// PRODUCTS API
// ============================================

const ProductsAPI = {
    getAll: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return await apiFetch(`/products?${queryString}`);
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
// COUNTRIES & CATEGORIES API
// ============================================

const CountriesAPI = {
    getAll: async () => {
        return await apiFetch('/countries');
    },
    
    getCategories: async () => {
        return await apiFetch('/countries/categories');
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
// SUPPLIER API (NOUVEAU - Pour le dashboard)
// ============================================

const SupplierAPI = {
    // Vérifier l'authentification et le rôle
    init: () => {
        const token = storage.getToken();
        const user = storage.getUser();
        
        if (!token) {
            window.location.href = '../login.html?redirect=supplier/dashboard';
            return false;
        }
        
        if (user.role !== 'supplier') {
            alert('Accès réservé aux fournisseurs');
            window.location.href = '../index.html';
            return false;
        }
        
        return true;
    },

    logout: () => {
        AuthAPI.logout();
    },

    // Récupérer les statistiques du dashboard
    getStats: async () => {
        try {
            return await apiFetch('/supplier/dashboard');
        } catch (error) {
            console.error('Erreur stats:', error);
            return { success: false, data: null };
        }
    },

    // Récupérer les produits du fournisseur
    getProducts: async () => {
        try {
            return await apiFetch('/supplier/products');
        } catch (error) {
            console.error('Erreur produits:', error);
            return { success: false, data: { products: [] } };
        }
    },

    // Créer un nouveau produit
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

    // Modifier un produit
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

    // Supprimer un produit
    deleteProduct: async (id) => {
        try {
            return await apiFetch(`/supplier/products/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Récupérer les commandes du fournisseur
    getOrders: async (status = null) => {
        try {
            const query = status ? `?status=${status}` : '';
            return await apiFetch(`/supplier/orders${query}`);
        } catch (error) {
            console.error('Erreur commandes:', error);
            return { success: false, data: { orders: [] } };
        }
    },

    // Mettre à jour le statut d'une commande
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

    // Récupérer les informations de paiement
    getPayments: async () => {
        try {
            return await apiFetch('/supplier/payments');
        } catch (error) {
            console.error('Erreur paiements:', error);
            return { success: false, data: null };
        }
    },

    // Demander un virement
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

    // Récupérer le profil fournisseur
    getProfile: async () => {
        try {
            return await apiFetch('/supplier/profile');
        } catch (error) {
            return { success: false, data: null };
        }
    },

    // Mettre à jour le profil
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
// CART (LocalStorage)
// ============================================

const CartAPI = {
    get: () => {
        return JSON.parse(localStorage.getItem('brandia_cart') || '[]');
    },

    add: (product, quantity = 1) => {
        const cart = CartAPI.get();
        const existing = cart.find(item => item.product_id === product.id);
        
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({
                product_id: product.id,
                name: product.name,
                price: product.price,
                image: product.main_image_url,
                quantity: quantity
            });
        }
        
        localStorage.setItem('brandia_cart', JSON.stringify(cart));
        CartAPI.updateBadge();
    },

    remove: (productId) => {
        let cart = CartAPI.get();
        cart = cart.filter(item => item.product_id !== productId);
        localStorage.setItem('brandia_cart', JSON.stringify(cart));
        CartAPI.updateBadge();
    },

    clear: () => {
        localStorage.removeItem('brandia_cart');
        CartAPI.updateBadge();
    },

    getCount: () => {
        return CartAPI.get().reduce((sum, item) => sum + item.quantity, 0);
    },

    updateBadge: () => {
        const badge = document.getElementById('cart-count');
        if (badge) {
            badge.textContent = CartAPI.getCount();
        }
    }
};

// ============================================
// EXPORT
// ============================================

window.BrandiaAPI = {
    Auth: AuthAPI,
    Products: ProductsAPI,
    Countries: CountriesAPI,
    Orders: OrdersAPI,
    Cart: CartAPI,
    Supplier: SupplierAPI,  // NOUVEAU
    storage: storage
};