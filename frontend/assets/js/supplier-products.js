// ============================================
// SUPPLIER PRODUCTS MODULE
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
    }
  },

  init: async () => {
    await SupplierProducts.loadCategories();
    await SupplierProducts.loadProducts();
  },

  loadCategories: async () => {
    try {
      const response = await BrandiaAPI.Categories.getAll();
      SupplierProducts.state.categories = response.data || [];
      
      // Remplir le select du filtre
      const select = document.getElementById('product-category-filter');
      if (select) {
        select.innerHTML = '<option value="">Toutes les catégories</option>' +
          SupplierProducts.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
      
      // Remplir le select du modal
      const modalSelect = document.getElementById('product-category-select');
      if (modalSelect) {
        modalSelect.innerHTML = '<option value="">Choisir une catégorie...</option>' +
          SupplierProducts.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
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
          <img src="${p.main_image_url || p.image || 'https://via.placeholder.com/400x400?text=Produit'}" 
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

    // Mettre à jour le compteur dans la sidebar
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

  openModal: (productId = null) => {
    SupplierProducts.state.editingId = productId;
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    
    if (!modal) return;

    if (productId) {
      const product = SupplierProducts.state.products.find(p => p.id === productId);
      if (!product) return;
      
      title.textContent = 'Modifier le produit';
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-stock').value = product.stock_quantity;
      document.getElementById('product-category-select').value = product.category_id || '';
      document.getElementById('product-description').value = product.description || '';
    } else {
      title.textContent = 'Ajouter un produit';
      form?.reset();
    }
    
    DashboardApp.openModal('product-modal');
  },

  save: async () => {
    const data = {
      name: document.getElementById('product-name')?.value,
      price: parseFloat(document.getElementById('product-price')?.value),
      stock_quantity: parseInt(document.getElementById('product-stock')?.value),
      category_id: document.getElementById('product-category-select')?.value,
      description: document.getElementById('product-description')?.value
    };

    if (!data.name || !data.price) {
      DashboardApp.showToast('Veuillez remplir tous les champs obligatoires', 'error');
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
      DashboardApp.showToast(error.message || 'Erreur lors de l\'enregistrement', 'error');
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
    DashboardApp.showToast('Import CSV en cours de développement', 'info');
  }
};

// Raccourcis globaux pour les onclick inline
window.openProductModal = (id) => SupplierProducts.openModal(id);
window.importProducts = () => SupplierProducts.import();
window.filterProducts = () => SupplierProducts.filter();
window.changeProductPage = (delta) => SupplierProducts.changePage(delta);