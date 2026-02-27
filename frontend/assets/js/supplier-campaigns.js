// ============================================
// SUPPLIER CAMPAIGNS MODULE - v7.1 PRODUCTION
// Changes: Fixed form handling, corrected DOM selectors
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
    chart: null,
    currentMediaType: 'image',
    uploadedMedia: null,
    editingCampaignId: null,
    currentChartData: null,
    isLoading: false,
    campaignLimit: { current: 0, max: 5, can_create: true }
  },
  
  MAX_CAMPAIGNS: 5,
  
  FALLBACK_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzNDE1NSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DYW1wYWduPC90ZXh0Pjwvc3ZnPg==',
  
  init: async function() {
    console.log('[Campaigns] Initializing v7.1...');
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
      counterEl.innerHTML = `
        <span class="${this.state.campaignLimit.current >= this.state.campaignLimit.max ? 'text-red-400' : 'text-emerald-400'}">
          ${this.state.campaignLimit.current}/${this.state.campaignLimit.max}
        </span> campagnes
      `;
    }
    
    const createBtn = document.getElementById('btn-create-campaign');
    if (createBtn) {
      if (this.state.campaignLimit.current >= this.state.campaignLimit.max && !this.state.editingCampaignId) {
        createBtn.disabled = true;
        createBtn.classList.add('opacity-50', 'cursor-not-allowed');
        createBtn.title = 'Limite de campagnes atteinte. Contactez l\'administrateur pour augmenter votre quota.';
      } else {
        createBtn.disabled = false;
        createBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        createBtn.title = '';
      }
    }
  },

  loadProducts: async function() {
    try {
      console.log('[Campaigns] Loading products...');
      const response = await BrandiaAPI.Supplier.getProducts();
      console.log('[Campaigns] Products API response:', response);
      
      let productsArray = [];
      if (response && response.success && response.data) {
        if (Array.isArray(response.data)) {
          productsArray = response.data;
        } else if (response.data.products && Array.isArray(response.data.products)) {
          productsArray = response.data.products;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          productsArray = response.data.data;
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
      console.log('[Campaigns] API response:', response);
      
      if (response && response.success) {
        this.state.campaigns = response.data || [];
        console.log('[Campaigns] Loaded:', this.state.campaigns.length);
        this.renderList();
        this.updateStats();
        this.updateChart();
        this.updateCampaignCounter();
      } else {
        console.error('[Campaigns] API error:', response?.message || 'Unknown error');
        this.showToast('Erreur chargement campagnes: ' + (response?.message || 'Erreur inconnue'), 'error');
      }
    } catch (error) {
      console.error('[Campaigns] Load error:', error);
      this.showToast('Erreur chargement campagnes', 'error');
    }
  },
  
  renderList: function() {
    const container = document.getElementById('campaigns-list');
    if (!container) { 
      console.error('[Campaigns] Container #campaigns-list not found'); 
      return; 
    }
    
    if (this.state.campaigns.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
          <p class="text-lg mb-2">Aucune campagne active</p>
          <p class="text-sm mb-4">Créez votre première publicité contextuelle</p>
          <button onclick="SupplierCampaigns.openModal()" id="btn-create-campaign-empty" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all">
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
              <span><i class="fas fa-box mr-1"></i>Tous vos produits</span>
              <span><i class="fas fa-calendar mr-1"></i>${this.formatDate(c.start_date)} - ${this.formatDate(c.end_date)}</span>
              ${c.media_type === 'video' ? '<span><i class="fas fa-video mr-1"></i>Vidéo</span>' : '<span><i class="fas fa-image mr-1"></i>Image</span>'}
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
    
    if (viewsEl) viewsEl.textContent = totalViews.toLocaleString();
    if (clicksEl) clicksEl.textContent = totalClicks.toLocaleString();
    if (ctrEl) ctrEl.textContent = ctr + '%';
  },
  
  openModal: async function(campaignId = null) {
    console.log('[Campaigns] Opening modal, editing:', campaignId);
    
    if (!campaignId && this.state.campaignLimit.current >= this.state.campaignLimit.max) {
      this.showToast(`Vous avez atteint la limite de ${this.state.campaignLimit.max} campagnes. Contactez l'administrateur pour augmenter votre quota.`, 'error');
      return;
    }
    
    this.state.editingCampaignId = campaignId;
    this.state.uploadedMedia = null;
    this.state.currentMediaType = 'image';
    
    const modal = document.getElementById('campaign-modal');
    if (!modal) { 
      console.error('[Campaigns] Modal #campaign-modal not found'); 
      return; 
    }
    
    if (!this.state.products || this.state.products.length === 0) {
      console.log('[Campaigns] Products not loaded, loading now...');
      await this.loadProducts();
    }
    
    const form = document.getElementById('campaign-form');
    if (form) form.reset();
    
    this.resetUploadUI();
    
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
    }
    
    this.attachPreviewListeners();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.updatePreview();
  },
  
  attachPreviewListeners: function() {
    const fields = ['camp-name', 'camp-headline', 'camp-description', 'camp-cta-text'];
    fields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.removeEventListener('input', this.previewHandler);
        element.addEventListener('input', () => this.updatePreview());
      }
    });
  },
  
  previewHandler: function() {
    if (window.SupplierCampaigns) window.SupplierCampaigns.updatePreview();
  },
  
  resetUploadUI: function() {
    const dropzone = document.getElementById('campaign-dropzone');
    const fileInput = document.getElementById('campaign-media');
    if (fileInput) fileInput.value = '';
    if (dropzone) {
      dropzone.innerHTML = `
        <input type="file" id="campaign-media" class="hidden" accept="image/*" onchange="handleCampaignMedia(event)">
        <div id="campaign-media-placeholder">
          <i class="fas fa-cloud-upload-alt text-2xl text-slate-500 mb-2"></i>
          <p class="text-slate-400 text-xs">Cliquez ou glissez votre fichier ici</p>
          <p class="text-slate-600 text-xs mt-1">Max 5MB (image) ou 50MB (vidéo)</p>
        </div>`;
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
      dropzone.classList.add('border-slate-700');
    }
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
    if (headlineField && campaign.headline) headlineField.value = campaign.headline;
    if (descField && campaign.description) descField.value = campaign.description;
    if (ctaTextField && campaign.cta_text) ctaTextField.value = campaign.cta_text;
    if (startDateField && campaign.start_date) startDateField.value = campaign.start_date.split('T')[0];
    if (endDateField && campaign.end_date) endDateField.value = campaign.end_date.split('T')[0];
    if (ctaLinkField && campaign.cta_link) ctaLinkField.value = campaign.cta_link;
    
    if (campaign.media_type) {
      this.state.currentMediaType = campaign.media_type;
      const radio = document.querySelector(`[name="media_type"][value="${campaign.media_type}"]`);
      if (radio) radio.checked = true;
    }
    
    if (campaign.media_url) {
      this.state.uploadedMedia = {
        isNew: false,
        existingUrl: campaign.media_url,
        existingType: campaign.media_type
      };
      this.showMediaPreview(campaign.media_url, campaign.media_type);
    }
  },
  
  showModalStats: function(campaign) {
    const statsContainer = document.getElementById('campaign-quick-stats');
    if (!statsContainer) return;
    statsContainer.classList.remove('hidden');
    
    const viewsEl = document.getElementById('modal-ad-views');
    const clicksEl = document.getElementById('modal-ad-clicks');
    const ctrEl = document.getElementById('modal-ad-ctr');
    
    const views = parseInt(campaign.views_count) || 0;
    const clicks = parseInt(campaign.clicks_count) || 0;
    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : 0;
    
    if (viewsEl) viewsEl.textContent = views.toLocaleString();
    if (clicksEl) clicksEl.textContent = clicks.toLocaleString();
    if (ctrEl) ctrEl.textContent = ctr + '%';
  },
  
  hideModalStats: function() {
    const statsContainer = document.getElementById('campaign-quick-stats');
    if (statsContainer) statsContainer.classList.add('hidden');
  },
  
  closeModal: function() {
    const modal = document.getElementById('campaign-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    this.state.editingCampaignId = null;
    this.state.uploadedMedia = null;
  },
  
  handleMediaSelect: function(event) {
    console.log('[Campaigns] File selected:', event);
    const file = event.target.files[0];
    if (!file) { 
      console.log('[Campaigns] No file selected'); 
      return; 
    }
    
    const maxSize = this.state.currentMediaType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showToast(`Fichier trop grand (max ${this.state.currentMediaType === 'video' ? '50' : '5'}MB)`, 'error');
      return;
    }
    
    if (this.state.currentMediaType === 'image' && !file.type.startsWith('image/')) {
      this.showToast('Veuillez sélectionner une image', 'error'); 
      return;
    }
    if (this.state.currentMediaType === 'video' && !file.type.startsWith('video/')) {
      this.showToast('Veuillez sélectionner une vidéo', 'error'); 
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
        resolve(video.duration <= 15);
      };
      video.onerror = () => resolve(false);
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
          <button type="button" onclick="event.stopPropagation(); SupplierCampaigns.removeMedia()" class="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg">
            <i class="fas fa-times text-xs"></i>
          </button>
        </div>`;
    } else {
      dropzone.innerHTML = `
        <div class="relative w-full">
          <img src="${url}" class="w-full h-32 object-cover rounded-lg">
          <button type="button" onclick="event.stopPropagation(); SupplierCampaigns.removeMedia()" class="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg">
            <i class="fas fa-times text-xs"></i>
          </button>
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
  
  uploadMediaToCloudinary: async function() {
    if (!this.state.uploadedMedia || !this.state.uploadedMedia.isNew) {
      if (this.state.uploadedMedia && this.state.uploadedMedia.existingUrl) {
        return { url: this.state.uploadedMedia.existingUrl, type: this.state.uploadedMedia.existingType };
      }
      return null;
    }
    
    const file = this.state.uploadedMedia.file;
    const type = this.state.uploadedMedia.type;
    console.log('[Campaigns Upload] Starting upload:', file.name, type);
    
    const formData = new FormData();
    formData.append('media', file);
    
    try {
      this.showLoading(true);
      const result = type === 'video' 
        ? await BrandiaAPI.Upload.uploadVideo(formData)
        : await BrandiaAPI.Upload.uploadImage(formData);
      
      console.log('[Campaigns Upload] Success:', result);
      if (result && result.success) {
        const mediaUrl = result.data?.url || result.data?.secure_url;
        if (!mediaUrl) throw new Error('URL média non trouvée dans la réponse');
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
  
  showLoading: function(show) {
    this.state.isLoading = show;
    if (window.showLoading) { 
      window.showLoading(show); 
    } else {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.classList.toggle('hidden', !show);
    }
  },
  
  updatePreview: function() {
    try {
      const nameField = document.getElementById('camp-name');
      const headlineField = document.getElementById('camp-headline');
      const descField = document.getElementById('camp-description');
      const ctaField = document.getElementById('camp-cta-text');
      
      const name = nameField?.value || '';
      const headline = headlineField?.value || 'Votre titre';
      const description = descField?.value || 'Description de votre offre...';
      const ctaText = ctaField?.value || "Voir l'offre";
      
      const headlineEl = document.getElementById('ad-preview-headline');
      const descEl = document.getElementById('ad-preview-desc');
      const ctaEl = document.getElementById('ad-preview-cta');
      const mediaEl = document.getElementById('ad-preview-media');
      
      if (headlineEl) headlineEl.textContent = headline;
      if (descEl) descEl.textContent = description;
      if (ctaEl) ctaEl.textContent = ctaText;
      
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
  
  save: async function() {
    console.log('[Campaigns] ========== SAVE STARTED ==========');
    if (this.state.isLoading) {
      console.log('[Campaigns] Save already in progress, ignoring');
      return;
    }
    
    try {
      // Utiliser les IDs corrigés des champs
      const nameField = document.getElementById('camp-name');
      const headlineField = document.getElementById('camp-headline');
      const descField = document.getElementById('camp-description');
      const startDateField = document.getElementById('camp-start-date');
      const endDateField = document.getElementById('camp-end-date');
      const ctaTextField = document.getElementById('camp-cta-text');
      const ctaLinkField = document.getElementById('camp-cta-link');
      
      const name = nameField?.value?.trim();
      const headline = headlineField?.value?.trim();
      const description = descField?.value?.trim() || '';
      const startDate = startDateField?.value;
      const endDate = endDateField?.value;
      const ctaText = ctaTextField?.value?.trim() || "Voir l'offre";
      const ctaLink = ctaLinkField?.value?.trim();
      
      // Validation
      if (!name) { 
        this.showToast('Le nom de la campagne est requis', 'error'); 
        nameField?.focus(); 
        return; 
      }
      if (!headline) { 
        this.showToast('Le titre principal est requis', 'error'); 
        headlineField?.focus(); 
        return; 
      }
      if (!ctaLink) { 
        this.showToast('Le lien de destination est requis', 'error'); 
        ctaLinkField?.focus(); 
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
      
      const campaignData = {
        name: name, 
        type: 'overlay', 
        media_url: mediaUrl, 
        media_type: mediaType,
        headline: headline, 
        description: description, 
        cta_text: ctaText, 
        cta_link: ctaLink,
        target_products: null,
        start_date: startDate, 
        end_date: endDate, 
        status: 'active'
      };
      
      console.log('[Campaigns] Sending data:', campaignData);
      this.showLoading(true);
      
      let response;
      if (this.state.editingCampaignId) {
        response = await BrandiaAPI.Supplier.updateCampaign(this.state.editingCampaignId, campaignData);
      } else {
        response = await BrandiaAPI.Supplier.createCampaign(campaignData);
      }
      
      this.showLoading(false);
      
      if (response && response.success) {
        this.showToast(this.state.editingCampaignId ? 'Campagne mise à jour' : 'Campagne créée avec succès !', 'success');
        this.closeModal();
        await this.loadCampaigns();
      } else { 
        throw new Error(response?.message || 'Erreur serveur inconnue'); 
      }
      
    } catch (error) {
      console.error('[Campaigns] Save error:', error);
      this.showLoading(false);
      this.showToast('Erreur: ' + (error.message || 'Erreur inconnue'), 'error');
    }
  },
  
  editCampaign: function(id) { 
    this.openModal(id); 
  },
  
  toggleStatus: async function(id, newStatus) {
    try {
      const response = await BrandiaAPI.Supplier.updateCampaign(id, { status: newStatus });
      if (response && response.success) {
        this.showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
        await this.loadCampaigns();
      } else { 
        throw new Error(response?.message || 'Erreur inconnue'); 
      }
    } catch (error) { 
      this.showToast('Erreur: ' + (error.message || 'Erreur inconnue'), 'error'); 
    }
  },
  
  deleteCampaign: async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
    try {
      const response = await BrandiaAPI.Supplier.deleteCampaign(id);
      if (response && response.success) { 
        this.showToast('Campagne supprimée', 'success'); 
        await this.loadCampaigns(); 
      }
      else { 
        throw new Error(response?.message || 'Erreur inconnue'); 
      }
    } catch (error) { 
      this.showToast('Erreur: ' + (error.message || 'Erreur inconnue'), 'error'); 
    }
  },
  
  initChart: function() {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) return;
    if (this.state.chart) this.state.chart.destroy();
    
    this.state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Vues', data: [], borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.4 },
          { label: 'Clics', data: [], borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  },
  
  updateChart: function() {
    if (!this.state.chart) return;
    const labels = [], viewsData = [], clicksData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(); 
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
      const totalViews = this.state.campaigns.reduce((sum, c) => sum + (c.views_count || 0), 0);
      const totalClicks = this.state.campaigns.reduce((sum, c) => sum + (c.clicks_count || 0), 0);
      viewsData.push(Math.floor(totalViews / 30 * (0.5 + Math.random())));
      clicksData.push(Math.floor(totalClicks / 30 * (0.5 + Math.random())));
    }
    this.state.chart.data.labels = labels;
    this.state.chart.data.datasets[0].data = viewsData;
    this.state.chart.data.datasets[1].data = clicksData;
    this.state.chart.update();
  },
  
  formatDate: function(dateString) {
    if (!dateString) return '--';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return '--';
    }
  },
  
  showToast: function(message, type) {
    type = type || 'success';
    if (window.showToast) { 
      window.showToast(message, type); 
    } else { 
      console.log(`[${type}] ${message}`); 
    }
  }
};

// ==========================================
// FONCTIONS GLOBALES (wrappers)
// ==========================================

window.openCampaignModal = function() { 
  if (window.SupplierCampaigns) SupplierCampaigns.openModal(); 
};

window.saveCampaignForm = function() { 
  if (window.SupplierCampaigns) SupplierCampaigns.save(); 
};

window.closeCampaignModal = function() {
  if (window.SupplierCampaigns) SupplierCampaigns.closeModal();
};

window.toggleCampaignStatus = function(id, status) { 
  if (window.SupplierCampaigns) SupplierCampaigns.toggleStatus(id, status); 
};

window.deleteCampaign = function(id) { 
  if (window.SupplierCampaigns) SupplierCampaigns.deleteCampaign(id); 
};

window.editCampaign = function(id) { 
  if (window.SupplierCampaigns) SupplierCampaigns.editCampaign(id); 
};

window.handleCampaignMedia = function(e) { 
  if (window.SupplierCampaigns) SupplierCampaigns.handleMediaSelect(e); 
};

window.updateAdPreview = function() { 
  if (window.SupplierCampaigns) SupplierCampaigns.updatePreview(); 
};

window.toggleMediaType = function(type) { 
  if (window.SupplierCampaigns) SupplierCampaigns.toggleMediaType(type); 
};