// ============================================
// SUPPLIER PRODUCTS MODULE - Complet v3.0
// ============================================

window.SupplierProducts = {
  state: {
    products: [],
    categories: [],
    currentPage: 1,
    itemsPerPage: 12,
    editingId: null,
    filters: {
      search: '',
      status: '',
      category: ''
    },
    importInProgress: false,
    uploadedImage: null
  },

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
    console.log('[Products] Initialisation...');
    this.loadCategories();
    await this.loadProducts();
    this.setupEventListeners();
  },

  setupEventListeners: function() {
    // Recherche en temps réel
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.filters.search = e.target.value.toLowerCase();
        this.state.currentPage = 1;
        this.renderProducts();
      });
    }
  },

  // ==========================================
  // CHARGEMENT DES DONNÉES
  // ==========================================
  loadProducts: async function() {
    try {
      console.log('[Products] Chargement...');
      const response = await BrandiaAPI.Supplier.getProducts();

      if (response.success) {
        this.state.products = response.data || [];
        this.renderProducts();
        this.updateProductCount();
        console.log('[Products] Chargés:', this.state.products.length);
      } else {
        console.error('[Products] Erreur API:', response.message);
        this.showError('Erreur chargement produits');
      }
    } catch (error) {
      console.error('[Products] Erreur:', error);
      this.showError('Erreur chargement produits');
    }
  },

  loadCategories: function() {
    this.state.categories = this.BRANDIA_CATEGORIES;

    const filter = document.getElementById('product-category-filter');
    const select = document.getElementById('product-category-select');

    if (filter) {
      filter.innerHTML = '<option value="">Toutes les catégories</option>' +
        this.state.categories
          .map(c => `<option value="${c.id}">${c.name}</option>`)
          .join('');
    }

    if (select) {
      select.innerHTML = '<option value="">Choisir...</option>' +
        this.state.categories
          .map(c => `<option value="${c.id}">${c.name}</option>`)
          .join('');
    }
  },

  // ==========================================
  // RENDU DES PRODUITS (CRITIQUE - MANQUANT)
  // ==========================================
  renderProducts: function() {
    const container = document.getElementById('products-grid');
    if (!container) {
      console.error('[Products] Container #products-grid non trouvé');
      return;
    }

    // Filtrer les produits
    let filtered = this.state.products.filter(p => {
      const matchSearch = !this.state.filters.search || 
        (p.name && p.name.toLowerCase().includes(this.state.filters.search)) ||
        (p.description && p.description.toLowerCase().includes(this.state.filters.search));
      
      const matchCategory = !this.state.filters.category || 
        p.category_id == this.state.filters.category;
      
      const matchStatus = !this.state.filters.status || 
        (this.state.filters.status === 'published' && p.is_active !== false) ||
        (this.state.filters.status === 'draft' && p.is_active === false);

      return matchSearch && matchCategory && matchStatus;
    });

    // Pagination
    const totalPages = Math.ceil(filtered.length / this.state.itemsPerPage) || 1;
    const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
    const paginated = filtered.slice(start, start + this.state.itemsPerPage);

    // Rendu
    if (paginated.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-500">
          <i class="fas fa-box-open text-4xl mb-4 opacity-50"></i>
          <p class="text-lg font-medium">Aucun produit trouvé</p>
          <p class="text-sm mt-2">Commencez par créer votre premier produit</p>
          <button onclick="SupplierProducts.openModal()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white">
            <i class="fas fa-plus mr-2"></i>Ajouter un produit
          </button>
        </div>
      `;
    } else {
      container.innerHTML = paginated.map(p => this.renderProductCard(p)).join('');
    }

    // Pagination
    this.renderPagination(totalPages, filtered.length);
  },

  renderProductCard: function(p) {
    const category = this.state.categories.find(c => c.id === p.category_id);
    const isActive = p.is_active !== false;
    const stock = parseInt(p.stock_quantity) || 0;
    const stockClass = stock === 0 ? 'text-red-400' : stock < 5 ? 'text-amber-400' : 'text-emerald-400';
    const stockIcon = stock === 0 ? 'fa-times-circle' : stock < 5 ? 'fa-exclamation-circle' : 'fa-check-circle';

    return `
      <div class="card rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all">
        <div class="relative aspect-square bg-slate-800 overflow-hidden">
          <img src="${p.main_image_url || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'}" 
               alt="${p.name}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
               onerror="this.src='https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'">
          
          <div class="absolute top-2 right-2 flex gap-2">
            <button onclick="SupplierProducts.toggleStatus(${p.id})" 
                    class="w-8 h-8 rounded-full ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'} 
                           flex items-center justify-center hover:scale-110 transition-transform"
                    title="${isActive ? 'Actif' : 'Inactif'}">
              <i class="fas ${isActive ? 'fa-eye' : 'fa-eye-slash'} text-xs"></i>
            </button>
          </div>

          ${!isActive ? '<div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center"><span class="px-3 py-1 bg-slate-800 rounded-full text-xs font-medium">Inactif</span></div>' : ''}
        </div>

        <div class="p-4">
          <div class="flex items-start justify-between mb-2">
            <div>
              <span class="text-xs text-indigo-400 font-medium">${category?.name || 'Sans catégorie'}</span>
              <h3 class="font-semibold text-white mt-1 line-clamp-2">${p.name}</h3>
            </div>
          </div>

          <p class="text-slate-400 text-sm line-clamp-2 mb-3 h-10">${p.description || 'Aucune description'}</p>

          <div class="flex items-center justify-between mb-4">
            <span class="text-xl font-bold text-white">${parseFloat(p.price).toFixed(2)} €</span>
            <span class="text-xs ${stockClass} flex items-center gap-1">
              <i class="fas ${stockIcon}"></i>
              ${stock} en stock
            </span>
          </div>

          <div class="flex gap-2">
            <button onclick="SupplierProducts.openModal(${p.id})" 
                    class="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors">
              <i class="fas fa-edit mr-1"></i> Modifier
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
      pageInfo.textContent = `Page ${this.state.currentPage} sur ${totalPages} (${totalItems} produits)`;
    }

    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) prevBtn.disabled = this.state.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.state.currentPage >= totalPages;
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
        
        // 🔥 CORRECTION : Ne pas inclure stock dans la mise à jour
        // Envoyer UNIQUEMENT is_active
        await BrandiaAPI.Supplier.updateProduct(productId, {
            is_active: newStatus
        });

        // Mettre à jour localement
        const product = this.state.products.find(p => p.id === productId);
        if (product) {
            product.is_active = newStatus;
        }

        this.renderList();
        this.showToast(newStatus ? 'Produit activé' : 'Produit désactivé', 'success');

    } catch (error) {
        console.error('Toggle status error:', error);
        this.showToast('Erreur: ' + error.message, 'error');
        
        // Re-render pour remettre le toggle dans son état original
        this.renderList();
    }
},

  deleteProduct: async function(productId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    try {
      await BrandiaAPI.Supplier.deleteProduct(productId);
      this.state.products = this.state.products.filter(p => p.id !== productId);
      this.renderProducts();
      this.updateProductCount();
      this.showToast('Produit supprimé', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      this.showToast('Erreur lors de la suppression', 'error');
    }
  },

  updateProductCount: function() {
    const badge = document.getElementById('product-count');
    if (badge) {
      badge.textContent = this.state.products.length;
      badge.classList.remove('hidden');
    }
  },

  // ==========================================
  // MODAL (CREATE / EDIT)
  // ==========================================
  openModal: function(productId = null) {
    this.state.editingId = productId;
    this.state.uploadedImage = null;

    const title = document.getElementById('product-modal-title');
    const previewContainer = document.getElementById('image-preview-container');

    if (previewContainer) previewContainer.classList.add('hidden');

    if (productId) {
      const product = this.state.products.find(p => p.id === productId);
      if (!product) return;

      title.textContent = 'Modifier le produit';
      document.getElementById('product-name').value = product.name || '';
      document.getElementById('product-description').value = product.description || '';
      document.getElementById('product-price').value = product.price || '';
      document.getElementById('product-stock').value = product.stock_quantity || 10;
      document.getElementById('product-category-select').value = product.category_id || '';

      if (product.main_image_url) {
        const preview = document.getElementById('image-preview');
        preview.src = product.main_image_url;
        previewContainer.classList.remove('hidden');
        this.state.uploadedImage = { url: product.main_image_url };
      }
    } else {
      title.textContent = 'Ajouter un produit';
      document.getElementById('product-form')?.reset();
      document.getElementById('product-stock').value = '10';
      document.getElementById('product-description').value = '';
    }

    window.DashboardApp?.openModal('product-modal');
  },

  // ==========================================
  // SAUVEGARDE
  // ==========================================
  save: async function() {
    const data = {
      name: document.getElementById('product-name')?.value?.trim(),
      description: document.getElementById('product-description')?.value?.trim() || '',
      price: parseFloat(document.getElementById('product-price')?.value),
      stock_quantity: parseInt(document.getElementById('product-stock')?.value) || 0,
      category_id: parseInt(document.getElementById('product-category-select')?.value) || null,
      main_image_url: this.state.uploadedImage?.url || null,
      is_active: true
    };

    // Validation
    if (!data.name || data.name.length < 2) {
      return alert('Le nom du produit doit contenir au moins 2 caractères');
    }

    if (isNaN(data.price) || data.price <= 0) {
      return alert('Veuillez saisir un prix valide');
    }

    if (data.stock_quantity < 0) {
      return alert('Le stock ne peut pas être négatif');
    }

    try {
      window.DashboardApp?.showLoading(true);

      if (this.state.editingId) {
        await BrandiaAPI.Supplier.updateProduct(this.state.editingId, data);
        this.showToast('Produit mis à jour', 'success');
      } else {
        await BrandiaAPI.Supplier.createProduct(data);
        this.showToast('Produit créé avec succès', 'success');
      }

      window.DashboardApp?.closeModal('product-modal');
      await this.loadProducts();
    } catch (error) {
      console.error('Save error:', error);
      alert(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      window.DashboardApp?.showLoading(false);
    }
  },

  // ==========================================
  // UPLOAD IMAGE
  // ==========================================
  handleImageSelect: async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return alert('L\'image ne doit pas dépasser 5MB');
    }

    try {
      window.DashboardApp?.showLoading(true);
      
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${BrandiaAPI.config.apiURL}/supplier/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        this.state.uploadedImage = { url: result.data.url };
        const preview = document.getElementById('image-preview');
        const container = document.getElementById('image-preview-container');
        
        preview.src = result.data.url;
        container.classList.remove('hidden');
        
        this.showToast('Image uploadée', 'success');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showToast('Erreur upload image', 'error');
    } finally {
      window.DashboardApp?.showLoading(false);
    }
  },

  // ==========================================
  // IMPORT CSV
  // ==========================================
  importProducts: function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => this.handleCSVImport(e);
    input.click();
  },

  handleCSVImport: async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (this.state.importInProgress) return;
    this.state.importInProgress = true;

    try {
      window.DashboardApp?.showLoading(true);
      
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        throw new Error('Fichier CSV vide ou invalide');
      }

      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      const required = ['name', 'price'];
      const missing = required.filter(r => !headers.includes(r));
      
      if (missing.length > 0) {
        throw new Error(`Colonnes manquantes: ${missing.join(', ')}`);
      }

      const products = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        const product = {};
        
        headers.forEach((h, idx) => {
          product[h] = values[idx]?.trim();
        });

        products.push({
          name: product.name,
          description: product.description || '',
          price: parseFloat(product.price) || 0,
          stock_quantity: parseInt(product.stock) || 10,
          category_id: parseInt(product.category_id) || null,
          is_active: true
        });
      }

      let success = 0;
      for (const p of products) {
        try {
          await BrandiaAPI.Supplier.createProduct(p);
          success++;
        } catch (e) {
          console.error('Import error for', p.name, e);
        }
      }

      this.showToast(`${success}/${products.length} produits importés`, success === products.length ? 'success' : 'warning');
      await this.loadProducts();
      
    } catch (error) {
      console.error('CSV import error:', error);
      this.showToast(error.message, 'error');
    } finally {
      this.state.importInProgress = false;
      window.DashboardApp?.showLoading(false);
    }
  },

  downloadCSVTemplate: function() {
    const template = 'name;description;price;stock;category_id\n' +
                     'Produit Exemple;Description du produit;29.99;10;1\n' +
                     'Second Produit;Une autre description;49.99;5;2';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_produits.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  // ==========================================
  // UTILITAIRES
  // ==========================================
  showToast: function(message, type = 'success') {
    if (window.DashboardApp?.showToast) {
      window.DashboardApp.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  },

  showError: function(message) {
    const container = document.getElementById('products-grid');
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-red-400">
          <i class="fas fa-exclamation-circle text-4xl mb-4"></i>
          <p>${message}</p>
          <button onclick="SupplierProducts.loadProducts()" class="mt-4 px-4 py-2 bg-indigo-600 rounded-lg text-white">
            Réessayer
          </button>
        </div>
      `;
    }
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