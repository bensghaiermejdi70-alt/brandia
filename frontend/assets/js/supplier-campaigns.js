// ============================================
// SUPPLIER CAMPAIGNS MODULE - v9.1 FIX
// Correction: Utilisation correcte de main_image_url au lieu de product_images
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
    selectedProducts: [],
    chart: null,
    currentMediaType: 'image',
    uploadedMedia: null,
    editingCampaignId: null,
    targetMode: 'all',
    ctaType: 'shop',
    isLoading: false,
    campaignLimit: { current: 0, max: 5, can_create: true }
  },
  
  MAX_CAMPAIGNS: 5,
  
  FALLBACK_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzNDE1NSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DYW1wYWduPC90ZXh0Pjwvc3ZnPg==',

  SHOP_URLS: {
    base: 'https://brandia-marketplace.netlify.app'
  },

  init: async function() {
    console.log('[Campaigns] Initializing v9.1...');
    try {
      this.state.campaignLimit = { 
        current: 0, 
        max: this.MAX_CAMPAIGNS, 
        can_create: true 
      };
      await this.loadProducts();
      await this.loadCampaigns();
      this.initChart();
      this.updateCampaignCounter();
    } catch (error) {
      console.error('[Campaigns] Init error:', error);
      this.showToast('Erreur initialisation module campagnes', 'error');
    }
  },

  updateCampaignCounter: function() {
    const counterEl = document.getElementById('campaign-counter');
    if (counterEl) {
      const current = this.state.campaigns.filter(c => c.status === 'active').length;
      this.state.campaignLimit.current = current;
      counterEl.innerHTML = `
        <span class="${current >= this.MAX_CAMPAIGNS ? 'text-red-400' : 'text-emerald-400'}">
          ${current}/${this.MAX_CAMPAIGNS}
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
        if (this.state.chart) this.updateChart();
        this.updateCampaignCounter();
      } else {
        console.error('[Campaigns] API Error:', response?.message || 'Unknown error');
        this.state.campaigns = [];
        this.renderList();
        this.updateStats();
        this.updateCampaignCounter();
        if (response?.message) {
          console.log('[Campaigns] Server message:', response.message);
        }
      }
    } catch (error) {
      console.error('[Campaigns] Load error:', error);
      this.state.campaigns = [];
      this.renderList();
      this.updateStats();
      this.updateCampaignCounter();
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
          <p class="text-sm mb-4">Créez votre première publicité pour promouvoir vos produits</p>
          <button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all">
            <i class="fas fa-plus mr-2"></i>Créer une campagne
          </button>
        </div>`;
      return;
    }
    
    let html = '';
    for (const c of this.state.campaigns) {
      const views = parseInt(c.views_count || c.impressions || 0);
      const clicks = parseInt(c.clicks_count || c.clicks || 0);
      const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : 0;
      
      // 🔥 v9.1: Correction - utiliser le bon champ pour l'image média
      const mediaUrl = c.media_url || c.ad_creative?.image_url || this.FALLBACK_IMAGE;
      const mediaType = c.media_type || c.ad_creative?.type || 'image';
      
      // 🔥 v9.1: Correction - utiliser product_image au lieu de product_images
      const productImage = c.product_image || this.FALLBACK_IMAGE;
      
      let targetText = 'Tous les produits';
      if (c.product_name) {
        targetText = c.product_name;
      } else if (c.target_products && Array.isArray(c.target_products)) {
        if (c.target_products.length === 1) targetText = '1 produit';
        else if (c.target_products.length > 1) targetText = `${c.target_products.length} produits`;
      }
      
      html += `
        <div class="campaign-row p-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 group">
          <div class="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
            ${mediaType === 'video' 
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
            <p class="text-sm text-slate-400 mb-1 truncate text-xs">${c.headline || c.ad_creative?.headline || ''}</p>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span class="flex items-center gap-1">
                <img src="${productImage}" class="w-4 h-4 rounded object-cover" onerror="this.style.display='none'">
                ${targetText}
              </span>
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
              <button onclick="event.stopPropagation(); SupplierCampaigns.editCampaign('${c.id}')" class="px-2 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="event.stopPropagation(); SupplierCampaigns.toggleStatus('${c.id}', '${c.status === 'active' ? 'paused' : 'active'}')" class="px-2 py-1 rounded-lg text-xs font-medium ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-colors">
                <i class="fas fa-${c.status === 'active' ? 'pause' : 'play'}"></i>
              </button>
              <button onclick="event.stopPropagation(); SupplierCampaigns.deleteCampaign('${c.id}')" class="px-2 py-1 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>`;
    }
    container.innerHTML = html;
  },

  updateStats: function() {
    const totalViews = this.state.campaigns.reduce((sum, c) => sum + (parseInt(c.views_count || c.impressions || 0)), 0);
    const totalClicks = this.state.campaigns.reduce((sum, c) => sum + (parseInt(c.clicks_count || c.clicks || 0)), 0);
    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;
    
    const viewsEl = document.getElementById('ad-views');
    const clicksEl = document.getElementById('ad-clicks');
    const ctrEl = document.getElementById('ad-ctr');
    const convEl = document.getElementById('ad-conversions');
    
    if (viewsEl) viewsEl.textContent = totalViews.toLocaleString();
    if (clicksEl) clicksEl.textContent = totalClicks.toLocaleString();
    if (ctrEl) ctrEl.textContent = ctr + '%';
    if (convEl) convEl.textContent = Math.floor(totalClicks * 0.1).toLocaleString();
  },

  initChart: function() {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) {
      console.log('[Campaigns] Chart canvas not found');
      return;
    }
    
    if (this.state.chart) {
      this.state.chart.destroy();
      this.state.chart = null;
    }

    this.state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { 
            label: 'Vues', 
            data: [], 
            borderColor: '#6366f1', 
            backgroundColor: 'rgba(99, 102, 241, 0.1)', 
            fill: true, 
            tension: 0.4 
          },
          { 
            label: 'Clics', 
            data: [], 
            borderColor: '#ec4899', 
            backgroundColor: 'rgba(236, 72, 153, 0.1)', 
            fill: true, 
            tension: 0.4 
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: true, labels: { color: '#94a3b8' } } 
        },
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(148, 163, 184, 0.1)' }, 
            ticks: { color: '#94a3b8' } 
          },
          x: { 
            grid: { display: false }, 
            ticks: { color: '#94a3b8' } 
          }
        }
      }
    });
    
    this.updateChart();
    console.log('[Campaigns] Chart initialized');
  },

  updateChart: function() {
    if (!this.state.chart) return;
    
    const labels = [], viewsData = [], clicksData = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
      
      const dayViews = Math.floor((this.state.campaigns.reduce((sum, c) => sum + (parseInt(c.views_count || c.impressions || 0)), 0) / 30) * (0.5 + Math.random()));
      const dayClicks = Math.floor((this.state.campaigns.reduce((sum, c) => sum + (parseInt(c.clicks_count || c.clicks || 0)), 0) / 30) * (0.5 + Math.random()));
      
      viewsData.push(dayViews);
      clicksData.push(dayClicks);
    }
    
    this.state.chart.data.labels = labels;
    this.state.chart.data.datasets[0].data = viewsData;
    this.state.chart.data.datasets[1].data = clicksData;
    this.state.chart.update();
  },

  openModal: async function(campaignId = null) {
    console.log('[Campaigns] Opening modal, editing:', campaignId);
    
    const activeCount = this.state.campaigns.filter(c => c.status === 'active').length;
    if (!campaignId && activeCount >= this.MAX_CAMPAIGNS) {
      this.showToast(`Limite atteinte: ${this.MAX_CAMPAIGNS} campagnes actives maximum.`, 'error');
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
    
    if (this.state.products.length === 0) await this.loadProducts();
    
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
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const startInput = document.getElementById('camp-start-date');
            const endInput = document.getElementById('camp-end-date');
      if (startInput) startInput.value = today;
      if (endInput) endInput.value = nextMonth.toISOString().split('T')[0];
      
      this.updateCtaLink();
    }
    
    this.attachPreviewListeners();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.updatePreview();
  },

  resetUploadUI: function() {
    const dropzone = document.getElementById('campaign-dropzone');
    const fileInput = document.getElementById('campaign-media');
    
    if (fileInput) fileInput.value = '';
    
    if (dropzone) {
      dropzone.innerHTML = `
        <input type="file" id="campaign-media" class="hidden" accept="image/*,video/mp4,video/webm,video/quicktime" onchange="handleCampaignMedia(event)">
        <div id="campaign-media-placeholder" class="text-center p-4">
          <i class="fas fa-cloud-upload-alt text-2xl text-slate-500 mb-2"></i>
          <p class="text-slate-400 text-xs">Cliquez ou glissez votre fichier ici</p>
          <p class="text-slate-600 text-xs mt-1">Max 5MB (image) ou 50MB (vidéo)</p>
          <p class="text-slate-600 text-xs">Formats: JPG, PNG, GIF, MP4, WEBM</p>
        </div>
      `;
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
      dropzone.classList.add('border-slate-700', 'border-2', 'border-dashed');
    }
  },

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
      // 🔥 v9.1: Utiliser main_image_url qui est le champ correct
      const imageUrl = product.main_image_url || product.image_url || product.images?.[0] || this.FALLBACK_IMAGE;
      
      html += `
        <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-500/10 border border-indigo-500/30' : 'border border-transparent'}">
          <input type="checkbox" value="${product.id}" 
                 ${isSelected ? 'checked' : ''} 
                 onchange="SupplierCampaigns.toggleProductSelection('${product.id}')"
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
    this.renderProductChecklist();
    this.updatePreview();
  },

  toggleAllProducts: function() {
    if (this.state.selectedProducts.length === this.state.products.length) {
      this.state.selectedProducts = [];
    } else {
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
    if (panel) panel.classList.toggle('hidden', mode === 'all');
    this.updatePreview();
  },

  updateCtaOptions: function() {
    const radios = document.getElementsByName('cta_type');
    for (const radio of radios) {
      if (radio.checked) {
        this.state.ctaType = radio.value;
        break;
      }
    }
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

  fillFormForEdit: function(campaign) {
    const nameField = document.getElementById('camp-name');
    const headlineField = document.getElementById('camp-headline');
    const descField = document.getElementById('camp-description');
    const ctaTextField = document.getElementById('camp-cta-text');
    const startDateField = document.getElementById('camp-start-date');
    const endDateField = document.getElementById('camp-end-date');
    const ctaLinkField = document.getElementById('camp-cta-link');
    
    if (nameField && campaign.name) nameField.value = campaign.name;
    if (headlineField) headlineField.value = campaign.headline || campaign.ad_creative?.headline || '';
    if (descField) descField.value = campaign.description || campaign.ad_creative?.description || '';
    if (ctaTextField) ctaTextField.value = campaign.cta_text || campaign.ad_creative?.cta_text || "Voir l'offre";
    if (startDateField && campaign.start_date) startDateField.value = campaign.start_date.split('T')[0];
    if (endDateField && campaign.end_date) endDateField.value = campaign.end_date.split('T')[0];
    if (ctaLinkField && campaign.cta_link) ctaLinkField.value = campaign.cta_link;
    
    if (campaign.target_products && Array.isArray(campaign.target_products) && campaign.target_products.length > 0) {
      this.state.targetMode = 'selected';
      this.state.selectedProducts = [...campaign.target_products];
      const radio = document.querySelector('input[name="target_mode"][value="selected"]');
      if (radio) radio.checked = true;
      this.toggleTargetMode('selected');
    } else if (campaign.product_id) {
      this.state.targetMode = 'selected';
      this.state.selectedProducts = [campaign.product_id];
      const radio = document.querySelector('input[name="target_mode"][value="selected"]');
      if (radio) radio.checked = true;
      this.toggleTargetMode('selected');
    } else {
      this.state.targetMode = 'all';
      this.state.selectedProducts = [];
      const radio = document.querySelector('input[name="target_mode"][value="all"]');
      if (radio) radio.checked = true;
      this.toggleTargetMode('all');
    }
    
    if (campaign.media_type || campaign.ad_creative?.type) {
      this.state.currentMediaType = campaign.media_type || campaign.ad_creative?.type;
      const radio = document.querySelector(`input[name="media_type"][value="${this.state.currentMediaType}"]`);
      if (radio) radio.checked = true;
    }
    
    if (campaign.media_url || campaign.ad_creative?.image_url) {
      this.state.uploadedMedia = {
        isNew: false,
        existingUrl: campaign.media_url || campaign.ad_creative?.image_url,
        existingType: campaign.media_type || campaign.ad_creative?.type || 'image'
      };
      this.showMediaPreview(campaign.media_url || campaign.ad_creative?.image_url, this.state.currentMediaType);
    }
    
    this.renderProductChecklist();
  },

  showModalStats: function(campaign) {
    const statsContainer = document.getElementById('campaign-quick-stats');
    if (!statsContainer) return;
    statsContainer.classList.remove('hidden');
    
    const viewsEl = document.getElementById('modal-ad-views');
    const clicksEl = document.getElementById('modal-ad-clicks');
    const ctrEl = document.getElementById('modal-ad-ctr');
    
    const views = parseInt(campaign.views_count || campaign.impressions || 0);
    const clicks = parseInt(campaign.clicks_count || campaign.clicks || 0);
    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : 0;
    
    if (viewsEl) viewsEl.textContent = views.toLocaleString();
    if (clicksEl) clicksEl.textContent = clicks.toLocaleString();
    if (ctrEl) ctrEl.textContent = ctr + '%';
  },

  hideModalStats: function() {
    const statsContainer = document.getElementById('campaign-quick-stats');
    if (statsContainer) statsContainer.classList.add('hidden');
  },

  attachPreviewListeners: function() {
    const fields = ['camp-name', 'camp-headline', 'camp-description', 'camp-cta-text'];
    fields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.addEventListener('input', () => this.updatePreview());
      }
    });
  },

  updatePreview: function() {
    try {
      const headline = document.getElementById('camp-headline')?.value || 'Votre titre';
      const description = document.getElementById('camp-description')?.value || 'Description...';
      const ctaText = document.getElementById('camp-cta-text')?.value || "Voir l'offre";
      
      const headlineEl = document.getElementById('ad-preview-headline');
      const descEl = document.getElementById('ad-preview-desc');
      const ctaEl = document.getElementById('ad-preview-cta');
      const mediaEl = document.getElementById('ad-preview-media');
      const targetEl = document.getElementById('ad-preview-target');
      
      if (headlineEl) headlineEl.textContent = headline;
      if (descEl) descEl.textContent = description;
      if (ctaEl) ctaEl.textContent = ctaText;
      
      if (targetEl) {
        targetEl.textContent = this.state.targetMode === 'all' 
          ? 'Tous les produits' 
          : `${this.state.selectedProducts.length} produit(s)`;
      }
      
      if (mediaEl && this.state.uploadedMedia) {
        const url = this.state.uploadedMedia.localUrl || this.state.uploadedMedia.existingUrl;
        if (this.state.currentMediaType === 'video') {
          mediaEl.innerHTML = `<video src="${url}" class="w-full h-full object-cover" muted autoplay loop></video>`;
        } else {
          mediaEl.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
        }
      } else if (mediaEl) {
        mediaEl.innerHTML = '<i class="fas fa-image text-slate-500 text-xl"></i>';
      }
    } catch (error) {
      console.error('[Campaigns] updatePreview error:', error);
    }
  },

  // 🔥 v9.1: Gestion améliorée du média avec meilleure détection type
  handleMediaSelect: function(event) {
    console.log('[Campaigns] File selected:', event);
    const file = event.target.files[0];
    if (!file) {
      console.log('[Campaigns] No file selected');
      return;
    }
    
    console.log('[Campaigns] File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });
    
    // Détection auto du type si pas déjà défini
    if (file.type.startsWith('video/')) {
      this.state.currentMediaType = 'video';
    } else if (file.type.startsWith('image/')) {
      this.state.currentMediaType = 'image';
    }
    
    const maxSize = this.state.currentMediaType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showToast(`Fichier trop grand (max ${this.state.currentMediaType === 'video' ? '50' : '5'}MB)`, 'error');
      return;
    }
    
    if (this.state.currentMediaType === 'image' && !file.type.startsWith('image/')) {
      this.showToast('Veuillez sélectionner une image (JPG, PNG, GIF)', 'error');
      return;
    }
    if (this.state.currentMediaType === 'video' && !file.type.startsWith('video/')) {
      this.showToast('Veuillez sélectionner une vidéo (MP4, WEBM, MOV)', 'error');
      return;
    }
    
    if (this.state.currentMediaType === 'video') {
      this.checkVideoDuration(file).then(isValid => {
        if (!isValid) {
          this.showToast('La vidéo ne doit pas dépasser 15 secondes', 'error');
          return;
        }
        this.processSelectedFile(file);
      });
    } else {
      this.processSelectedFile(file);
    }
  },

  checkVideoDuration: function(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        console.log('[Campaigns] Video duration:', duration, 'seconds');
        resolve(duration <= 15);
      };
      video.onerror = () => {
        console.error('[Campaigns] Error loading video metadata');
        resolve(false);
      };
      video.src = URL.createObjectURL(file);
    });
  },

  processSelectedFile: function(file) {
    const url = URL.createObjectURL(file);
    this.showMediaPreview(url, this.state.currentMediaType);
    this.state.uploadedMedia = {
      isNew: true,
      file: file,
      type: this.state.currentMediaType,
      localUrl: url
    };
    this.updatePreview();
    console.log('[Campaigns] File processed, type:', this.state.currentMediaType);
  },

  showMediaPreview: function(url, type) {
    const dropzone = document.getElementById('campaign-dropzone');
    if (!dropzone) return;
    
    dropzone.classList.remove('border-slate-700');
    dropzone.classList.add('border-indigo-500', 'bg-indigo-500/10');
    
    if (type === 'video') {
      dropzone.innerHTML = `
        <div class="relative w-full">
          <video src="${url}" class="w-full h-32 object-cover rounded-lg" controls muted></video>
          <button type="button" onclick="event.stopPropagation(); SupplierCampaigns.removeMedia()" class="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg z-10">
            <i class="fas fa-times text-xs"></i>
          </button>
          <div class="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            <i class="fas fa-video mr-1"></i>Vidéo
          </div>
        </div>`;
    } else {
      dropzone.innerHTML = `
        <div class="relative w-full">
          <img src="${url}" class="w-full h-32 object-cover rounded-lg">
          <button type="button" onclick="event.stopPropagation(); SupplierCampaigns.removeMedia()" class="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg z-10">
            <i class="fas fa-times text-xs"></i>
          </button>
          <div class="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            <i class="fas fa-image mr-1"></i>Image
          </div>
        </div>`;
    }
  },

  removeMedia: function() {
    this.state.uploadedMedia = null;
    this.resetUploadUI();
    this.updatePreview();
  },

  toggleMediaType: function(type) {
    this.state.currentMediaType = type;
    this.removeMedia();
    const fileInput = document.getElementById('campaign-media');
    if (fileInput) {
      fileInput.accept = type === 'video' ? 'video/mp4,video/mov,video/webm' : 'image/*';
    }
  },

  // 🔥 v9.1: Upload amélioré avec meilleure gestion d'erreurs
  uploadMediaToCloudinary: async function() {
    if (!this.state.uploadedMedia || !this.state.uploadedMedia.isNew) {
      if (this.state.uploadedMedia && this.state.uploadedMedia.existingUrl) {
        return { 
          url: this.state.uploadedMedia.existingUrl, 
          type: this.state.uploadedMedia.existingType 
        };
      }
      return null;
    }
    
    const file = this.state.uploadedMedia.file;
    const type = this.state.uploadedMedia.type;
    
    const formData = new FormData();
    formData.append('media', file);
    
    console.log('[Upload] Starting upload:', {
      filename: file.name,
      type: type,
      size: file.size
    });
    
    try {
      this.showLoading(true);
      
      // 🔥 v9.1: Utiliser la bonne API selon le type
      const uploadFn = type === 'video' 
        ? BrandiaAPI.Upload.uploadVideo 
        : BrandiaAPI.Upload.uploadImage;
      
      console.log('[Upload] Calling API:', type === 'video' ? 'uploadVideo' : 'uploadImage');
      
      const result = await uploadFn(formData);
      
      console.log('[Upload] API result:', result);
      
      if (result?.success) {
        const mediaUrl = result.data?.url || result.data?.secure_url;
        if (!mediaUrl) {
          throw new Error('URL média non trouvée dans la réponse');
        }
        return { url: mediaUrl, type: type };
      } else {
        throw new Error(result?.message || 'Erreur upload inconnue');
      }
    } catch (error) {
      console.error('[Campaigns Upload] Error:', error);
      throw error;
    } finally {
      this.showLoading(false);
    }
  },

  save: async function() {
    console.log('[Campaigns] ========== SAVE STARTED ==========');
    if (this.state.isLoading) return;
    
    try {
      const name = document.getElementById('camp-name')?.value?.trim();
      const headline = document.getElementById('camp-headline')?.value?.trim();
      const description = document.getElementById('camp-description')?.value?.trim() || '';
      const startDate = document.getElementById('camp-start-date')?.value;
      const endDate = document.getElementById('camp-end-date')?.value;
      const ctaText = document.getElementById('camp-cta-text')?.value?.trim() || "Voir l'offre";
      const ctaLink = document.getElementById('camp-cta-link')?.value?.trim();
      
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
      
      if (this.state.targetMode === 'selected' && this.state.selectedProducts.length === 0) {
        this.showToast('Veuillez sélectionner au moins un produit', 'error');
        return;
      }
      
      let mediaUrl = null;
      let mediaType = this.state.currentMediaType;
      
      // 🔥 v9.1: Upload du média si nouveau
      if (this.state.uploadedMedia?.isNew) {
        try {
          console.log('[Campaigns] Uploading new media...');
          const uploadResult = await this.uploadMediaToCloudinary();
          if (uploadResult) {
            mediaUrl = uploadResult.url;
            mediaType = uploadResult.type;
            console.log('[Campaigns] Media uploaded:', mediaUrl);
          }
        } catch (err) {
          console.error('[Campaigns] Upload failed:', err);
          this.showToast('Erreur upload: ' + err.message, 'error');
          return;
        }
      } else if (this.state.uploadedMedia?.existingUrl) {
        mediaUrl = this.state.uploadedMedia.existingUrl;
        mediaType = this.state.uploadedMedia.existingType;
        console.log('[Campaigns] Using existing media:', mediaUrl);
      }
      
      if (!mediaUrl && !this.state.editingCampaignId) {
        this.showToast('Une image ou vidéo est requise', 'error');
        return;
      }
      
      let productId = null;
      if (this.state.targetMode === 'selected' && this.state.selectedProducts.length > 0) {
        productId = this.state.selectedProducts[0];
      }
      
      if (!productId && !this.state.editingCampaignId) {
        this.showToast('Veuillez sélectionner un produit cible', 'error');
        return;
      }
      
      const adCreative = {
        headline: headline,
        description: description,
        cta_text: ctaText,
        image_url: mediaUrl,
        type: mediaType,
        target_products: this.state.selectedProducts,
        target_mode: this.state.targetMode
      };
      
      const campaignData = {
        name: name,
        product_id: productId,
        budget: 100,
        daily_budget: null,
        start_date: startDate,
        end_date: endDate,
        targeting: { mode: this.state.targetMode, products: this.state.selectedProducts },
        ad_creative: adCreative,
        ad_format: 'overlay',
        cta_link: ctaLink,
        status: 'active',
        media_url: mediaUrl,
        media_type: mediaType
      };
      
      console.log('[Campaigns] Saving data:', JSON.stringify(campaignData, null, 2));
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
        console.error('[Campaigns] Save failed:', response);
        throw new Error(response?.message || 'Erreur serveur');
      }
      
    } catch (error) {
      console.error('[Campaigns] Save error:', error);
      this.showLoading(false);
      this.showToast('Erreur: ' + (error.message || 'Inconnue'), 'error');
    }
  },

  editCampaign: function(id) {
    this.openModal(id);
  },

  toggleStatus: async function(id, newStatus) {
    try {
      const response = await BrandiaAPI.Supplier.updateCampaign(id, { status: newStatus });
      if (response?.success) {
        this.showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
        await this.loadCampaigns();
      } else {
        throw new Error(response?.message || 'Erreur inconnue');
      }
    } catch (error) {
      this.showToast('Erreur: ' + (error.message || 'Inconnue'), 'error');
    }
  },

  deleteCampaign: async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
    try {
      const response = await BrandiaAPI.Supplier.deleteCampaign(id);
      if (response?.success) {
        this.showToast('Campagne supprimée', 'success');
        await this.loadCampaigns();
      } else {
        throw new Error(response?.message || 'Erreur inconnue');
      }
    } catch (error) {
      this.showToast('Erreur: ' + (error.message || 'Inconnue'), 'error');
    }
  },

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

  showLoading: function(show) {
    this.state.isLoading = show;
    if (window.showLoading) window.showLoading(show);
  },

  showToast: function(message, type) {
    if (window.showToast) window.showToast(message, type);
    else console.log(`[${type}] ${message}`);
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

console.log('[SupplierCampaigns] Module v9.1 UPLOAD FIX READY chargé');