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

  init: async () => {
    SupplierProducts.loadCategories();
    await SupplierProducts.loadProducts();
  },

  /* ===========================
     LOAD PRODUCTS ✅ AJOUTÉ
  =========================== */
  loadProducts: async function () {
    try {
      console.log('[Products] Chargement...');
      const response = await BrandiaAPI.Supplier.getProducts();

      if (response.success) {
        this.state.products = response.data || [];
        this.renderProducts();
        console.log('[Products] Chargés:', this.state.products.length);
      } else {
        console.error('[Products] Erreur API:', response.message);
        DashboardApp.showToast('Erreur chargement produits', 'error');
      }
    } catch (error) {
      console.error('[Products] Erreur:', error);
      DashboardApp.showToast('Erreur chargement produits', 'error');
    }
  },

  loadCategories() {
    SupplierProducts.state.categories = SupplierProducts.BRANDIA_CATEGORIES;

    const filter = document.getElementById('product-category-filter');
    const select = document.getElementById('product-category-select');

    if (filter) {
      filter.innerHTML =
        '<option value="">Toutes les catégories</option>' +
        SupplierProducts.state.categories
          .map(c => `<option value="${c.id}">${c.name}</option>`)
          .join('');
    }

    if (select) {
      select.innerHTML =
        '<option value="">Choisir...</option>' +
        SupplierProducts.state.categories
          .map(c => `<option value="${c.id}">${c.name}</option>`)
          .join('');
    }
  },

  /* ===========================
     MODAL (CREATE / EDIT)
  =========================== */
  openModal(productId = null) {
    SupplierProducts.state.editingId = productId;
    SupplierProducts.state.uploadedImage = null;

    const title = document.getElementById('product-modal-title');
    const previewContainer = document.getElementById('image-preview-container');

    if (previewContainer) previewContainer.classList.add('hidden');

    if (productId) {
      const product = SupplierProducts.state.products.find(p => p.id === productId);
      if (!product) return;

      title.textContent = 'Modifier le produit';
      document.getElementById('product-name').value = product.name || '';
      document.getElementById('product-description').value = product.description || '';
      document.getElementById('product-price').value = product.price || '';
      document.getElementById('product-stock').value = product.stock_quantity || 0;
      document.getElementById('product-category-select').value = product.category_id || '';

      if (product.main_image_url) {
        const preview = document.getElementById('image-preview');
        preview.src = product.main_image_url;
        previewContainer.classList.remove('hidden');
        SupplierProducts.state.uploadedImage = { url: product.main_image_url };
      }
    } else {
      title.textContent = 'Ajouter un produit';
      document.getElementById('product-form')?.reset();
      document.getElementById('product-stock').value = '10';
      document.getElementById('product-description').value = '';
    }

    DashboardApp.openModal('product-modal');
  },

  /* ===========================
     SAVE (CREATE / UPDATE)
  =========================== */
  save: async () => {
    const data = {
      name: document.getElementById('product-name')?.value?.trim(),
      description: document.getElementById('product-description')?.value?.trim() || '',
      price: parseFloat(document.getElementById('product-price')?.value),
      stock_quantity: parseInt(document.getElementById('product-stock')?.value) || 0,
      category_id: parseInt(document.getElementById('product-category-select')?.value) || null,
      main_image_url: SupplierProducts.state.uploadedImage?.url || null
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
      console.error('Save error:', error);
      alert(error.message || 'Erreur lors de l’enregistrement');
    } finally {
      DashboardApp.showLoading(false);
    }
  }
};

// Expose global
window.openProductModal = (id) => SupplierProducts.openModal(id);
window.saveProduct = () => SupplierProducts.save();
