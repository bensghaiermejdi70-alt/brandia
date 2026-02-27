// ============================================
// SUPPLIER CAMPAIGNS MODULE - v8.0 
// Features: Multi-campaign, Product selection, Dynamic CTA
// ============================================

if (typeof BrandiaAPI === 'undefined') {
    console.error('[Campaigns] CRITICAL: BrandiaAPI is not defined');
    window.BrandiaAPI = window.BrandiaAPI || {
        Supplier: {
            getProducts: async () => ({ success: false, message: 'API not loaded', data: [] }),
            getCampaigns: async () => ({ success: false, message: 'API not loaded', data: [] }),
            createCampaign: async () => ({ success: false, message: 'API not loaded' }),
            updateCampaign: async () => ({ success: false, message: 'API not loaded' }),
            deleteCampaign: async () => ({ success: false, message: 'API not loaded' }),
            getCampaignLimit: async () => ({ success: true, data: { current: 0, max: 5, can_create: true } })
        },
        Upload: {
            uploadImage: async () => ({ success: false, message: 'API not loaded' }),
            uploadVideo: async () => ({ success: false, message: 'API not loaded' })
        },
        getSupplierId: () => null
    };
}

window.SupplierCampaigns = {
  state: {
    campaigns: [],
    products: [],
    selectedProducts: [], // IDs des produits sélectionnés
    chart: null,
    currentMediaType: 'image',
    uploadedMedia: null,
    editingCampaignId: null,
    targetMode: 'all', // 'all' ou 'selected'
    ctaType: 'shop', // 'shop', 'category', 'custom'
    isLoading: false,
    campaignLimit: { current: 0, max: 5, can_create: true }
  },
  
  MAX_CAMPAIGNS: 5,
  
  FALLBACK_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzNDE1NSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DYW1wYWduPC90ZXh0Pjwvc3ZnPg==',

  // URLs de la boutique (à adapter selon votre config)
  SHOP_URLS: {
    base: 'https://brandia-marketplace.netlify.app',
    // ou si domaine personnalisé: 'https://brandia.company'
  },

  init: async function() {
    console.log('[Campaigns] Initializing v8.0...');
    try {
      await this.loadCampaignLimit();
      await this.loadProducts();
      await this.loadCampaigns();
      this.initChart();
      this.updateCampaignCounter();
    } catch (error) {
      console.error('[Campaigns] Init error:', error);
      this.showToast('Erreur initialisation module campagnes', 'error');
    }
  },

  loadCampaignLimit: async function() {
    try {
      const response = await BrandiaAPI.Supplier.getCampaignLimit?.() || { 
        success: true, 
        data: { current: this.state.campaigns.length, max: this.MAX_CAMPAIGNS, can_create: this.state.campaigns.length < this.MAX_CAMPAIGNS }
      };
      if (response.success) {
        this.state.campaignLimit = response.data;
      }
    } catch (error) {
      console.error('[Campaigns] Error loading limit:', error);
    }
  },

  updateCampaignCounter: function() {
    const counterEl = document.getElementById('campaign-counter');
    if (counterEl) {
      const current = this.state.campaigns.filter(c => c.status === 'active').length;
      counterEl.innerHTML = `
        <span class="${current >= this.state.campaignLimit.max ? 'text-red-400' : 'text-emerald-400'}">
          ${current}/${this.state.campaignLimit.max}
        </span> actives
      `;
    }
  },

  loadProducts: async function() {
    try {
      console.log('[Campaigns] Loading products...');
      const response = await BrandiaAPI.Supplier.getProducts();
      
      let productsArray = [];
      if (response?.success && response.data) {
        if (Array.isArray(response.data)) {
          productsArray = response.data;
        } else if (response.data.products && Array.isArray(response.data.products)) {
          productsArray = response.data.products;
        }
      }
      
      this.state.products = productsArray;
      console.log('[Campaigns] Products loaded:', this.state.products.length);
      return this.state.products;
    } catch (error) {
      console.error('[Campaigns] Error loading products:', error);
      this.state.products = [];
      return [];
    }
  },

  loadCampaigns: async function() {
    try {
      console.log('[Campaigns] Loading campaigns...');
      const response = await BrandiaAPI.Supplier.getCampaigns();
      
      if (response?.success) {
        this.state.campaigns = response.data || [];
        console.log('[Campaigns] Loaded:', this.state.campaigns.length);
        this.renderList();
        this.updateStats();
        this.updateChart();
        this.updateCampaignCounter();
      } else {
        this.showToast('Erreur chargement campagnes', 'error');
      }
    } catch (error) {
      console.error('[Campaigns] Load error:', error);
      this.showToast('Erreur chargement campagnes', 'error');
    }
  },

  renderList: function() {
    const container = document.getElementById('campaigns-list');
    if (!container) return;
    
    if (this.state.campaigns.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
          <p class="text-lg mb-2">Aucune campagne active</p>
          <p class="text-sm mb-4">Créez votre première publicité</p>
          <button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all">
            <i class="fas fa-plus mr-2"></i>Créer une campagne
          </button>
        </div>`;
      return;
    }
    
    let html = '';
    for (const c of this.state.campaigns) {
      const views = parseInt(c.views_count) || 0;
      const clicks = parseInt(c.clicks_count) || 0;
      const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : 0;
      const mediaUrl = c.media_url || this.FALLBACK_IMAGE;
      
      // Déterminer le texte de ciblage
      let targetText = 'Tous les produits';
      if (c.target_products && Array.isArray(c.target_products)) {
        if (c.target_products.length === 1) {
          targetText = '1 produit';
        } else if (c.target_products.length > 1) {
          targetText = `${c.target_products.length} produits`;
        }
      }
      
      html += `
        <div class="campaign-row p-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 group">
          <div class="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
            ${c.media_type === 'video' 
              ? `<div class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"><i class="fas fa-play-circle text-white text-xl"></i></div><video src="${mediaUrl}" class="w-full h-full object-cover" muted></video>`
              : `<img src="${mediaUrl}" class="w-full h-full object-cover" onerror="this.src='${this.FALLBACK_IMAGE}'">`
            }
            ${c.status === 'active' ? '<span class="absolute top-1 left-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse z-20"></span>' : ''}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-semibold text-white truncate text-sm">${c.name || 'Sans nom'}</h4>
              <span class="badge badge-${c.status || 'active'} text-xs capitalize">${c.status || 'active'}</span>
              ${c.status === 'active' ? '<span class="text-xs text-emerald-400">• En ligne</span>' : ''}
            </div>
            <p class="text-sm text-slate-400 mb-1 truncate text-xs">${c.headline || ''}</p>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span><i class="fas fa-bullseye mr-1"></i>${targetText}</span>
              <span><i class="fas fa-calendar mr-1"></i>${this.formatDate(c.start_date)} - ${this.formatDate(c.end_date)}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="flex items-center gap-3 mb-2">
              <div class="text-center"><p class="text-base font-bold text-white">${views.toLocaleString()}</p><p class="text-xs text-slate-500">Vues</p></div>
              <div class="text-center"><p class="text-base font-bold text-indigo-400">${clicks.toLocaleString()}</p><p class="text-xs text-slate-500">Clics</p></div>
              <div class="text-center"><p class="text-base font-bold text-emerald-400">${ctr}%</p><p class="text-xs text-slate-500">CTR</p></div>
            </div>
            <div class="flex gap-2 justify-end">
              <button onclick="event.stopPropagation(); SupplierCampaigns.editCampaign(${c.id})" class="px-2 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="event.stopPropagation(); SupplierCampaigns.toggleStatus(${c.id}, '${c.status === 'active' ? 'paused' : 'active'}')" class="px-2 py-1 rounded-lg text-xs font-medium ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-colors">
                <i class="fas fa-${c.status === 'active' ? 'pause' : 'play'}"></i>
              </button>
              <button onclick="event.stopPropagation(); SupplierCampaigns.deleteCampaign(${c.id})" class="px-2 py-1 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>`;
    }
    container.innerHTML = html;
  },

  updateStats: function() {
    const totalViews = this.state.campaigns.reduce((sum, c) => sum + (parseInt(c.views_count) || 0), 0);
    const totalClicks = this.state.campaigns.reduce((sum, c) => sum + (parseInt(c.clicks_count) || 0), 0);
    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;
    
    const viewsEl = document.getElementById('ad-views');
    const clicksEl = document.getElementById('ad-clicks');
    const ctrEl = document.getElementById('ad-ctr');
    const convEl = document.getElementById('ad-conversions');
    
    if (viewsEl) viewsEl.textContent = totalViews.toLocaleString();
    if (clicksEl) clicksEl.textContent = totalClicks.toLocaleString();
    if (ctrEl) ctrEl.textContent = ctr + '%';
    if (convEl) convEl.textContent = Math.floor(totalClicks * 0.1).toLocaleString(); // Estimation 10% conversion
  },

  // ==========================================
  // OUVERTURE MODAL
  // ==========================================
  openModal: async function(campaignId = null) {
    console.log('[Campaigns] Opening modal, editing:', campaignId);
    
    // Vérifier limite si nouvelle campagne
    const activeCount = this.state.campaigns.filter(c => c.status === 'active').length;
    if (!campaignId && activeCount >= this.MAX_CAMPAIGNS) {
      this.showToast(`Limite atteinte: ${this.MAX_CAMPAIGNS} campagnes actives maximum. Mettez une campagne en pause pour en créer une nouvelle.`, 'error');
      return;
    }
    
    this.state.editingCampaignId = campaignId;
    this.state.uploadedMedia = null;
    this.state.currentMediaType = 'image';
    this.state.targetMode = 'all';
    this.state.selectedProducts = [];
    this.state.ctaType = 'shop';
    
    const modal = document.getElementById('campaign-modal');
    if (!modal) return;
    
    // Charger produits si pas déjà fait
    if (this.state.products.length === 0) {
      await this.loadProducts();
    }
    
    // Reset form
    const form = document.getElementById('campaign-form');
    if (form) form.reset();
    
    this.resetUploadUI();
    this.renderProductChecklist();
    this.updateCtaLink();
    
    if (campaignId) {
      const campaign = this.state.campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        this.showToast('Campagne non trouvée', 'error');
        return;
      }
      this.fillFormForEdit(campaign);
      this.showModalStats(campaign);
    } else {
      this.hideModalStats();
      // Dates par défaut
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const startInput = document.getElementById('camp-start-date');
      const endInput = document.getElementById('camp-end-date');
      if (startInput) startInput.value = today;
      if (endInput) endInput.value = nextMonth.toISOString().split('T')[0];
      
      // CTA par défaut: boutique
      this.updateCtaLink();
    }
    
    this.attachPreviewListeners();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.updatePreview();
  },

  // ==========================================
  // SÉLECTION DES PRODUITS
  // ==========================================
  renderProductChecklist: function() {
    const container = document.getElementById('products-checklist');
    if (!container) return;
    
    if (this.state.products.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Aucun produit disponible</p>';
      return;
    }
    
    let html = '';
    this.state.products.forEach(product => {
      const isSelected = this.state.selectedProducts.includes(product.id);
      const imageUrl = product.main_image_url || this.FALLBACK_IMAGE;
      
      html += `
        <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-500/10 border border-indigo-500/30' : 'border border-transparent'}">
          <input type="checkbox" value="${product.id}" 
                 ${isSelected ? 'checked' : ''} 
                 onchange="SupplierCampaigns.toggleProductSelection(${product.id})"
                 class="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 bg-slate-700">
          <img src="${imageUrl}" class="w-10 h-10 rounded object-cover bg-slate-800" onerror="this.src='${this.FALLBACK_IMAGE}'">
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">${product.name || 'Sans nom'}</p>
            <p class="text-xs text-slate-400">${parseFloat(product.price || 0).toFixed(2)} €</p>
          </div>
        </label>
      `;
    });
    
    container.innerHTML = html;
    this.updateSelectedCount();
  },

  toggleProductSelection: function(productId) {
    const index = this.state.selectedProducts.indexOf(productId);
    if (index > -1) {
      this.state.selectedProducts.splice(index, 1);
    } else {
      this.state.selectedProducts.push(productId);
    }
    this.updateSelectedCount();
    this.renderProductChecklist(); // Re-render pour mettre à jour le style
    this.updatePreview();
  },

  toggleAllProducts: function() {
    if (this.state.selectedProducts.length === this.state.products.length) {
      // Tout décocher
      this.state.selectedProducts = [];
    } else {
      // Tout cocher
      this.state.selectedProducts = this.state.products.map(p => p.id);
    }
    this.renderProductChecklist();
    this.updatePreview();
  },

  updateSelectedCount: function() {
    const el = document.getElementById('selected-count');
    if (el) el.textContent = this.state.selectedProducts.length;
  },

  toggleTargetMode: function(mode) {
    this.state.targetMode = mode;
    const panel = document.getElementById('product-selection-panel');
    
    if (panel) {
      panel.classList.toggle('hidden', mode === 'all');
    }
    
    this.updatePreview();
  },

  // ==========================================
  // GESTION DU LIEN CTA
  // ==========================================
  updateCtaOptions: function() {
    const radios = document.getElementsByName('cta_type');
    let selectedType = 'shop';
    for (const radio of radios) {
      if (radio.checked) {
        selectedType = radio.value;
        break;
      }
    }
    
    this.state.ctaType = selectedType;
    this.updateCtaLink();
  },

  updateCtaLink: function() {
    const linkInput = document.getElementById('camp-cta-link');
    const helpText = document.getElementById('cta-link-help');
    if (!linkInput) return;
    
    let url = '';
    let help = '';
    
    switch(this.state.ctaType) {
      case 'shop':
        url = this.SHOP_URLS.base;
        help = 'Redirige vers votre boutique principale';
        break;
      case 'category':
        // Si produits sélectionnés, prendre la catégorie du premier
        if (this.state.selectedProducts.length > 0 && this.state.products.length > 0) {
          const firstProduct = this.state.products.find(p => p.id === this.state.selectedProducts[0]);
          if (firstProduct?.category_id) {
            url = `${this.SHOP_URLS.base}/category.html?id=${firstProduct.category_id}`;
          } else {
            url = this.SHOP_URLS.base;
          }
        } else {
          url = this.SHOP_URLS.base;
        }
        help = 'Redirige vers la catégorie des produits sélectionnés';
        break;
      case 'custom':
        url = linkInput.value || 'https://';
        help = 'Saisissez votre propre URL de destination';
        linkInput.focus();
        break;
    }
    
    if (this.state.ctaType !== 'custom') {
      linkInput.value = url;
      linkInput.readOnly = true;
      linkInput.classList.add('bg-slate-900', 'text-slate-400');
    } else {
      linkInput.readOnly = false;
      linkInput.classList.remove('bg-slate-900', 'text-slate-400');
    }
    
    if (helpText) helpText.textContent = help;
  },

  // ==========================================
  // SAUVEGARDE
  // ==========================================
  save: async function() {
    console.log('[Campaigns] ========== SAVE STARTED ==========');
    if (this.state.isLoading) return;
    
    try {
      // Récupération des valeurs
      const name = document.getElementById('camp-name')?.value?.trim();
      const headline = document.getElementById('camp-headline')?.value?.trim();
      const description = document.getElementById('camp-description')?.value?.trim() || '';
      const startDate = document.getElementById('camp-start-date')?.value;
      const endDate = document.getElementById('camp-end-date')?.value;
      const ctaText = document.getElementById('camp-cta-text')?.value?.trim() || "Voir l'offre";
      const ctaLink = document.getElementById('camp-cta-link')?.value?.trim();
      
      // Validation
      if (!name) {
        this.showToast('Le nom de la campagne est requis', 'error');
        document.getElementById('camp-name')?.focus();
        return;
      }
      if (!headline) {
        this.showToast('Le titre publicitaire est requis', 'error');
        document.getElementById('camp-headline')?.focus();
        return;
      }
      if (!startDate || !endDate) {
        this.showToast('Les dates de début et fin sont requises', 'error');
        return;
      }
      if (new Date(endDate) <= new Date(startDate)) {
        this.showToast('La date de fin doit être après la date de début', 'error');
        return;
      }
      
      // Validation ciblage
      if (this.state.targetMode === 'selected' && this.state.selectedProducts.length === 0) {
        this.showToast('Veuillez sélectionner au moins un produit', 'error');
        return;
      }
      
      // Upload média si nouveau
      let mediaUrl = null;
      let mediaType = this.state.currentMediaType;
      
      if (this.state.uploadedMedia?.isNew) {
        try {
          const uploadResult = await this.uploadMediaToCloudinary();
          if (uploadResult) {
            mediaUrl = uploadResult.url;
            mediaType = uploadResult.type;
          }
        } catch (err) {
          this.showToast('Erreur upload: ' + err.message, 'error');
          return;
        }
      } else if (this.state.uploadedMedia?.existingUrl) {
        mediaUrl = this.state.uploadedMedia.existingUrl;
        mediaType = this.state.uploadedMedia.existingType;
      }
      
      if (!mediaUrl && !this.state.editingCampaignId) {
        this.showToast('Une image ou vidéo est requise', 'error');
        return;
      }
      
      // Construction des données
      const campaignData = {
        name: name,
        type: 'overlay',
        media_url: mediaUrl,
        media_type: mediaType,
        headline: headline,
        description: description,
        cta_text: ctaText,
        cta_link: ctaLink,
        target_products: this.state.targetMode === 'all' ? null : this.state.selectedProducts,
        target_mode: this.state.targetMode,
        start_date: startDate,
        end_date: endDate,
        status: 'active'
      };
      
      console.log('[Campaigns] Saving:', campaignData);
      this.showLoading(true);
      
      let response;
      if (this.state.editingCampaignId) {
        response = await BrandiaAPI.Supplier.updateCampaign(this.state.editingCampaignId, campaignData);
      } else {
        response = await BrandiaAPI.Supplier.createCampaign(campaignData);
      }
      
      this.showLoading(false);
      
      if (response?.success) {
        this.showToast(this.state.editingCampaignId ? 'Campagne mise à jour ✓' : 'Campagne créée avec succès !', 'success');
        this.closeModal();
        await this.loadCampaigns();
      } else {
        throw new Error(response?.message || 'Erreur serveur');
      }
      
    } catch (error) {
      console.error('[Campaigns] Save error:', error);
      this.showLoading(false);
      this.showToast('Erreur: ' + (error.message || 'Inconnue'), 'error');
    }
  },

  // ... (autres méthodes: fillFormForEdit, handleMediaSelect, etc. identiques à avant)

  closeModal: function() {
    const modal = document.getElementById('campaign-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    this.state.editingCampaignId = null;
    this.state.uploadedMedia = null;
    this.state.selectedProducts = [];
  },

  showToast: function(message, type) {
    if (window.showToast) window.showToast(message, type);
    else console.log(`[${type}] ${message}`);
  },

  showLoading: function(show) {
    this.state.isLoading = show;
    if (window.showLoading) window.showLoading(show);
  },

  formatDate: function(dateString) {
    if (!dateString) return '--';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch (e) { return '--'; }
  }
};

// ==========================================
// FONCTIONS GLOBALES
// ==========================================
window.openCampaignModal = () => SupplierCampaigns.openModal();
window.closeCampaignModal = () => SupplierCampaigns.closeModal();
window.saveCampaignForm = () => SupplierCampaigns.save();
window.handleCampaignMedia = (e) => SupplierCampaigns.handleMediaSelect(e);
window.toggleMediaType = (type) => SupplierCampaigns.toggleMediaType(type);
window.toggleTargetMode = (mode) => SupplierCampaigns.toggleTargetMode(mode);
window.toggleProductSelection = (id) => SupplierCampaigns.toggleProductSelection(id);
window.toggleAllProducts = () => SupplierCampaigns.toggleAllProducts();
window.updateCtaOptions = () => SupplierCampaigns.updateCtaOptions();
window.editCampaign = (id) => SupplierCampaigns.editCampaign(id);
window.deleteCampaign = (id) => SupplierCampaigns.deleteCampaign(id);
window.toggleCampaignStatus = (id, status) => SupplierCampaigns.toggleStatus(id, status);