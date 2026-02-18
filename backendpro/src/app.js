// ============================================
// APP.JS - Point d'entrée principal Brandia
// Orchestration des composants et initialisation
// ============================================

class BrandiaApp {
  constructor() {
    this.router = null;
    this.header = null;
    this.footer = null;
    this.state = null;
    this.api = null;
  }

  async init() {
    console.log('[Brandia] 🚀 Initialisation...');

    // 1. Initialiser le state global
    this.state = new BrandiaState();
    window.store = this.state;

    // 2. Initialiser le router
    this.router = new BrandiaRouter();
    window.router = this.router;

    // 3. Configurer les routes
    this.setupRoutes();

    // 4. Hooks de navigation
    this.setupNavigationHooks();

    // 5. Rendre le layout de base
    this.renderLayout();

    // 6. Initialiser le router
    this.router.init();

    console.log('[Brandia] ✅ Application prête');
  }

  setupRoutes() {
    this.router.registerRoutes({
      '/': {
        handler: HomeView,
        options: { title: 'Accueil' }
      },
      '/catalogue': {
        handler: CatalogueView,
        options: { title: 'Catalogue' }
      },
      '/product/:id': {
        handler: ProductView,
        options: { title: 'Produit' }
      },
      '/panier': {
        handler: CartView,
        options: { title: 'Panier' }
      },
      '/checkout': {
        handler: CheckoutView,
        options: { title: 'Paiement', middleware: [this.requireAuth] }
      },
      '/login': {
        handler: LoginView,
        options: { title: 'Connexion' }
      },
      '/register': {
        handler: RegisterView,
        options: { title: 'Inscription' }
      },
      '/categories': {
        handler: CategoriesView,
        options: { title: 'Catégories' }
      },
      '/marques': {
        handler: BrandsView,
        options: { title: 'Marques' }
      },
      '/nouveautes': {
        handler: NewArrivalsView,
        options: { title: 'Nouveautés' }
      },
      '/offres': {
        handler: OffersView,
        options: { title: 'Offres spéciales' }
      },
      '/supplier/dashboard': {
        handler: SupplierDashboardView,
        options: { title: 'Dashboard Fournisseur', middleware: [this.requireSupplier] }
      },
      '/profil': {
        handler: ProfileView,
        options: { title: 'Mon Profil', middleware: [this.requireAuth] }
      },
      '/commandes': {
        handler: OrdersView,
        options: { title: 'Mes Commandes', middleware: [this.requireAuth] }
      }
    });

    // Route 404 par défaut
    this.router.register('*', () => {
      return `
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center">
            <h1 class="text-4xl font-bold text-white mb-4">404</h1>
            <p class="text-neutral-400 mb-8">Page non trouvée</p>
            <button onclick="router.navigate('/')" class="bg-indigo-600 text-white px-6 py-3 rounded-lg">
              Retour à l'accueil
            </button>
          </div>
        </div>
      `;
    }, { title: 'Page non trouvée' });
  }

  setupNavigationHooks() {
    // Avant chaque navigation
    this.router.beforeEach((route, pathname) => {
      // Fermer les menus mobiles
      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu) mobileMenu.classList.add('hidden');
      
      // Sauvegarder la page actuelle
      this.state.set('currentPage', pathname);
      
      return true;
    });

    // Après chaque navigation
    this.router.afterEach((route, pathname) => {
      // Mettre à jour les composants dynamiques
      this.updateDynamicComponents();
      
      // Analytics (si implémenté)
      this.trackPageView(pathname);
    });
  }

  renderLayout() {
    // Vérifier si le layout existe déjà
    if (document.getElementById('app-header')) return;

    // Créer la structure de base
    document.body.innerHTML = `
      <div id="app-root" class="min-h-screen bg-neutral-900 text-white flex flex-col">
        <header id="app-header"></header>
        <main id="app-content" class="flex-1"></main>
        <footer id="app-footer"></footer>
        
        <!-- Toast notifications -->
        <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2"></div>
        
        <!-- Cart drawer -->
        <div id="cart-drawer" class="fixed inset-0 z-50 hidden">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="app.toggleCart()"></div>
          <div class="absolute right-0 top-0 bottom-0 w-full max-w-md bg-neutral-900 border-l border-neutral-800 transform translate-x-full transition-transform duration-300" id="cart-drawer-panel">
            <!-- Contenu du panier injecté ici -->
          </div>
        </div>
      </div>
    `;

    // Initialiser les composants statiques
    this.header = new BrandiaHeader();
    this.header.init();

    this.footer = new BrandiaFooter();
    this.footer.render();
  }

  updateDynamicComponents() {
    // Mettre à jour le header si nécessaire
    if (this.header) {
      this.header.cartCount = this.state.getCartCount();
      this.header.render();
    }
  }

  // ============================================
  // MIDDLEWARES
  // ============================================

  requireAuth(params, query) {
    if (!store.get('isAuthenticated')) {
      router.navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return false;
    }
    return true;
  }

  requireSupplier(params, query) {
    const user = store.get('user');
    if (!user || user.role !== 'supplier') {
      router.navigate('/');
      return false;
    }
    return true;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    const panel = document.getElementById('cart-drawer-panel');
    
    if (drawer.classList.contains('hidden')) {
      drawer.classList.remove('hidden');
      setTimeout(() => panel.classList.remove('translate-x-full'), 10);
      this.renderCartDrawer();
    } else {
      panel.classList.add('translate-x-full');
      setTimeout(() => drawer.classList.add('hidden'), 300);
    }
  }

  renderCartDrawer() {
    const panel = document.getElementById('cart-drawer-panel');
    const cart = store.get('cart');
    const total = store.getCartTotal();

    panel.innerHTML = `
      <div class="h-full flex flex-col">
        <div class="p-6 border-b border-neutral-800 flex justify-between items-center">
          <h2 class="text-xl font-bold">Votre panier (${cart.length})</h2>
          <button onclick="app.toggleCart()" class="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center hover:bg-neutral-700">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          ${cart.length === 0 ? `
            <div class="text-center py-12">
              <i class="fas fa-shopping-bag text-4xl text-neutral-600 mb-4"></i>
              <p class="text-neutral-400">Votre panier est vide</p>
              <button onclick="app.toggleCart(); router.navigate('/catalogue')" class="mt-4 text-indigo-400 hover:text-indigo-300">
                Découvrir nos produits
              </button>
            </div>
          ` : cart.map(item => `
            <div class="flex gap-4 bg-neutral-800 rounded-lg p-4">
              <img src="${item.main_image_url}" alt="${item.name}" class="w-20 h-20 object-cover rounded-lg">
              <div class="flex-1">
                <h3 class="font-semibold text-sm mb-1">${item.name}</h3>
                <p class="text-neutral-400 text-sm mb-2">${formatPrice(item.price)}</p>
                <div class="flex items-center gap-2">
                  <button onclick="store.updateCartQuantity(${item.id}, ${item.quantity - 1})" class="w-6 h-6 rounded bg-neutral-700 flex items-center justify-center text-xs">-</button>
                  <span class="text-sm w-8 text-center">${item.quantity}</span>
                  <button onclick="store.updateCartQuantity(${item.id}, ${item.quantity + 1})" class="w-6 h-6 rounded bg-neutral-700 flex items-center justify-center text-xs">+</button>
                </div>
              </div>
              <button onclick="store.removeFromCart(${item.id})" class="text-red-400 hover:text-red-300">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `).join('')}
        </div>
        
        ${cart.length > 0 ? `
          <div class="p-6 border-t border-neutral-800 space-y-4">
            <div class="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${formatPrice(total)}</span>
            </div>
            <button onclick="app.toggleCart(); router.navigate('/checkout')" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-semibold transition-colors">
              Passer la commande
            </button>
            <button onclick="app.toggleCart()" class="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl transition-colors">
              Continuer les achats
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  trackPageView(pathname) {
    // Google Analytics ou autre
    if (window.gtag) {
      window.gtag('config', 'GA_TRACKING_ID', { page_path: pathname });
    }
  }

  // ============================================
  // API HELPERS
  // ============================================

  async api(endpoint, options = {}) {
    const baseUrl = 'https://brandia-1.onrender.com/api';
    const token = store.get('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          store.logout();
          throw new Error('Session expirée');
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[API] Erreur:', error);
      throw error;
    }
  }
}

// Initialisation au chargement
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BrandiaApp();
  app.init();
});

// Helpers globaux
window.formatPrice = (price) => {
  const currency = store?.get('currency') || 'EUR';
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency 
  }).format(price);
};

window.showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-y-10 opacity-0 ${
    type === 'success' ? 'bg-green-500/20 border border-green-500/50 text-green-400' :
    type === 'error' ? 'bg-red-500/20 border border-red-500/50 text-red-400' :
    'bg-indigo-500/20 border border-indigo-500/50 text-indigo-400'
  }`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span class="font-medium">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Animation d'entrée
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
  });
  
  // Disparition automatique
  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};