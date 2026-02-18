// ============================================
// STATE.JS - Gestion d'état globale Brandia
// Store centralisé avec observables
// ============================================

class BrandiaState {
  constructor() {
    this.state = {
      // Auth
      user: null,
      token: null,
      isAuthenticated: false,
      
      // UI
      theme: localStorage.getItem('theme') || 'dark',
      country: localStorage.getItem('country') || 'FR',
      currency: localStorage.getItem('currency') || 'EUR',
      
      // Cart
      cart: JSON.parse(localStorage.getItem('brandia_cart') || '[]'),
      
      // Navigation
      currentPage: null,
      isLoading: false,
      
      // Filtres catalogue
      filters: {
        category: null,
        priceMin: null,
        priceMax: null,
        brand: null,
        sort: 'newest'
      }
    };
    
    this.listeners = new Map();
    this.init();
  }

  init() {
    // Charger l'utilisateur depuis le localStorage
    this.loadUser();
    
    // Synchroniser le thème
    this.applyTheme();
    
    // Écouter les changements de stockage (multi-onglets)
    window.addEventListener('storage', (e) => {
      if (e.key === 'brandia_cart') {
        this.setState('cart', JSON.parse(e.newValue || '[]'), false);
      }
    });
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.setState(key, value);
  }

  setState(key, value, persist = true) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    // Persistance localStorage
    if (persist) {
      this.persist(key, value);
    }
    
    // Notifier les listeners
    this.notify(key, value, oldValue);
    
    return this;
  }

  persist(key, value) {
    const persistKeys = ['user', 'token', 'theme', 'country', 'currency', 'cart'];
    if (persistKeys.includes(key)) {
      if (typeof value === 'object') {
        localStorage.setItem(`brandia_${key}`, JSON.stringify(value));
      } else {
        localStorage.setItem(`brandia_${key}`, value);
      }
    }
  }

  // ============================================
  // OBSERVABLES
  // ============================================

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Retourner une fonction de désinscription
    return () => {
      this.listeners.get(key).delete(callback);
    };
  }

  notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`[State] Erreur listener ${key}:`, error);
        }
      });
    }
  }

  // ============================================
  // ACTIONS SPÉCIFIQUES
  // ============================================

  // Auth
  loadUser() {
    const user = localStorage.getItem('brandia_user') || localStorage.getItem('user');
    const token = localStorage.getItem('brandia_token') || localStorage.getItem('token');
    
    if (user && token) {
      try {
        this.state.user = JSON.parse(user);
        this.state.token = token;
        this.state.isAuthenticated = true;
      } catch (e) {
        this.logout();
      }
    }
  }

  login(userData, token) {
    this.setState('user', userData);
    this.setState('token', token);
    this.setState('isAuthenticated', true);
    
    // Mettre à jour le header si présent
    if (window.headerComponent) {
      window.headerComponent.init();
    }
  }

  logout() {
    this.setState('user', null);
    this.setState('token', null);
    this.setState('isAuthenticated', false);
    
    localStorage.removeItem('brandia_user');
    localStorage.removeItem('brandia_token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Redirection
    window.router.navigate('/');
  }

  // Theme
  toggleTheme() {
    const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.setState('theme', newTheme);
    this.applyTheme();
  }

  applyTheme() {
    const html = document.documentElement;
    if (this.state.theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }

  // Cart
  addToCart(product) {
    const cart = [...this.state.cart];
    const existingIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += product.quantity || 1;
    } else {
      cart.push({
        ...product,
        quantity: product.quantity || 1,
        addedAt: new Date().toISOString()
      });
    }
    
    this.setState('cart', cart);
    this.showCartNotification(product);
  }

  removeFromCart(productId) {
    const cart = this.state.cart.filter(item => item.id !== productId);
    this.setState('cart', cart);
  }

  updateCartQuantity(productId, quantity) {
    const cart = this.state.cart.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, quantity) };
      }
      return item;
    });
    this.setState('cart', cart);
  }

  clearCart() {
    this.setState('cart', []);
  }

  getCartTotal() {
    return this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getCartCount() {
    return this.state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  showCartNotification(product) {
    // Toast notification
    if (window.showToast) {
      window.showToast(`${product.name} ajouté au panier`, 'success');
    }
    
    // Animation badge
    const badge = document.getElementById('cart-badge');
    if (badge) {
      badge.classList.add('animate-bounce');
      setTimeout(() => badge.classList.remove('animate-bounce'), 1000);
    }
  }

  // Country/Currency
  setCountry(countryCode) {
    const countryMap = {
      'FR': { currency: 'EUR', name: 'France' },
      'TN': { currency: 'TND', name: 'Tunisie' },
      'DE': { currency: 'EUR', name: 'Allemagne' },
      'US': { currency: 'USD', name: 'États-Unis' },
      'GB': { currency: 'GBP', name: 'Royaume-Uni' }
    };
    
    const country = countryMap[countryCode] || countryMap['FR'];
    this.setState('country', countryCode);
    this.setState('currency', country.currency);
  }

  // Filtres
  setFilter(key, value) {
    const filters = { ...this.state.filters, [key]: value };
    this.setState('filters', filters, false); // Ne pas persister les filtres
  }

  resetFilters() {
    this.setState('filters', {
      category: null,
      priceMin: null,
      priceMax: null,
      brand: null,
      sort: 'newest'
    }, false);
  }
}

// Instance globale
window.BrandiaState = BrandiaState;
window.store = new BrandiaState();