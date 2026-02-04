// ============================================
// SUPPLIER PRODUCTS MODULE - Avec Upload Cloudinary
// ============================================

window.SupplierProducts = {
  state: {
    products: [],
    categories: [],
    currentPage: 1,
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
    { id: 1, slug: 'cosmetiques-soins-peau', name: 'Cosmétiques & soins de la peau', icon: 'fa-spa', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600' },
    { id: 2, slug: 'parfums-fragrances', name: 'Parfums & fragrances', icon: 'fa-spray-can', gradient: 'bg-gradient-to-br from-purple-500 to-indigo-600' },
    { id: 3, slug: 'maquillage', name: 'Maquillage', icon: 'fa-magic', gradient: 'bg-gradient-to-br from-red-500 to-pink-600' },
    { id: 4, slug: 'soins-capillaires', name: 'Soins capillaires', icon: 'fa-cut', gradient: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { id: 5, slug: 'complements-bien-etre', name: 'Compléments bien-être', icon: 'fa-heart', gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
    { id: 6, slug: 'mode-accessoires', name: 'Mode & accessoires', icon: 'fa-tshirt', gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
    { id: 7, slug: 'montres-bijoux', name: 'Montres & bijoux', icon: 'fa-gem', gradient: 'bg-gradient-to-br from-yellow-500 to-amber-600' },
    { id: 8, slug: 'sport-fitness', name: 'Articles de sport', icon: 'fa-dumbbell', gradient: 'bg-gradient-to-br from-orange-500 to-red-600' },
    { id: 9, slug: 'nutrition-sportive', name: 'Nutrition sportive', icon: 'fa-apple-alt', gradient: 'bg-gradient-to-br from-green-500 to-emerald-600' },
    { id: 10, slug: 'high-tech-mobile', name: 'High-tech & mobile', icon: 'fa-mobile-alt', gradient: 'bg-gradient-to-br from-indigo-500 to-blue-600' },
    { id: 11, slug: 'electronique-lifestyle', name: 'Électronique', icon: 'fa-headphones', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
    { id: 12, slug: 'maison-decoration', name: 'Maison & décoration', icon: 'fa-home', gradient: 'bg-gradient-to-br from-orange-500 to-red-500' },
    { id: 13, slug: 'parfumerie-interieur', name: 'Parfumerie intérieur', icon: 'fa-fire', gradient: 'bg-gradient-to-br from-rose-400 to-pink-500' },
    { id: 14, slug: 'produits-ecologiques', name: 'Produits écologiques', icon: 'fa-leaf', gradient: 'bg-gradient-to-br from-green-400 to-emerald-500' },
    { id: 15, slug: 'bebe-maternite', name: 'Bébé & maternité', icon: 'fa-baby', gradient: 'bg-gradient-to-br from-sky-400 to-blue-500' },
    { id: 16, slug: 'animaux-pets', name: 'Animaux', icon: 'fa-paw', gradient: 'bg-gradient-to-br from-amber-600 to-yellow-600' },
    { id: 17, slug: 'sante-hygiene', name: 'Santé & hygiène', icon: 'fa-heartbeat', gradient: 'bg-gradient-to-br from-red-400 to-rose-500' },
    { id: 18, slug: 'bagagerie-voyage', name: 'Bagagerie & voyage', icon: 'fa-suitcase', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
    { id: 19, slug: 'papeterie-lifestyle', name: 'Papeterie', icon: 'fa-pen-fancy', gradient: 'bg-gradient-to-br from-teal-400 to-cyan-500' },
    { id: 20, slug: 'artisanat-local', name: 'Artisanat local', icon: 'fa-hands', gradient: 'bg-gradient-to-br from-orange-400 to-amber-500' },
    { id: 21, slug: 'sport-loisirs', name: 'Sport & loisirs', icon: 'fa-bicycle', gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600' }
  ],

  init: async () => {
    SupplierProducts.loadCategories();
    await SupplierProducts.loadProducts();
  },

  loadCategories: function() {
    SupplierProducts.state.categories = SupplierProducts.BRANDIA_CATEGORIES;
    
    const filterSelect = document.getElementById('product-category-filter');
    const modalSelect = document.getElementById('product-category-select');
    
    const optionsHtml = '<option value="">Choisir...</option>' +
      SupplierProducts.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Toutes les catégories</option>' + 
        SupplierProducts.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    if (modalSelect) {
      modalSelect.innerHTML = optionsHtml;
    }
  },

  loadProducts: async () => {
    try {
      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.getProducts({
        page: SupplierProducts.state.currentPage,
        search: SupplierProducts.state.filters.search,
        status: SupplierProducts.state.filters.status,
        category: SupplierProducts.state.filters.category
      });
      
      SupplierProducts.state.products = response.data?.products || [];
      SupplierProducts.renderProducts();
      SupplierProducts.updatePagination(response.data?.total || 0);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      DashboardApp.showToast('Erreur de chargement des produits', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  renderProducts: () => {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (SupplierProducts.state.products.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-500">
          <i class="fas fa-box-open text-4xl mb-4 opacity-50"></i>
          <p class="text-lg">Aucun produit trouvé</p>
          <button onclick="SupplierProducts.openModal()" class="btn-primary px-6 py-3 rounded-lg mt-4 text-sm">
            <i class="fas fa-plus mr-2"></i>Ajouter votre premier produit
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = SupplierProducts.state.products.map(p => `
      <div class="card rounded-xl overflow-hidden group hover:shadow-xl transition-all">
        <div class="relative h-48 bg-slate-800 overflow-hidden">
          <img src="${p.main_image_url || 'https://via.placeholder.com/400x400?text=Produit'}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
               alt="${p.name}"
               onerror="this.src='https://via.placeholder.com/400x400?text=Produit'">
          <div class="absolute top-2 right-2">
            <span class="badge badge-${p.is_active ? 'published' : 'draft'} text-xs">
              ${p.is_active ? 'Actif' : 'Brouillon'}
            </span>
          </div>
          ${p.stock_quantity < 5 ? `
            <div class="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
              Stock faible
            </div>
          ` : ''}
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-semibold text-white truncate pr-2">${p.name}</h4>
              <p class="text-slate-400 text-xs">${p.category_name || 'Sans catégorie'}</p>
            </div>
            <p class="text-indigo-400 font-bold">${DashboardApp.formatPrice(p.price)}</p>
          </div>
          
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
            <div class="text-xs text-slate-400">
              <i class="fas fa-box mr-1"></i>Stock: ${p.stock_quantity || 0}
            </div>
            <div class="flex gap-2">
              <button onclick="SupplierProducts.edit(${p.id})" class="w-8 h-8 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="Modifier">
                <i class="fas fa-edit text-xs"></i>
              </button>
              <button onclick="SupplierProducts.toggleStatus(${p.id}, ${!p.is_active})" class="w-8 h-8 ${p.is_active ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600'} hover:text-white rounded-lg transition-colors flex items-center justify-center" title="${p.is_active ? 'Désactiver' : 'Activer'}">
                <i class="fas ${p.is_active ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
              </button>
              <button onclick="SupplierProducts.delete(${p.id})" class="w-8 h-8 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="Supprimer">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    const count = SupplierProducts.state.products.length;
    const badge = document.getElementById('product-count');
    if (badge) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    }
  },

  updatePagination: (total) => {
    const totalPages = Math.ceil(total / 12);
    const pagination = document.getElementById('products-pagination');
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (totalPages <= 1) {
      if (pagination) pagination.classList.add('hidden');
      return;
    }

    if (pagination) pagination.classList.remove('hidden');
    if (pageInfo) pageInfo.textContent = `Page ${SupplierProducts.state.currentPage} sur ${totalPages}`;
    if (prevBtn) prevBtn.disabled = SupplierProducts.state.currentPage === 1;
    if (nextBtn) nextBtn.disabled = SupplierProducts.state.currentPage >= totalPages;
  },

  changePage: (delta) => {
    SupplierProducts.state.currentPage += delta;
    if (SupplierProducts.state.currentPage < 1) SupplierProducts.state.currentPage = 1;
    SupplierProducts.loadProducts();
  },

  filter: () => {
    SupplierProducts.state.filters.search = document.getElementById('product-search')?.value || '';
    SupplierProducts.state.filters.status = document.getElementById('product-status-filter')?.value || '';
    SupplierProducts.state.filters.category = document.getElementById('product-category-filter')?.value || '';
    SupplierProducts.state.currentPage = 1;
    SupplierProducts.loadProducts();
  },

  uploadImage: async (file) => {
    try {
      DashboardApp.showLoading(true);
      
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${BrandiaAPI.config.apiURL}/supplier/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BrandiaAPI.storage.getToken()}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      SupplierProducts.state.uploadedImage = result.data;
      
      const preview = document.getElementById('image-preview');
      const previewContainer = document.getElementById('image-preview-container');
      if (preview && previewContainer) {
        preview.src = result.data.url;
        previewContainer.classList.remove('hidden');
      }

      DashboardApp.showToast('Image uploadée avec succès', 'success');
      return result.data;

    } catch (error) {
      console.error('Upload error:', error);
      DashboardApp.showToast('Erreur upload image: ' + error.message, 'error');
      return null;
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  handleImageSelect: (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      DashboardApp.showToast('Image trop volumineuse (max 5MB)', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      DashboardApp.showToast('Seules les images sont acceptées', 'error');
      return;
    }

    SupplierProducts.uploadImage(file);
  },

  openModal: (productId = null) => {
    SupplierProducts.state.editingId = productId;
    SupplierProducts.state.uploadedImage = null;
    
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    
    if (!modal) return;

    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');

    if (SupplierProducts.state.categories.length === 0) {
      SupplierProducts.loadCategories();
    }

    if (productId) {
      const product = SupplierProducts.state.products.find(p => p.id === productId);
      if (!product) return;
      
      title.textContent = 'Modifier le produit';
      document.getElementById('product-name').value = product.name || '';
      document.getElementById('product-price').value = product.price || '';
      document.getElementById('product-stock').value = product.stock_quantity || '';
      document.getElementById('product-category-select').value = product.category_id || '';
      
      if (product.main_image_url) {
        const preview = document.getElementById('image-preview');
        if (preview && previewContainer) {
          preview.src = product.main_image_url;
          previewContainer.classList.remove('hidden');
          SupplierProducts.state.uploadedImage = { url: product.main_image_url };
        }
      }
    } else {
      title.textContent = 'Ajouter un produit';
      document.getElementById('product-form')?.reset();
    }
    
    DashboardApp.openModal('product-modal');
  },

  save: async () => {
    const data = {
      name: document.getElementById('product-name')?.value,
      price: parseFloat(document.getElementById('product-price')?.value),
      stock_quantity: parseInt(document.getElementById('product-stock')?.value) || 0,
      category_id: document.getElementById('product-category-select')?.value || null,
      main_image_url: SupplierProducts.state.uploadedImage?.url || null
    };

    if (!data.name || !data.price) {
      alert('Veuillez remplir le nom et le prix du produit');
      return;
    }

    try {
      DashboardApp.showLoading(true);
      if (SupplierProducts.state.editingId) {
        await BrandiaAPI.Supplier.updateProduct(SupplierProducts.state.editingId, data);
        DashboardApp.showToast('Produit mis à jour', 'success');
      } else {
        await BrandiaAPI.Supplier.createProduct(data);
        DashboardApp.showToast('Produit créé avec succès', 'success');
      }
      DashboardApp.closeModal('product-modal');
      SupplierProducts.loadProducts();
    } catch (error) {
      alert('Erreur: ' + (error.message || 'Erreur lors de l\'enregistrement'));
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  edit: (id) => {
    SupplierProducts.openModal(id);
  },

  toggleStatus: async (id, newStatus) => {
    try {
      await BrandiaAPI.Supplier.updateProduct(id, { is_active: newStatus });
      DashboardApp.showToast(newStatus ? 'Produit activé' : 'Produit désactivé', 'success');
      SupplierProducts.loadProducts();
    } catch (error) {
      DashboardApp.showToast('Erreur', 'error');
    }
  },

  delete: async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    
    try {
      await BrandiaAPI.Supplier.deleteProduct(id);
      DashboardApp.showToast('Produit supprimé', 'success');
      SupplierProducts.loadProducts();
    } catch (error) {
      DashboardApp.showToast('Erreur de suppression', 'error');
    }
  },

  import: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 2 * 1024 * 1024) {
        DashboardApp.showToast('Fichier trop volumineux (max 2MB)', 'error');
        return;
      }
      
      SupplierProducts.processCSV(file);
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  },

  processCSV: (file) => {
    if (SupplierProducts.state.importInProgress) {
      DashboardApp.showToast('Import déjà en cours...', 'warning');
      return;
    }

    SupplierProducts.state.importInProgress = true;
    DashboardApp.showLoading(true);
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
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
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(';');
          const product = {};
          
          headers.forEach((h, idx) => {
            product[h] = values[idx]?.trim() || '';
          });

          if (!product.name) {
            errors.push(`Ligne ${i + 1}: nom manquant`);
            continue;
          }
          
          const price = parseFloat(product.price);
          if (isNaN(price) || price <= 0) {
            errors.push(`Ligne ${i + 1}: prix invalide`);
            continue;
          }

          products.push({
            name: product.name,
            price: price,
            stock_quantity: parseInt(product.stock_quantity) || 0,
            category_id: product.category_id || null,
            description: product.description || ''
          });
        }

        if (products.length === 0) {
          throw new Error('Aucun produit valide trouvé dans le CSV');
        }

        const confirmMsg = `Importer ${products.length} produits ?${errors.length > 0 ? `\n(${errors.length} erreurs ignorées)` : ''}`;
        if (!confirm(confirmMsg)) {
          SupplierProducts.state.importInProgress = false;
          DashboardApp.showLoading(false);
          return;
        }

        let success = 0;
        let failed = 0;

        for (const product of products) {
          try {
            await BrandiaAPI.Supplier.createProduct(product);
            success++;
          } catch (err) {
            console.error('Import error:', err);
            failed++;
          }
        }

        DashboardApp.showToast(`${success} produits importés${failed > 0 ? `, ${failed} échoués` : ''}`, success > 0 ? 'success' : 'error');
        
        if (success > 0) {
          SupplierProducts.loadProducts();
        }

      } catch (error) {
        DashboardApp.showToast(error.message, 'error');
      } finally {
        SupplierProducts.state.importInProgress = false;
        DashboardApp.showLoading(false);
      }
    };

    reader.onerror = () => {
      DashboardApp.showToast('Erreur lecture fichier', 'error');
      SupplierProducts.state.importInProgress = false;
      DashboardApp.showLoading(false);
    };

    reader.readAsText(file);
  },

  downloadTemplate: () => {
    const csv = 'name;price;stock_quantity;category_id;description\nProduit exemple;29.99;10;1;Description du produit\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_produits_brandia.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
};

window.openProductModal = (id) => SupplierProducts.openModal(id);
window.importProducts = () => SupplierProducts.import();
window.filterProducts = () => SupplierProducts.filter();
window.changeProductPage = (delta) => SupplierProducts.changePage(delta);
window.downloadImportTemplate = () => SupplierProducts.downloadTemplate();
window.handleImageSelect = (event) => SupplierProducts.handleImageSelect(event);