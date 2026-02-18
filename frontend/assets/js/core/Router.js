// ============================================
// ROUTER.JS - Système de routage SPA Brandia v1.0
// Navigation sans rechargement avec History API
// ============================================

class BrandiaRouter {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};
    this.queryParams = {};
    this.beforeHooks = [];
    this.afterHooks = [];
    this.isNavigating = false;
    
    // Configuration
    this.rootElement = document.getElementById('app-content') || document.body;
    this.basePath = '';
    
    // Bindings
    this.handlePopState = this.handlePopState.bind(this);
    this.handleLinkClick = this.handleLinkClick.bind(this);
  }

  // ============================================
  // INITIALISATION
  // ============================================

  init() {
    // Écouter les événements de navigation
    window.addEventListener('popstate', this.handlePopState);
    document.addEventListener('click', this.handleLinkClick);
    
    // Route initiale
    this.navigate(window.location.pathname + window.location.search, { replace: true });
    
    console.log('[Router] ✅ Initialisé');
    return this;
  }

  // ============================================
  // DÉFINITION DES ROUTES
  // ============================================

  /**
   * Enregistrer une route
   * @param {string} path - Chemin (ex: /catalogue, /product/:id)
   * @param {Function} handler - Fonction de rendu
   * @param {Object} options - Options (title, middleware, lazy)
   */
  register(path, handler, options = {}) {
    // Convertir en regex pour matching dynamique
    const paramNames = [];
    const regexPath = path.replace(/:([^/]+)/g, (match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    this.routes.set(path, {
      path,
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
      handler,
      options: {
        title: options.title || 'Brandia',
        middleware: options.middleware || [],
        lazy: options.lazy || false,
        ...options
      }
    });

    return this;
  }

  /**
   * Enregistrer plusieurs routes
   */
  registerRoutes(routesConfig) {
    Object.entries(routesConfig).forEach(([path, config]) => {
      if (typeof config === 'function') {
        this.register(path, config);
      } else {
        this.register(path, config.handler, config.options);
      }
    });
    return this;
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Naviguer vers une route
   * @param {string} url - URL cible
   * @param {Object} options - { replace: bool, state: object }
   */
  async navigate(url, options = {}) {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      // Parser l'URL
      const parsed = this.parseUrl(url);
      const { pathname, search, hash } = parsed;
      
      // Trouver la route correspondante
      const route = this.matchRoute(pathname);
      
      if (!route) {
        console.warn(`[Router] Route non trouvée: ${pathname}`);
        this.render404();
        this.isNavigating = false;
        return;
      }

      // Exécuter les middlewares "before"
      const canProceed = await this.runBeforeHooks(route, pathname);
      if (!canProceed) {
        this.isNavigating = false;
        return;
      }

      // Mettre à jour l'historique
      const fullUrl = pathname + search + hash;
      if (options.replace) {
        history.replaceState(options.state || {}, '', fullUrl);
      } else {
        history.pushState(options.state || {}, '', fullUrl);
      }

      // Sauvegarder la route actuelle
      this.currentRoute = route;
      
      // Extraire les paramètres
      this.params = this.extractParams(pathname, route);
      this.queryParams = this.parseQueryParams(search);

      // Rendu
      await this.render(route);

      // Hooks "after"
      await this.runAfterHooks(route, pathname);

      // Scroll behavior
      if (!options.noScroll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Mettre à jour le titre
      document.title = `${route.options.title} | Brandia`;

    } catch (error) {
      console.error('[Router] Erreur navigation:', error);
      this.renderError(error);
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Navigation par défaut (back/forward)
   */
  handlePopState(event) {
    const url = window.location.pathname + window.location.search;
    this.navigate(url, { replace: true, noScroll: true });
  }

  /**
   * Intercepter les clics sur les liens internes
   */
  handleLinkClick(event) {
    const link = event.target.closest('a');
    
    if (!link) return;
    
    // Vérifier si c'est un lien interne
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
      return;
    }

    // Vérifier si Ctrl/Cmd/Shift (ouvrir dans nouvel onglet)
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.navigate(href);
  }

  // ============================================
  // RENDU
  // ============================================

  async render(route) {
    try {
      // Afficher un loader si nécessaire
      this.showLoader();

      // Charger le module si lazy loading
      let handler = route.handler;
      if (route.options.lazy && typeof route.handler === 'string') {
        handler = await this.loadLazyModule(route.handler);
      }

      // Exécuter le handler
      const content = await handler(this.params, this.queryParams);
      
      // Injecter dans le DOM
      this.rootElement.innerHTML = content;
      
      // Réattacher les événements
      this.reattachEvents();

    } catch (error) {
      console.error('[Router] Erreur rendu:', error);
      this.renderError(error);
    } finally {
      this.hideLoader();
    }
  }

  render404() {
    this.rootElement.innerHTML = `
      <div class="min-h-[60vh] flex items-center justify-center">
        <div class="text-center">
          <div class="text-6xl font-bold text-neutral-600 mb-4">404</div>
          <h1 class="text-2xl font-bold text-white mb-4">Page non trouvée</h1>
          <p class="text-neutral-400 mb-8">La page que vous recherchez n'existe pas.</p>
          <button onclick="router.navigate('/')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition-colors">
            Retour à l'accueil
          </button>
        </div>
      </div>
    `;
  }

  renderError(error) {
    this.rootElement.innerHTML = `
      <div class="min-h-[60vh] flex items-center justify-center">
        <div class="text-center">
          <div class="text-6xl font-bold text-red-500 mb-4">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h1 class="text-2xl font-bold text-white mb-4">Oups ! Une erreur est survenue</h1>
          <p class="text-neutral-400 mb-4">${error.message}</p>
          <button onclick="location.reload()" class="bg-neutral-700 hover:bg-neutral-600 text-white px-6 py-3 rounded-lg transition-colors mr-4">
            Réessayer
          </button>
          <button onclick="router.navigate('/')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition-colors">
            Accueil
          </button>
        </div>
      </div>
    `;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  parseUrl(url) {
    const a = document.createElement('a');
    a.href = url;
    return {
      pathname: a.pathname,
      search: a.search,
      hash: a.hash,
      host: a.host
    };
  }

  matchRoute(pathname) {
    for (const [path, route] of this.routes) {
      if (route.regex.test(pathname)) {
        return route;
      }
    }
    return null;
  }

  extractParams(pathname, route) {
    const match = pathname.match(route.regex);
    if (!match) return {};
    
    const params = {};
    route.paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });
    return params;
  }

  parseQueryParams(search) {
    const params = {};
    if (!search) return params;
    
    const urlParams = new URLSearchParams(search);
    urlParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  async runBeforeHooks(route, pathname) {
    for (const hook of this.beforeHooks) {
      const result = await hook(route, pathname);
      if (result === false) return false;
    }
    
    // Middlewares spécifiques à la route
    for (const middleware of route.options.middleware) {
      const result = await middleware(this.params, this.queryParams);
      if (result === false) return false;
    }
    return true;
  }

  async runAfterHooks(route, pathname) {
    for (const hook of this.afterHooks) {
      await hook(route, pathname);
    }
  }

  async loadLazyModule(modulePath) {
    try {
      const module = await import(modulePath);
      return module.default || module;
    } catch (error) {
      console.error(`[Router] Erreur chargement module ${modulePath}:`, error);
      throw error;
    }
  }

  showLoader() {
    // Créer un loader si pas déjà présent
    let loader = document.getElementById('page-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'page-loader';
      loader.className = 'fixed inset-0 bg-neutral-900/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300';
      loader.innerHTML = `
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-neutral-400 text-sm">Chargement...</p>
        </div>
      `;
      document.body.appendChild(loader);
    }
    loader.style.opacity = '1';
    loader.style.pointerEvents = 'all';
  }

  hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
    }
  }

  reattachEvents() {
    // Réattacher les événements sur les nouveaux éléments
    // Cela est géré automatiquement par le delegation d'événements
  }

  // ============================================
  // HOOKS
  // ============================================

  beforeEach(hook) {
    this.beforeHooks.push(hook);
    return this;
  }

  afterEach(hook) {
    this.afterHooks.push(hook);
    return this;
  }

  // ============================================
  // GETTERS
  // ============================================

  get currentPath() {
    return window.location.pathname;
  }

  get query() {
    return this.queryParams;
  }

  get param() {
    return this.params;
  }
}

// Instance globale
window.BrandiaRouter = BrandiaRouter;
window.router = new BrandiaRouter();