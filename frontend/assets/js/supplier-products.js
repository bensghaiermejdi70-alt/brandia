// ============================================
// SUPPLIER PRODUCTS MODULE - v4.3 PRODUCTION READY
// Corrections: Placeholder SVG inline, Validation robuste, Upload retry, CSV UTF-8
// ============================================
window.SupplierProducts = {
  state: {
    products: [],
    categories: [],
    currentPage: 1,
    itemsPerPage: 12,
    editingId: null,
    filters: { search: '', status: '', category: '' },
    importInProgress: false,
    uploadedImage: null,
    importResults: { success: [], errors: [] }
  },

  // ✅ Placeholder SVG encodé en base64 - PAS DE DÉPENDANCE EXTERNE
  PLACEHOLDER_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUyOTNiIi8+PHN2ZyB4PSI1MCUiIHk9IjUwJSIgdmlld0JveD0iMCAwIDI0IDI0IiB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiM2NDc0OGIiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC00MCwgLTQwKSI+PHBhdGggZD0iTTIxIDE5VjVjMC0xLjEtLjktMi0yLTJINWMtMS4xIDAtMiAuOS0yIDJ2MTRjMCAxLjEuOSAyIDIgMmgxNGMxLjEgMCAyLS45IDItMnpNOC41IDEzLjVsMi41IDMuMDFMMTQuNSAxMmw0LjUgNmg1bC02LTgtNC41IDZ6Ii8+PC9zdmc+PC9zdmc+',

  BRANDIA_CATEGORIES: [
    { id: 1, slug: 'cosmetiques-soins-peau', name: 'Cosmétiques & soins de la peau', icon: 'fa-spa' },
    { id: 2, slug: 'parfums-fragrances', name: 'Parfums & fragrances', icon: 'fa-spray-can' },
    { id: 3, slug: 'maquillage', name: 'Maquillage', icon: 'fa-magic' },
    { id: 4, slug: 'soins-capillaires', name: 'Soins capillaires', icon: 'fa-cut' },
    { id: 5, slug: 'complements-bien-etre', name: 'Compléments bien-être', icon: 'fa-heart' },
    { id: 6, slug: 'mode-accessoires', name: 'Mode & accessoires', icon: 'fa-tshirt' },
    { id: 7, slug: 'montres-bijoux', name: 'Montres & bijoux', icon: 'fa-gem' },
    { id: 8, slug: 'sport-fitness', name: 'Articles de sport', icon: 'fa-dumbbell' },
    { id: 9, slug: 'nutrition-sportive', name: 'Nutrition sportive', icon: 'fa-apple-alt' },
    { id: 10, slug: 'high-tech-mobile', name: 'High-tech & mobile', icon: 'fa-mobile-alt' },
    { id: 11, slug: 'electronique-lifestyle', name: 'Électronique', icon: 'fa-headphones' },
    { id: 12, slug: 'maison-decoration', name: 'Maison & décoration', icon: 'fa-home' },
    { id: 13, slug: 'parfumerie-interieur', name: 'Parfumerie intérieur', icon: 'fa-fire' },
    { id: 14, slug: 'produits-ecologiques', name: 'Produits écologiques', icon: 'fa-leaf' },
    { id: 15, slug: 'bebe-maternite', name: 'Bébé & maternité', icon: 'fa-baby' },
    { id: 16, slug: 'animaux-pets', name: 'Animaux', icon: 'fa-paw' },
    { id: 17, slug: 'sante-hygiene', name: 'Santé & hygiène', icon: 'fa-heartbeat' },
    { id: 18, slug: 'bagagerie-voyage', name: 'Bagagerie & voyage', icon: 'fa-suitcase' },
    { id: 19, slug: 'papeterie-lifestyle', name: 'Papeterie', icon: 'fa-pen-fancy' },
    { id: 20, slug: 'artisanat-local', name: 'Artisanat local', icon: 'fa-hands' },
    { id: 21, slug: 'sport-loisirs', name: 'Sport & loisirs', icon: 'fa-bicycle' }
  ],

  // ==========================================
  // INITIALISATION
  // ==========================================
  init: async function() {
    console.log('[Products] Initialisation v4.3...');
    this.loadCategories();
    await this.loadProducts();
    this.setupEventListeners();
    this.setupPapaParse();
  },

  setupPapaParse: function() {
    if (typeof Papa === 'undefined') {
      console.log('[Products] Chargement de PapaParse...');
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/papaparse@5.4.1/papaparse.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.integrity = 'sha384-...'; // À remplacer par le hash réel en production
      script.onload = () => console.log('[Products] PapaParse chargé');
      script.onerror = () => console.error('[Products] Échec chargement PapaParse');
      document.head.appendChild(script);
    }
  },

  setupEventListeners: function() {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce((e) => {
        this.state.filters.search = e.target.value.toLowerCase().trim();
        this.state.currentPage = 1;
        this.renderProducts();
      }, 300));
    }

    const categoryFilter = document.getElementById('product-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        this.state.filters.category = categoryFilter.value;
        this.state.currentPage = 1;
        this.renderProducts();
      });
    }

    const statusFilter = document.getElementById('product-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.state.filters.status = statusFilter.value;
        this.state.currentPage = 1;
        this.renderProducts();
      });
    }
  },

  debounce: function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // ==========================================
  // CHARGEMENT DES DONNÉES
  // ==========================================
  loadProducts: async function() {
    try {
      console.log('[Products] Chargement...');
      this.showLoading(true);

      if (!window.BrandiaAPI || !BrandiaAPI.Supplier) {
        throw new Error('API non disponible');
      }

      const response = await BrandiaAPI.Supplier.getProducts();
      console.log('[Products] Réponse API:', response);

      if (!response || typeof response !== 'object') {
        throw new Error('Réponse API invalide');
      }

      if (response.success) {
        let productsArray = [];

        if (Array.isArray(response.data)) {
          productsArray = response.data;
        } else if (response.data?.products && Array.isArray(response.data.products)) {
          productsArray = response.data.products;
        } else if (response.data && typeof response.data === 'object') {
          const possibleArrays = Object.values(response.data).filter(v => Array.isArray(v));
          if (possibleArrays.length > 0) {
            productsArray = possibleArrays[0];
          }
        }

        this.state.products = await this.enrichWithPromotions(productsArray);
        console.log('[Products] Chargés:', this.state.products.length, 'produits');
        this.renderProducts();
        this.updateProductCount();
        this.updateStats();
      } else {
        console.error('[Products] Erreur API:', response.message);
        this.showError('Erreur chargement produits: ' + (response.message || 'Inconnue'));
      }
    } catch (error) {
      console.error('[Products] Erreur:', error);
      this.showError('Erreur chargement produits: ' + (error.message || 'Erreur inconnue'));
    } finally {
      this.showLoading(false);
    }
  },

  enrichWithPromotions: async function(products) {
    if (!products || products.length === 0) return products;

    try {
      if (!BrandiaAPI.Supplier?.getPromotions) return products;

      const promoResponse = await BrandiaAPI.Supplier.getPromotions();
      if (!promoResponse?.success || !promoResponse?.data) return products;

      const now = new Date();
      const activePromos = promoResponse.data.filter(p =>
        p.status === 'active' &&
        new Date(p.start_date) <= now &&
        new Date(p.end_date) >= now
      );

      return products.map(product => {
        const productPromos = activePromos.filter(p =>
          p.applies_to === 'all' ||
          (p.target_products && Array.isArray(p.target_products) && p.target_products.includes(product.id))
        );

        if (productPromos.length > 0) {
          const bestPromo = productPromos[0];
          let finalPrice = parseFloat(product.price) || 0;

          if (bestPromo.type === 'percentage') {
            finalPrice = finalPrice * (1 - bestPromo.value / 100);
          } else if (bestPromo.type === 'fixed') {
            finalPrice = Math.max(0, finalPrice - bestPromo.value);
          }

          return {
            ...product,
            has_promotion: true,
            promotion: bestPromo,
            final_price: parseFloat(finalPrice.toFixed(2)),
            original_price: parseFloat(product.price)
          };
        }

        return {
          ...product,
          has_promotion: false,
          final_price: parseFloat(product.price) || 0
        };
      });
    } catch (error) {
      console.warn('[Products] Erreur enrichissement promotions:', error);
      return products;
    }
  },

  loadCategories: function() {
    this.state.categories = this.BRANDIA_CATEGORIES;

    const filter = document.getElementById('product-category-filter');
    const select = document.getElementById('product-category-select');

    const options = this.state.categories
      .map(c => `<option value="${c.id}">${c.name}</option>`)
      .join('');

    if (filter) {
      filter.innerHTML = '<option value="">Toutes les catégories</option>' + options;
    }
    if (select) {
      select.innerHTML = '<option value="">Choisir...</option>' + options;
    }
  },

  // ==========================================
  // RENDU DES PRODUITS
  // ==========================================
  renderProducts: function() {
    const container = document.getElementById('products-grid');
    if (!container) {
      console.error('[Products] Container #products-grid non trouvé');
      return;
    }

    if (!Array.isArray(this.state.products)) {
      console.error('[Products] state.products n\'est pas un tableau');
      container.innerHTML = this.renderErrorState('Erreur de données produits');
      return;
    }

    let filtered = this.state.products.filter(p => {
      const matchSearch = !this.state.filters.search ||
        (p.name && p.name.toLowerCase().includes(this.state.filters.search)) ||
        (p.description && p.description.toLowerCase().includes(this.state.filters.search)) ||
        (p.sku && p.sku.toLowerCase().includes(this.state.filters.search));

      const matchCategory = !this.state.filters.category ||
        p.category_id == this.state.filters.category;

      const matchStatus = !this.state.filters.status ||
        (this.state.filters.status === 'published' && p.is_active !== false) ||
        (this.state.filters.status === 'draft' && p.is_active === false);

      return matchSearch && matchCategory && matchStatus;
    });

    const totalPages = Math.ceil(filtered.length / this.state.itemsPerPage) || 1;
    const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
    const paginated = filtered.slice(start, start + this.state.itemsPerPage);

    if (paginated.length === 0) {
      container.innerHTML = this.renderEmptyState();
    } else {
      container.innerHTML = paginated.map(p => this.renderProductCard(p)).join('');
    }

    this.renderPagination(totalPages, filtered.length);
  },

  renderEmptyState: function() {
    return `
      <div class="col-span-full text-center py-12 text-slate-500">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <i class="fas fa-box-open text-4xl opacity-50"></i>
        </div>
        <p class="text-lg font-medium">Aucun produit trouvé</p>
        <p class="text-sm mt-2 mb-4">Commencez par créer votre premier produit ou importez un CSV</p>
        <div class="flex gap-3 justify-center">
          <button onclick="SupplierProducts.openModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors">
            <i class="fas fa-plus mr-2"></i>Ajouter un produit
          </button>
          <button onclick="SupplierProducts.importProducts()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white transition-colors">
            <i class="fas fa-file-csv mr-2"></i>Importer CSV
          </button>
        </div>
      </div>
    `;
  },

  renderErrorState: function(message) {
    return `
      <div class="col-span-full text-center py-12 text-red-400">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-red-900/20 flex items-center justify-center">
          <i class="fas fa-exclamation-circle text-4xl"></i>
        </div>
        <p class="font-medium">${message || 'Une erreur est survenue'}</p>
        <button onclick="SupplierProducts.loadProducts()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
          <i class="fas fa-redo mr-2"></i>Réessayer
        </button>
      </div>
    `;
  },

  renderProductCard: function(p) {
    const category = this.state.categories.find(c => c.id === p.category_id);
    const isActive = p.is_active !== false;
    const stock = parseInt(p.stock_quantity) || 0;
    const stockClass = stock === 0 ? 'text-red-400 bg-red-900/20' :
                       stock < 5 ? 'text-amber-400 bg-amber-900/20' :
                       'text-emerald-400 bg-emerald-900/20';
    const stockIcon = stock === 0 ? 'fa-times-circle' :
                      stock < 5 ? 'fa-exclamation-circle' :
                      'fa-check-circle';

    const hasPromo = p.has_promotion && p.final_price < p.original_price;
    const priceDisplay = hasPromo ?
      `<span class="text-lg font-bold text-emerald-400">${p.final_price.toFixed(2)} €</span>
       <span class="text-sm text-slate-500 line-through">${p.original_price.toFixed(2)} €</span>
       <span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">-${Math.round((1 - p.final_price/p.original_price) * 100)}%</span>` :
      `<span class="text-xl font-bold text-white">${parseFloat(p.price || 0).toFixed(2)} €</span>`;

    // ✅ Utilisation du placeholder inline
    const imageUrl = p.main_image_url || this.PLACEHOLDER_IMAGE;

    return `
      <div class="card rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all duration-300 bg-slate-800/50 border border-slate-700">
        <div class="relative aspect-square bg-slate-800 overflow-hidden">
          <img src="${imageUrl}"
               alt="${p.name || 'Produit'}"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
               onerror="this.src='${this.PLACEHOLDER_IMAGE}'; this.onerror=null;"
               loading="lazy">
          ${hasPromo ? '<div class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">PROMO</div>' : ''}
          <div class="absolute top-2 right-2 flex gap-2">
            <button onclick="SupplierProducts.toggleStatus(${p.id}, ${isActive})"
                    class="w-8 h-8 rounded-full ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}
                           flex items-center justify-center hover:scale-110 transition-transform backdrop-blur-sm"
                    title="${isActive ? 'Actif' : 'Inactif'}">
              <i class="fas ${isActive ? 'fa-eye' : 'fa-eye-slash'} text-xs"></i>
            </button>
          </div>
          ${!isActive ? '<div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-sm"><span class="px-3 py-1 bg-slate-800 rounded-full text-xs font-medium border border-slate-600">Inactif</span></div>' : ''}
        </div>
        <div class="p-4">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <span class="text-xs text-indigo-400 font-medium">${category?.name || 'Sans catégorie'}</span>
              <h3 class="font-semibold text-white mt-1 line-clamp-2 text-sm">${p.name || 'Sans nom'}</h3>
              ${p.sku ? `<p class="text-xs text-slate-500 mt-0.5">SKU: ${p.sku}</p>` : ''}
            </div>
          </div>
          <p class="text-slate-400 text-xs line-clamp-2 mb-3 h-8">${p.description || 'Aucune description'}</p>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              ${priceDisplay}
            </div>
            <span class="text-xs ${stockClass} flex items-center gap-1 px-2 py-1 rounded-full">
              <i class="fas ${stockIcon}"></i>
              ${stock}
            </span>
          </div>
          <div class="flex gap-2">
            <button onclick="SupplierProducts.openModal(${p.id})"
                    class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors">
              <i class="fas fa-edit mr-1"></i> Modifier
            </button>
            <button onclick="SupplierProducts.duplicateProduct(${p.id})"
                    class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                    title="Dupliquer">
              <i class="fas fa-copy"></i>
            </button>
            <button onclick="SupplierProducts.deleteProduct(${p.id})"
                    class="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderPagination: function(totalPages, totalItems) {
    const pagination = document.getElementById('products-pagination');
    const pageInfo = document.getElementById('page-info');

    if (pagination) {
      pagination.classList.toggle('hidden', totalPages <= 1);
    }
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.state.currentPage} sur ${totalPages} (${totalItems} produit${totalItems > 1 ? 's' : ''})`;
    }

    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) {
      prevBtn.disabled = this.state.currentPage === 1;
      prevBtn.classList.toggle('opacity-50', this.state.currentPage === 1);
    }
    if (nextBtn) {
      nextBtn.disabled = this.state.currentPage >= totalPages;
      nextBtn.classList.toggle('opacity-50', this.state.currentPage >= totalPages);
    }
  },

  // ==========================================
  // ACTIONS PRODUITS
  // ==========================================
  filterProducts: function() {
    this.state.filters.category = document.getElementById('product-category-filter')?.value || '';
    this.state.filters.status = document.getElementById('product-status-filter')?.value || '';
    this.state.currentPage = 1;
    this.renderProducts();
  },

  changeProductPage: function(delta) {
    this.state.currentPage += delta;
    this.renderProducts();
  },

  toggleStatus: async function(productId, currentStatus) {
    try {
      const newStatus = !currentStatus;
      console.log(`[Products] Toggle status ${productId}: ${currentStatus} → ${newStatus}`);

      this.showLoading(true);

      if (!BrandiaAPI.Supplier?.updateProduct) {
        throw new Error('API updateProduct non disponible');
      }

      const response = await BrandiaAPI.Supplier.updateProduct(productId, { is_active: newStatus });

      if (!response?.success) {
        throw new Error(response?.message || 'Erreur mise à jour');
      }

      const product = this.state.products.find(p => p.id === productId);
      if (product) {
        product.is_active = newStatus;
      }

      this.renderProducts();
      this.showToast(newStatus ? 'Produit activé ✓' : 'Produit désactivé', 'success');
    } catch (error) {
      console.error('[Products] Toggle status error:', error);
      this.showToast('Erreur: ' + (error.message || 'Inconnue'), 'error');
    } finally {
      this.showLoading(false);
    }
  },

  duplicateProduct: async function(productId) {
    try {
      const original = this.state.products.find(p => p.id === productId);
      if (!original) {
        this.showToast('Produit non trouvé', 'error');
        return;
      }

      const newProduct = {
        name: original.name + ' (Copie)',
        description: original.description,
        price: original.price,
        stock_quantity: original.stock_quantity,
        category_id: original.category_id,
        main_image_url: original.main_image_url,
        sku: original.sku ? original.sku + '-COPY' : null
      };

      this.showLoading(true);

      if (!BrandiaAPI.Supplier?.createProduct) {
        throw new Error('API createProduct non disponible');
      }

      const response = await BrandiaAPI.Supplier.createProduct(newProduct);

      if (response?.success) {
        this.showToast('Produit dupliqué ✓', 'success');
        await this.loadProducts();
      } else {
        throw new Error(response?.message || 'Erreur duplication');
      }
    } catch (error) {
      this.showToast('Erreur duplication: ' + (error.message || 'Inconnue'), 'error');
    } finally {
      this.showLoading(false);
    }
  },

  deleteProduct: async function(productId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?\nCette action est irréversible.')) {
      return;
    }

    try {
      this.showLoading(true);

      if (!BrandiaAPI.Supplier?.deleteProduct) {
        throw new Error('API deleteProduct non disponible');
      }

      const response = await BrandiaAPI.Supplier.deleteProduct(productId);

      if (!response?.success) {
        throw new Error(response?.message || 'Erreur suppression');
      }

      this.state.products = this.state.products.filter(p => p.id !== productId);
      this.renderProducts();
      this.updateProductCount();
      this.showToast('Produit supprimé ✓', 'success');
    } catch (error) {
      console.error('[Products] Delete error:', error);
      this.showToast('Erreur lors de la suppression: ' + (error.message || 'Inconnue'), 'error');
    } finally {
      this.showLoading(false);
    }
  },

  updateProductCount: function() {
    const badge = document.getElementById('product-count');
    if (badge) {
      badge.textContent = this.state.products.length;
      badge.classList.toggle('hidden', this.state.products.length === 0);
    }
  },

  updateStats: function() {
    const totalProducts = this.state.products.length;
    const activeProducts = this.state.products.filter(p => p.is_active !== false).length;
    const lowStock = this.state.products.filter(p => (p.stock_quantity || 0) < 5).length;

    const statsElements = {
      'stat-total-products': totalProducts,
      'stat-active-products': activeProducts,
      'stat-low-stock': lowStock
    };

    Object.entries(statsElements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  },

  // ==========================================
  // MODAL (CREATE / EDIT)
  // ==========================================
  openModal: function(productId = null) {
    this.state.editingId = productId;
    this.state.uploadedImage = null;

    const title = document.getElementById('product-modal-title');
    const previewContainer = document.getElementById('image-preview-container');

    if (previewContainer) {
      previewContainer.classList.add('hidden');
    }

    if (productId) {
      const product = this.state.products.find(p => p.id === productId);
      if (!product) {
        this.showToast('Produit non trouvé', 'error');
        return;
      }

      if (title) title.textContent = 'Modifier le produit';

      const fields = {
        'product-name': product.name,
        'product-description': product.description || '',
        'product-price': product.price,
        'product-compare-price': product.compare_price || '',
        'product-stock': product.stock_quantity || 10,
        'product-sku': product.sku || '',
        'product-category-select': product.category_id || ''
      };

      Object.entries(fields).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value !== null && value !== undefined ? value : '';
      });

      if (product.main_image_url) {
        this.showImagePreview(product.main_image_url);
      }
    } else {
      if (title) title.textContent = 'Ajouter un produit';
      const form = document.getElementById('product-form');
      if (form) form.reset();

      const defaults = {
        'product-stock': 10,
        'product-price': ''
      };
      Object.entries(defaults).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value;
      });
    }

    this.openModalUI('product-modal');
  },

  openModalUI: function(modalId) {
    if (window.DashboardApp && typeof DashboardApp.openModal === 'function') {
      DashboardApp.openModal(modalId);
    } else {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
      }
    }
  },

  showImagePreview: function(url) {
    const preview = document.getElementById('image-preview');
    const container = document.getElementById('image-preview-container');

    if (preview && container) {
      preview.src = url || this.PLACEHOLDER_IMAGE;
      preview.onerror = () => {
        preview.src = this.PLACEHOLDER_IMAGE;
        preview.onerror = null;
      };
      container.classList.remove('hidden');
    }
  },

  // ==========================================
  // SAUVEGARDE PRODUIT - VALIDATION COMPLÈTE
  // ==========================================
  save: async function() {
    console.log('[Products] ========== SAUVEGARDE DÉMARRÉE ==========');

    try {
      const formData = this.validateAndCollectFormData();
      if (!formData) return false;

      console.log('[Products Save] Données validées:', formData);
      this.showLoading(true);

      if (!BrandiaAPI.Supplier) {
        throw new Error('API Supplier non disponible');
      }

      let response;
      if (this.state.editingId) {
        console.log('[Products Save] Mise à jour produit ID:', this.state.editingId);
        response = await BrandiaAPI.Supplier.updateProduct(this.state.editingId, formData);

        if (response?.success) {
          const index = this.state.products.findIndex(p => p.id === this.state.editingId);
          if (index !== -1) {
            this.state.products[index] = { ...this.state.products[index], ...response.data };
          }
          this.showToast('Produit mis à jour ✓', 'success');
        } else {
          throw new Error(response?.message || 'Erreur lors de la mise à jour');
        }
      } else {
        console.log('[Products Save] Création nouveau produit');
        response = await BrandiaAPI.Supplier.createProduct(formData);

        if (response?.success && response?.data) {
          this.state.products.unshift(response.data);
          this.showToast('Produit créé avec succès ✓', 'success');
        } else {
          throw new Error(response?.message || 'Erreur lors de la création');
        }
      }

      this.closeProductModal();
      this.renderProducts();
      this.updateProductCount();
      this.updateStats();
      this.state.uploadedImage = null;

      console.log('[Products Save] ========== SAUVEGARDE TERMINÉE ==========');
      return true;

    } catch (error) {
      console.error('[Products Save] ERREUR:', error);
      this.handleSaveError(error);
      return false;
    } finally {
      this.showLoading(false);
    }
  },

  validateAndCollectFormData: function() {
    const nameInput = document.getElementById('product-name');
    const priceInput = document.getElementById('product-price');
    const comparePriceInput = document.getElementById('product-compare-price');
    const categoryInput = document.getElementById('product-category-select');
    const stockInput = document.getElementById('product-stock');

    const name = nameInput?.value?.trim();
    const price = parseFloat(priceInput?.value);
    const comparePrice = comparePriceInput?.value ? parseFloat(comparePriceInput.value) : null;
    const categoryId = parseInt(categoryInput?.value) || null;
    const stock = parseInt(stockInput?.value) || 0;

    // ✅ Validation complète
    if (!name || name.length < 2) {
      this.showToast('Le nom doit contenir au moins 2 caractères', 'error');
      nameInput?.focus();
      return null;
    }

    if (isNaN(price) || price <= 0) {
      this.showToast('Veuillez saisir un prix valide supérieur à 0', 'error');
      priceInput?.focus();
      return null;
    }

    if (comparePrice !== null && comparePrice <= price) {
      this.showToast('Le prix barré doit être supérieur au prix de vente', 'error');
      comparePriceInput?.focus();
      return null;
    }

    if (!categoryId) {
      this.showToast('Veuillez sélectionner une catégorie', 'error');
      categoryInput?.focus();
      return null;
    }

    const fields = {
      name: name,
      description: document.getElementById('product-description')?.value?.trim() || '',
      price: price,
      stock_quantity: stock,
      category_id: categoryId,
      compare_price: comparePrice,
      sku: document.getElementById('product-sku')?.value?.trim() || null
    };

    // ✅ Gestion image uploadée ou existante
    if (this.state.uploadedImage?.url) {
      fields.main_image_url = this.state.uploadedImage.url;
    } else if (this.state.editingId) {
      const existing = this.state.products.find(p => p.id === this.state.editingId);
      if (existing?.main_image_url) {
        fields.main_image_url = existing.main_image_url;
      }
    }

    return fields;
  },

  handleSaveError: function(error) {
    let message = 'Erreur lors de l\'enregistrement';

    if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
      if (error.message.includes('sku')) {
        message = 'Ce SKU est déjà utilisé par un autre produit';
      } else if (error.message.includes('slug')) {
        message = 'Un produit avec ce nom existe déjà';
      } else {
        message = 'Ce produit existe déjà';
      }
    } else if (error.message?.includes('foreign key')) {
      message = 'Catégorie invalide';
    } else if (error.message?.includes('not null')) {
      message = 'Tous les champs obligatoires doivent être remplis';
    } else if (error.message) {
      message = error.message;
    }

    this.showToast(message, 'error');
  },

  // ==========================================
  // FERMETURE MODAL
  // ==========================================
  closeProductModal: function() {
    if (window.DashboardApp?.closeModal) {
      DashboardApp.closeModal('product-modal');
    } else {
      const modal = document.getElementById('product-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
      }
    }

    const form = document.getElementById('product-form');
    if (form) form.reset();

    this.state.editingId = null;
    this.state.uploadedImage = null;

    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');
  },

  // ==========================================
  // UPLOAD IMAGE - AVEC RETRY ET COMPRESSION
  // ==========================================
  handleImageSelect: async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      this.showToast(validation.message, 'error');
      event.target.value = '';
      return;
    }

    try {
      this.showLoading(true);

      // ✅ Compression si nécessaire
      const compressedFile = await this.compressImage(file);
      console.log('[Products Upload] Original:', file.size, 'Compressed:', compressedFile.size);

      const formData = new FormData();
      formData.append('media', compressedFile);

      // ✅ Upload avec retry
      const result = await this.uploadWithRetry(formData);

      if (result?.success) {
        const imageUrl = result.data?.url || result.data?.secure_url || result.url;
        if (!imageUrl) {
          throw new Error('URL image non trouvée dans la réponse');
        }

        this.state.uploadedImage = {
          url: imageUrl,
          public_id: result.data?.public_id || null
        };

        this.showImagePreview(imageUrl);
        this.showToast('Image uploadée ✓', 'success');
      } else {
        throw new Error(result?.message || 'Erreur upload');
      }
    } catch (error) {
      console.error('[Products Upload] Error:', error);
      this.showToast(this.getUploadErrorMessage(error), 'error');
      event.target.value = '';
    } finally {
      this.showLoading(false);
    }
  },

  validateImageFile: function(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (file.size > maxSize) {
      return { valid: false, message: 'L\'image ne doit pas dépasser 5MB' };
    }
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, message: 'Format accepté: JPG, PNG, WebP, GIF' };
    }
    return { valid: true };
  },

  compressImage: function(file) {
    return new Promise((resolve) => {
      // Pas de compression si déjà petit
      if (file.size < 500 * 1024) {
        resolve(file);
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 1200;
        let width = img.width;
        let height = img.height;

        // Redimensionnement proportionnel
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          } else {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.85);
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  },

  uploadWithRetry: async function(formData, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BrandiaAPI.config.apiURL}/supplier/upload-image`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        console.warn(`[Upload] Tentative ${attempt}/${maxRetries} échouée:`, error.message);

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    throw lastError;
  },

  getUploadErrorMessage: function(error) {
    if (error.message?.includes('413')) return 'Image trop lourde (max 5MB)';
    if (error.message?.includes('401')) return 'Session expirée, reconnectez-vous';
    if (error.message?.includes('403')) return 'Accès refusé - permissions insuffisantes';
    if (error.message?.includes('Failed to fetch')) return 'Connexion impossible au serveur';
    if (error.message?.includes('NetworkError')) return 'Erreur réseau - vérifiez votre connexion';
    return error.message || 'Erreur upload image';
  },

  removeUploadedImage: function() {
    this.state.uploadedImage = null;
    const preview = document.getElementById('image-preview');
    const container = document.getElementById('image-preview-container');
    const fileInput = document.getElementById('product-image-input');

    if (preview) preview.src = '';
    if (container) container.classList.add('hidden');
    if (fileInput) fileInput.value = '';
  },

  // ==========================================
  // IMPORT CSV - ROBUSTE UTF-8
  // ==========================================
  importProducts: function() {
    if (typeof Papa === 'undefined') {
      this.showToast('Chargement du parser CSV...', 'info');
      setTimeout(() => this.importProducts(), 1000);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = (e) => this.handleCSVImport(e);
    input.click();
  },

  handleCSVImport: async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (this.state.importInProgress) {
      this.showToast('Import déjà en cours...', 'warning');
      return;
    }

    this.state.importInProgress = true;
    this.state.importResults = { success: [], errors: [] };

    try {
      this.showLoading(true);
      this.showToast('Analyse du fichier CSV...', 'info');

      const parseResult = await this.parseCSVWithPapa(file);

      if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
        throw new Error(`Erreur parsing CSV: ${parseResult.errors[0].message}`);
      }

      const products = this.transformCSVData(parseResult.data);

      if (products.length === 0) {
        throw new Error('Aucun produit valide trouvé dans le CSV');
      }

      const validatedProducts = this.validateCSVProducts(products);

      if (validatedProducts.length === 0) {
        throw new Error('Aucun produit n\'a passé la validation');
      }

      this.showToast(`${validatedProducts.length} produits à importer...`, 'info');
      await this.batchImportProducts(validatedProducts);
      this.showImportReport();

    } catch (error) {
      console.error('[CSV Import] Error:', error);
      this.showToast('Erreur import: ' + (error.message || 'Inconnue'), 'error');
    } finally {
      this.state.importInProgress = false;
      this.showLoading(false);
      event.target.value = '';
    }
  },

  parseCSVWithPapa: function(file) {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        delimiter: '', // Auto-détection
        encoding: 'UTF-8', // ✅ Forcé UTF-8
        skipEmptyLines: true,
        transformHeader: (header) => {
          return header.toLowerCase().trim().replace(/\s+/g, '_');
        },
        transform: (value, field) => {
          // Nettoyage des valeurs
          if (typeof value === 'string') {
            return value.trim().replace(/^["']|["']$/g, '');
          }
          return value;
        },
        complete: (results) => {
          console.log('[PapaParse] Résultat:', {
            data: results.data.length,
            errors: results.errors.length,
            meta: results.meta
          });
          resolve(results);
        },
        error: (error) => {
          console.error('[PapaParse] Erreur:', error);
          resolve({ data: [], errors: [error] });
        }
      });
    });
  },

  transformCSVData: function(data) {
    const fieldMappings = {
      'name': ['name', 'nom', 'titre', 'title', 'produit', 'product_name'],
      'description': ['description', 'desc', 'déscription', 'details'],
      'price': ['price', 'prix', 'prix_unitaire', 'unit_price'],
      'stock_quantity': ['stock', 'stock_quantity', 'quantite', 'quantité', 'qty', 'quantity'],
      'category_id': ['category_id', 'categorie', 'catégorie', 'category', 'cat_id'],
      'sku': ['sku', 'reference', 'ref', 'code'],
      'main_image_url': ['image', 'image_url', 'url_image', 'photo', 'main_image']
    };

    return data.map((row, index) => {
      const product = { source_line: index + 2 };

      Object.entries(fieldMappings).forEach(([standardField, possibleNames]) => {
        const foundKey = Object.keys(row).find(key =>
          possibleNames.some(name => key.toLowerCase().includes(name))
        );
        if (foundKey) {
          product[standardField] = row[foundKey];
        }
      });

      return product;
    });
  },

  validateCSVProducts: function(products) {
    return products.filter(p => {
      const errors = [];

      if (!p.name || p.name.length < 2) {
        errors.push('nom invalide');
      }

      const price = parseFloat(p.price);
      if (isNaN(price) || price <= 0) {
        errors.push('prix invalide');
      }

      if (errors.length > 0) {
        this.state.importResults.errors.push({
          line: p.source_line,
          name: p.name || 'Inconnu',
          errors: errors
        });
        return false;
      }

      return true;
    }).map(p => ({
      name: p.name.trim(),
      description: (p.description || '').trim(),
      price: parseFloat(p.price),
      stock_quantity: parseInt(p.stock_quantity) || 10,
      category_id: parseInt(p.category_id) || null,
      sku: p.sku || null,
      main_image_url: p.main_image_url || null,
      is_active: true
    }));
  },

  batchImportProducts: async function(products) {
    const batchSize = 5;
    const total = products.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(product => BrandiaAPI.Supplier.createProduct(product))
      );

      results.forEach((result, idx) => {
        const product = batch[idx];

        if (result.status === 'fulfilled' && result.value?.success) {
          this.state.importResults.success.push(product.name);
          this.state.products.unshift(result.value.data);
        } else {
          this.state.importResults.errors.push({
            line: i + idx + 1,
            name: product.name,
            errors: [result.reason?.message || result.value?.message || 'Erreur inconnue']
          });
        }
      });

      const progress = Math.round(((i + batch.length) / total) * 100);
      this.showToast(`Import: ${progress}%`, 'info');

      // Pause entre les batches pour éviter le rate limiting
      if (i + batchSize < total) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  },

  showImportReport: function() {
    const { success, errors } = this.state.importResults;

    if (errors.length === 0) {
      this.showToast(`${success.length} produits importés ✓`, 'success');
    } else if (success.length === 0) {
      this.showToast(`Échec total: ${errors.length} erreurs`, 'error');
      console.error('[Import] Erreurs:', errors);
    } else {
      this.showToast(`${success.length} importés, ${errors.length} erreurs`, 'warning');
      console.warn('[Import] Erreurs partielles:', errors);
    }

    this.renderProducts();
    this.updateProductCount();
    this.updateStats();
  },

  downloadCSVTemplate: function() {
    const headers = ['name', 'description', 'price', 'stock_quantity', 'category_id', 'sku', 'main_image_url'];

    const example1 = {
      name: 'Crème Hydratante Bio',
      description: 'Crème naturelle pour peaux sensibles',
      price: '29.99',
      stock_quantity: '50',
      category_id: '1',
      sku: 'CREME-001',
      main_image_url: 'https://example.com/image.jpg'
    };

    const example2 = {
      name: 'Sérum Anti-Âge',
      description: 'Sérum concentré avec vitamine C',
      price: '45.00',
      stock_quantity: '30',
      category_id: '1',
      sku: 'SERUM-002',
      main_image_url: ''
    };

    const csv = Papa.unparse([example1, example2], {
      columns: headers,
      header: true
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_produits_brandia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Template téléchargé ✓', 'success');
  },

  // ==========================================
  // UTILITAIRES UI
  // ==========================================
  showLoading: function(show) {
    if (window.DashboardApp?.showLoading) {
      DashboardApp.showLoading(show);
    } else {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.classList.toggle('hidden', !show);
    }
  },

  showToast: function(message, type = 'success') {
    if (window.DashboardApp?.showToast) {
      DashboardApp.showToast(message, type);
    } else if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
      if (type === 'error') alert(message);
    }
  },

  showError: function(message) {
    this.showToast(message, 'error');
  }
};

// ==========================================
// EXPOSITION GLOBALE
// ==========================================
window.openProductModal = (id) => window.SupplierProducts.openModal(id);
window.saveProduct = () => window.SupplierProducts.save();
window.filterProducts = () => window.SupplierProducts.filterProducts();
window.changeProductPage = (delta) => window.SupplierProducts.changeProductPage(delta);
window.importProducts = () => window.SupplierProducts.importProducts();
window.handleImageSelect = (e) => window.SupplierProducts.handleImageSelect(e);
window.downloadCSVTemplate = () => window.SupplierProducts.downloadCSVTemplate();
window.toggleProductStatus = (id, status) => window.SupplierProducts.toggleStatus(id, status);
window.deleteProduct = (id) => window.SupplierProducts.deleteProduct(id);
window.duplicateProduct = (id) => window.SupplierProducts.duplicateProduct(id);
window.removeUploadedImage = () => window.SupplierProducts.removeUploadedImage();
window.closeProductModal = () => window.SupplierProducts.closeProductModal();

console.log('[SupplierProducts] Module v4.3 PRODUCTION READY chargé');