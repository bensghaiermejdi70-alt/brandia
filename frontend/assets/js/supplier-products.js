// ============================================
// SUPPLIER PRODUCTS MODULE - v3.2 CORRIGÉ
// Correction: Gestion correcte de response.data.products
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
    console.log('[Products] Initialisation v3.2...');
    this.loadCategories();
    await this.loadProducts();
    this.setupEventListeners();
  },

  setupEventListeners: function() {
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
  // CHARGEMENT DES DONNÉES - CORRIGÉ
  // ==========================================
  loadProducts: async function() {
    try {
      console.log('[Products] Chargement...');
      const response = await BrandiaAPI.Supplier.getProducts();
      console.log('[Products] Réponse API:', response);

      if (response.success) {
        // 🔥 CORRECTION CRITIQUE : Gérer response.data.products OU response.data directement
        let productsArray = [];
        
        if (response.data && Array.isArray(response.data)) {
          // Si data est déjà un tableau (ancien format)
          productsArray = response.data;
        } else if (response.data && response.data.products && Array.isArray(response.data.products)) {
          // Si data contient products (nouveau format)
          productsArray = response.data.products;
        } else if (response.data && typeof response.data === 'object') {
          // Si data est un objet, essayer de trouver un tableau
          const possibleArrays = Object.values(response.data).filter(v => Array.isArray(v));
          if (possibleArrays.length > 0) {
            productsArray = possibleArrays[0];
          }
        }
        
        this.state.products = productsArray;
        console.log('[Products] Chargés:', this.state.products.length, 'produits');
        
        this.renderProducts();
        this.updateProductCount();
      } else {
        console.error('[Products] Erreur API:', response.message);
        this.showError('Erreur chargement produits: ' + (response.message || 'Inconnue'));
      }
    } catch (error) {
      console.error('[Products] Erreur:', error);
      this.showError('Erreur chargement produits: ' + error.message);
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
  // RENDU DES PRODUITS
  // ==========================================
  renderProducts: function() {
    const container = document.getElementById('products-grid');
    if (!container) {
      console.error('[Products] Container #products-grid non trouvé');
      return;
    }

    // Vérifier que products est bien un tableau
    if (!Array.isArray(this.state.products)) {
      console.error('[Products] state.products n\'est pas un tableau:', this.state.products);
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-red-400">
          <i class="fas fa-exclamation-circle text-4xl mb-4"></i>
          <p>Erreur de données produits</p>
          <button onclick="SupplierProducts.loadProducts()" class="mt-4 px-4 py-2 bg-indigo-600 rounded-lg text-white">
            Réessayer
          </button>
        </div>
      `;
      return;
    }

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

    const totalPages = Math.ceil(filtered.length / this.state.itemsPerPage) || 1;
    const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
    const paginated = filtered.slice(start, start + this.state.itemsPerPage);

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

    this.renderPagination(totalPages, filtered.length);
  },

  renderList: function() {
    this.renderProducts();
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
               alt="${p.name || 'Produit'}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
               onerror="this.src='https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'">
          
          <div class="absolute top-2 right-2 flex gap-2">
            <button onclick="SupplierProducts.toggleStatus(${p.id}, ${isActive})" 
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
              <h3 class="font-semibold text-white mt-1 line-clamp-2">${p.name || 'Sans nom'}</h3>
            </div>
          </div>

          <p class="text-slate-400 text-sm line-clamp-2 mb-3 h-10">${p.description || 'Aucune description'}</p>

          <div class="flex items-center justify-between mb-4">
            <span class="text-xl font-bold text-white">${parseFloat(p.price || 0).toFixed(2)} €</span>
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
      
      const updateData = { is_active: newStatus };
      
      const response = await BrandiaAPI.Supplier.updateProduct(productId, updateData);
      
      if (!response.success) {
        throw new Error(response.message || 'Erreur mise à jour');
      }

      const product = this.state.products.find(p => p.id === productId);
      if (product) {
        product.is_active = newStatus;
      }

      this.renderProducts();
      this.showToast(newStatus ? 'Produit activé' : 'Produit désactivé', 'success');

    } catch (error) {
      console.error('[Products] Toggle status error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
      this.renderProducts();
    }
  },

  deleteProduct: async function(productId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    try {
      const response = await BrandiaAPI.Supplier.deleteProduct(productId);
      
      if (!response.success) {
        throw new Error(response.message || 'Erreur suppression');
      }
      
      this.state.products = this.state.products.filter(p => p.id !== productId);
      this.renderProducts();
      this.updateProductCount();
      this.showToast('Produit supprimé', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      this.showToast('Erreur lors de la suppression: ' + error.message, 'error');
    }
  },

  updateProductCount: function() {
    const badge = document.getElementById('product-count');
    if (badge) {
      badge.textContent = this.state.products.length;
      badge.classList.toggle('hidden', this.state.products.length === 0);
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
      if (!product) {
        this.showToast('Produit non trouvé', 'error');
        return;
      }

      if (title) title.textContent = 'Modifier le produit';
      
      const nameInput = document.getElementById('product-name');
      const descInput = document.getElementById('product-description');
      const priceInput = document.getElementById('product-price');
      const stockInput = document.getElementById('product-stock');
      const catInput = document.getElementById('product-category-select');

      if (nameInput) nameInput.value = product.name || '';
      if (descInput) descInput.value = product.description || '';
      if (priceInput) priceInput.value = product.price || '';
      if (stockInput) stockInput.value = product.stock_quantity || 10;
      if (catInput) catInput.value = product.category_id || '';

      if (product.main_image_url) {
        const preview = document.getElementById('image-preview');
        if (preview) {
          preview.src = product.main_image_url;
          previewContainer.classList.remove('hidden');
          this.state.uploadedImage = { url: product.main_image_url };
        }
      }
    } else {
      if (title) title.textContent = 'Ajouter un produit';
      
      const form = document.getElementById('product-form');
      if (form) form.reset();
      
      const stockInput = document.getElementById('product-stock');
      const descInput = document.getElementById('product-description');
      if (stockInput) stockInput.value = '10';
      if (descInput) descInput.value = '';
    }

    if (window.DashboardApp && window.DashboardApp.openModal) {
      window.DashboardApp.openModal('product-modal');
    } else {
      const modal = document.getElementById('product-modal');
      if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    }
  },

  // ==========================================
  // SAUVEGARDE
  // ==========================================
  save: async function() {
    const nameInput = document.getElementById('product-name');
    const descInput = document.getElementById('product-description');
    const priceInput = document.getElementById('product-price');
    const stockInput = document.getElementById('product-stock');
    const catInput = document.getElementById('product-category-select');

    const data = {
      name: nameInput?.value?.trim(),
      description: descInput?.value?.trim() || '',
      price: parseFloat(priceInput?.value),
      stock_quantity: parseInt(stockInput?.value) || 0,
      category_id: parseInt(catInput?.value) || null,
      main_image_url: this.state.uploadedImage?.url || null,
      is_active: true
    };

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
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(true);
      }

      let response;
      if (this.state.editingId) {
        response = await BrandiaAPI.Supplier.updateProduct(this.state.editingId, data);
        if (response.success) {
          this.showToast('Produit mis à jour', 'success');
        } else {
          throw new Error(response.message || 'Erreur mise à jour');
        }
      } else {
        response = await BrandiaAPI.Supplier.createProduct(data);
        if (response.success) {
          this.showToast('Produit créé avec succès', 'success');
        } else {
          throw new Error(response.message || 'Erreur création');
        }
      }

      if (window.DashboardApp && window.DashboardApp.closeModal) {
        window.DashboardApp.closeModal('product-modal');
      } else {
        const modal = document.getElementById('product-modal');
        if (modal) {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      }
      
      await this.loadProducts();
    } catch (error) {
      console.error('Save error:', error);
      alert(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(false);
      }
    }
  },

  // ==========================================
  // UPLOAD IMAGE - CORRIGÉ
  // ==========================================
  handleImageSelect: async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return alert('L\'image ne doit pas dépasser 5MB');
    }

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      return alert('Veuillez sélectionner une image valide');
    }

    try {
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(true);
      }
      
      const formData = new FormData();
      formData.append('media', file);

      console.log('[Upload] Envoi vers:', BrandiaAPI.config.apiURL + '/supplier/upload-image');
      console.log('[Upload] Fichier:', file.name, file.type, file.size);

      const response = await fetch(BrandiaAPI.config.apiURL + '/supplier/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      console.log('[Upload] Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Upload] Server error:', errorText);
        throw new Error(`Erreur serveur ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[Upload] Résultat:', result);

      if (result.success) {
        // 🔥 CORRECTION : Gérer différents formats de réponse
        const imageUrl = result.data?.url || result.data?.secure_url || result.data || result.url;
        
        if (!imageUrl) {
          throw new Error('URL image non trouvée dans la réponse');
        }
        
        this.state.uploadedImage = { url: imageUrl };
        const preview = document.getElementById('image-preview');
        const container = document.getElementById('image-preview-container');
        
        if (preview) preview.src = imageUrl;
        if (container) container.classList.remove('hidden');
        
        this.showToast('Image uploadée avec succès', 'success');
      } else {
        throw new Error(result.message || 'Erreur upload');
      }
    } catch (error) {
      console.error('[Upload] Error:', error);
      this.showToast('Erreur upload image: ' + error.message, 'error');
    } finally {
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(false);
      }
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
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(true);
      }
      
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        throw new Error('Fichier CSV vide ou invalide');
      }

      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      
      const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
      const required = ['name', 'price'];
      const missing = required.filter(r => !headers.includes(r));
      
      if (missing.length > 0) {
        throw new Error(`Colonnes manquantes: ${missing.join(', ')}. Headers trouvés: ${headers.join(', ')}`);
      }

      const products = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator);
        const product = {};
        
        headers.forEach((h, idx) => {
          product[h] = values[idx]?.trim();
        });

        const stockValue = parseInt(product.stock) || parseInt(product.stock_quantity) || 10;

        products.push({
          name: product.name,
          description: product.description || '',
          price: parseFloat(product.price) || 0,
          stock_quantity: stockValue,
          category_id: parseInt(product.category_id) || null,
          is_active: true
        });
      }

      let success = 0;
      const errors = [];
      
      for (const p of products) {
        try {
          const response = await BrandiaAPI.Supplier.createProduct(p);
          if (response.success) {
            success++;
          } else {
            errors.push(`${p.name}: ${response.message}`);
          }
        } catch (e) {
          errors.push(`${p.name}: ${e.message}`);
          console.error('Import error for', p.name, e);
        }
      }

      const message = `${success}/${products.length} produits importés`;
      const type = success === products.length ? 'success' : (success > 0 ? 'warning' : 'error');
      
      if (errors.length > 0 && success < products.length) {
        console.error('[Import] Erreurs:', errors);
      }
      
      this.showToast(message, type);
      await this.loadProducts();
      
    } catch (error) {
      console.error('CSV import error:', error);
      this.showToast(error.message, 'error');
    } finally {
      this.state.importInProgress = false;
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(false);
      }
    }
  },

  downloadCSVTemplate: function() {
    const template = 'name;description;price;stock;category_id\n' +
                     'Produit Exemple;Description du produit;29.99;10;1\n' +
                     'Second Produit;Une autre description;49.99;5;2';
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_produits.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ==========================================
  // UTILITAIRES
  // ==========================================
  showToast: function(message, type = 'success') {
    if (window.DashboardApp && window.DashboardApp.showToast) {
      window.DashboardApp.showToast(message, type);
    } else if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
      alert(message);
    }
  },

  showError: function(message) {
    const container = document.getElementById('products-grid');
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-red-400">
          <i class="fas fa-exclamation-circle text-4xl mb-4"></i>
          <p>${message}</p>
          <button onclick="SupplierProducts.loadProducts()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
            <i class="fas fa-redo mr-2"></i>Réessayer
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
window.toggleProductStatus = (id, status) => window.SupplierProducts.toggleStatus(id, status);
window.deleteProduct = (id) => window.SupplierProducts.deleteProduct(id);

console.log('[SupplierProducts] Module v3.2 chargé avec succès');