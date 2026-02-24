// ============================================
// SUPPLIER CAMPAIGNS MODULE - v5.6 CORRIGÉ
// Upload Cloudinary fonctionnel + Corrections CTA, Save, Description
// ============================================

window.SupplierCampaigns = {
  state: {
    campaigns: [],
    products: [],
    chart: null,
    currentMediaType: 'image',
    uploadedMedia: null,
    editingCampaignId: null,
    currentChartData: null
  },

  FALLBACK_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzNDE1NSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DYW1wYWduZTwvdGV4dD48L3N2Zz4=',

  // ==========================================
  // INITIALISATION
  // ==========================================
  
  init: async function() {
    console.log('[Campaigns] Initializing v5.6...');
    await this.loadProducts();
    await this.loadCampaigns();
    this.initChart();
  },

  loadProducts: async function() {
    try {
      console.log('[Campaigns] Loading products...');
      const response = await BrandiaAPI.Supplier.getProducts();
      console.log('[Campaigns] Products API response:', response);
      
      let productsArray = [];
      
      if (response.success && response.data) {
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
      
      if (response.success) {
        this.state.campaigns = response.data || [];
        console.log('[Campaigns] Loaded:', this.state.campaigns.length);
        this.renderList();
        this.updateStats();
        this.updateChart();
      } else {
        console.error('[Campaigns] API error:', response.message);
        this.showToast('Erreur chargement campagnes: ' + response.message, 'error');
      }
    } catch (error) {
      console.error('[Campaigns] Load error:', error);
      this.showToast('Erreur chargement campagnes', 'error');
    }
  },

  // ==========================================
  // RENDU LISTE CAMPAGNES
  // ==========================================
  
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
          <button onclick="SupplierCampaigns.openModal()" 
                  class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all">
            <i class="fas fa-plus mr-2"></i>Créer une campagne
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    for (const c of this.state.campaigns) {
      const targetCount = (c.target_products && c.target_products.length) || 0;
      const ctr = c.views_count > 0 ? ((c.clicks_count / c.views_count) * 100).toFixed(1) : 0;
      const mediaUrl = c.media_url || this.FALLBACK_IMAGE;
      
      html += `
        <div class="campaign-row p-6 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 group">
          <div class="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
            ${c.media_type === 'video' 
              ? `<div class="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                   <i class="fas fa-play-circle text-white text-2xl"></i>
                 </div>
                 <video src="${mediaUrl}" class="w-full h-full object-cover" muted></video>`
              : `<img src="${mediaUrl}" class="w-full h-full object-cover" 
                      onerror="this.src='${this.FALLBACK_IMAGE}'">`
            }
            ${c.status === 'active' 
              ? '<span class="absolute top-1 left-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse z-20"></span>' 
              : ''}
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-semibold text-white truncate">${c.name || 'Sans nom'}</h4>
              <span class="badge badge-${c.status || 'active'} text-xs capitalize">${c.status || 'active'}</span>
              ${c.status === 'active' ? '<span class="text-xs text-emerald-400">• En ligne</span>' : ''}
            </div>
            <p class="text-sm text-slate-400 mb-2 truncate">${c.headline || ''}</p>
            <div class="flex items-center gap-4 text-xs text-slate-500">
              <span><i class="fas fa-crosshairs mr-1"></i>${targetCount} produits</span>
              <span><i class="fas fa-calendar mr-1"></i>${this.formatDate(c.start_date)} - ${this.formatDate(c.end_date)}</span>
              ${c.media_type === 'video' 
                ? '<span><i class="fas fa-video mr-1"></i>Vidéo</span>' 
                : '<span><i class="fas fa-image mr-1"></i>Image</span>'}
            </div>
          </div>
          
          <div class="text-right">
            <div class="flex items-center gap-4 mb-2">
              <div class="text-center">
                <p class="text-lg font-bold text-white">${parseInt(c.views_count) || 0}</p>
                <p class="text-xs text-slate-500">Vues</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-indigo-400">${parseInt(c.clicks_count) || 0}</p>
                <p class="text-xs text-slate-500">Clics</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-emerald-400">${ctr}%</p>
                <p class="text-xs text-slate-500">CTR</p>
              </div>
            </div>
            <div class="flex gap-2 justify-end">
              <button onclick="event.stopPropagation(); SupplierCampaigns.editCampaign(${c.id})" 
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                <i class="fas fa-edit mr-1"></i>Modifier
              </button>
              <button onclick="event.stopPropagation(); SupplierCampaigns.toggleStatus(${c.id}, '${c.status === 'active' ? 'paused' : 'active'}')" 
                      class="px-3 py-1.5 rounded-lg text-xs font-medium ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-colors">
                ${c.status === 'active' 
                  ? '<i class="fas fa-pause mr-1"></i>Pause' 
                  : '<i class="fas fa-play mr-1"></i>Activer'}
              </button>
              <button onclick="event.stopPropagation(); SupplierCampaigns.deleteCampaign(${c.id})" 
                      class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
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

  // ==========================================
  // MODAL & FORMULAIRE - CORRIGÉ
  // ==========================================
  
  openModal: async function(campaignId = null) {
    console.log('[Campaigns] Opening modal, editing:', campaignId);
    
    this.state.editingCampaignId = campaignId;
    this.state.uploadedMedia = null;
    this.state.currentMediaType = 'image';
    
    const modal = document.getElementById('campaign-modal');
    if (!modal) {
      console.error('[Campaigns] Modal not found');
      return;
    }
    
    // 🔥 S'assurer que les produits sont chargés
    if (!this.state.products || this.state.products.length === 0) {
      console.log('[Campaigns] Products not loaded, loading now...');
      await this.loadProducts();
    }
    
    // Reset form
    const form = document.getElementById('campaign-form');
    if (form) {
      form.reset();
      console.log('[Campaigns] Form reset');
    }
    
    // Reset UI upload
    this.resetUploadUI();
    
    // Charger liste produits pour ciblage et CTA
    this.renderTargetProductsList();
    this.renderCtaProductSelect();
    
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
      
      // Dates par défaut
      const startInput = this.getFormField('start_date');
      const endInput = this.getFormField('end_date');
      if (startInput) startInput.value = today;
      if (endInput) endInput.value = nextMonth.toISOString().split('T')[0];
      
      // Reset CTA à product par défaut
      const ctaTypeSelect = document.getElementById('cta-link-type');
      if (ctaTypeSelect) {
        ctaTypeSelect.value = 'product';
        this.handleCtaType('product');
      }
    }
    
    // 🔥 AJOUT: Écouteurs pour la preview en temps réel
    this.attachPreviewListeners();
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    this.updatePreview();
  },

  // 🔥 NOUVELLE MÉTHODE: Attacher les écouteurs d'événements
  attachPreviewListeners: function() {
    const fields = ['name', 'headline', 'description', 'cta_text'];
    
    fields.forEach(fieldName => {
      const field = this.getFormField(fieldName);
      if (field) {
        // Retirer l'ancien écouteur s'il existe (pour éviter les doublons)
        field.removeEventListener('input', this.previewHandler);
        // Ajouter le nouvel écouteur
        field.addEventListener('input', () => this.updatePreview());
      }
    });
  },

  // 🔥 NOUVELLE MÉTHODE: Handler pour la preview (référence pour removeEventListener)
  previewHandler: function() {
    window.SupplierCampaigns.updatePreview();
  },

  // 🔥 CORRECTION: getFormField cherche UNIQUEMENT dans le modal campagne
  getFormField: function(fieldName) {
    const modal = document.getElementById('campaign-modal');
    if (!modal) {
      console.error('[Campaigns] Modal not found for getFormField');
      return null;
    }
    
    const field = modal.querySelector(`[name="${fieldName}"]`);
    if (!field) {
      console.warn(`[Campaigns] Field "${fieldName}" not found in campaign modal`);
    }
    return field;
  },

  resetUploadUI: function() {
    const dropzone = document.getElementById('campaign-dropzone');
    const fileInput = document.getElementById('campaign-media');
    
    if (fileInput) {
      fileInput.value = '';
    }
    
    if (dropzone) {
      dropzone.innerHTML = `
        <div id="campaign-media-placeholder">
          <i class="fas fa-cloud-upload-alt text-3xl text-slate-500 mb-3"></i>
          <p class="text-slate-400 text-sm">Cliquez ou glissez votre fichier ici</p>
          <p class="text-slate-600 text-xs mt-1">Format recommandé: 1200x800px, max 5MB (image) ou 50MB (vidéo)</p>
        </div>
      `;
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
      dropzone.classList.add('border-slate-700');
    }
  },

  fillFormForEdit: function(campaign) {
    const fields = ['name', 'headline', 'description', 'cta_text', 'start_date', 'end_date'];
    fields.forEach(field => {
      const input = this.getFormField(field);
      if (input && campaign[field]) input.value = campaign[field];
    });
    
    // CTA Link
    if (campaign.cta_link) {
      const ctaTypeSelect = document.getElementById('cta-link-type');
      if (ctaTypeSelect) {
        if (campaign.cta_link.startsWith('http')) {
          ctaTypeSelect.value = 'external';
          const externalInput = document.getElementById('cta-external-url');
          if (externalInput) {
            externalInput.value = campaign.cta_link;
          }
          this.handleCtaType('external');
        } else {
          ctaTypeSelect.value = 'product';
          const productSelect = document.getElementById('cta-product-select');
          if (productSelect) {
            productSelect.value = campaign.cta_link;
          }
          this.handleCtaType('product');
        }
      }
    }
    
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
    
    if (campaign.target_products && Array.isArray(campaign.target_products)) {
      setTimeout(() => {
        campaign.target_products.forEach(pid => {
          const checkbox = document.querySelector(`input[name="target_product_${pid}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }, 100);
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

  // ==========================================
  // GESTION MÉDIAS
  // ==========================================
  
  handleMediaSelect: function(event) {
    console.log('[Campaigns] File selected:', event);
    const file = event.target.files[0];
    if (!file) {
      console.log('[Campaigns] No file selected');
      return;
    }
    
    console.log('[Campaigns] File details:', file.name, file.type, file.size);

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
          <video src="${url}" class="w-full h-48 object-cover rounded-lg" controls muted></video>
          <button type="button" onclick="event.stopPropagation(); SupplierCampaigns.removeMedia()" 
                  class="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    } else {
      dropzone.innerHTML = `
        <div class="relative w-full">
          <img src="${url}" class="w-full h-48 object-cover rounded-lg">
          <button type="button" onclick="event.stopPropagation(); SupplierCampaigns.removeMedia()" 
                  class="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-lg">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
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

  // ==========================================
  // UPLOAD CLOUDINARY
  // ==========================================
  
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
    
    console.log('[Campaigns Upload] Starting upload:', file.name, type);

    const formData = new FormData();
    formData.append('media', file);

    try {
      this.showLoading(true);
      
      const endpoint = type === 'video' ? '/supplier/upload-video' : '/supplier/upload-image';
      const fullUrl = BrandiaAPI.config.apiURL + endpoint;
      
      console.log('[Campaigns Upload] URL:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: formData
      });

      console.log('[Campaigns Upload] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Campaigns Upload] Server error:', errorText);
        throw new Error('Erreur serveur ' + response.status + ': ' + errorText);
      }

      const result = await response.json();
      console.log('[Campaigns Upload] Success:', result);

      if (result.success) {
        const mediaUrl = result.data?.url || result.data?.secure_url;
        if (!mediaUrl) throw new Error('URL média non trouvée dans la réponse');
        
        return { url: mediaUrl, type: type };
      } else {
        throw new Error(result.message || 'Erreur upload');
      }
    } catch (error) {
      console.error('[Campaigns Upload] Error:', error);
      throw error;
    } finally {
      this.showLoading(false);
    }
  },

  showLoading: function(show) {
    if (window.showLoading) {
      window.showLoading(show);
    } else {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.classList.toggle('hidden', !show);
    }
  },

  // ==========================================
  // CIBLAGE PRODUITS
  // ==========================================
  
  renderTargetProductsList: function() {
    const container = document.getElementById('target-products-list');
    if (!container) return;
    
    if (!this.state.products || this.state.products.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-slate-500 text-sm">Aucun produit disponible</div>';
      return;
    }
    
    let html = '';
    for (const p of this.state.products) {
      const imageUrl = p.main_image_url || this.FALLBACK_IMAGE;
      html += `
        <label class="flex items-center gap-3 p-2 hover:bg-slate-700 rounded cursor-pointer">
          <input type="checkbox" name="target_product_${p.id}" value="${p.id}" 
                 class="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500">
          <img src="${imageUrl}" class="w-10 h-10 rounded object-cover" onerror="this.src='${this.FALLBACK_IMAGE}'">
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">${p.name}</p>
            <p class="text-xs text-slate-500">${parseFloat(p.price).toFixed(2)} €</p>
          </div>
        </label>
      `;
    }
    
    container.innerHTML = html;
  },

  renderCtaProductSelect: function() {
    const select = document.getElementById('cta-product-select');
    if (!select) {
      console.error('[Campaigns] CTA product select not found');
      return;
    }
    
    select.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choisir un produit...';
    select.appendChild(defaultOption);
    
    if (!this.state.products || this.state.products.length === 0) {
      defaultOption.textContent = 'Aucun produit disponible';
      return;
    }
    
    for (const p of this.state.products) {
      const option = document.createElement('option');
      option.value = `/product.html?id=${p.id}`;
      option.textContent = `${p.name} - ${parseFloat(p.price).toFixed(2)} €`;
      select.appendChild(option);
    }
    
    console.log('[Campaigns] CTA select populated with', this.state.products.length, 'products');
  },

  handleCtaType: function(type) {
    console.log('[Campaigns] handleCtaType called with:', type);
    
    const productSelect = document.getElementById('cta-product-select');
    const externalUrl = document.getElementById('cta-external-url');
    
    if (!productSelect || !externalUrl) {
      console.error('[Campaigns] CTA elements not found');
      return;
    }
    
    if (type === 'external') {
      productSelect.classList.add('hidden');
      productSelect.required = false;
      productSelect.value = '';
      
      externalUrl.classList.remove('hidden');
      externalUrl.required = true;
      externalUrl.focus();
    } else {
      externalUrl.classList.add('hidden');
      externalUrl.required = false;
      externalUrl.value = '';
      
      productSelect.classList.remove('hidden');
      productSelect.required = true;
    }
    
    console.log('[Campaigns] CTA type changed to:', type);
  },

  // 🔥 CORRECTION: updatePreview avec protection try-catch
  updatePreview: function() {
    try {
      const headline = this.getFormField('headline')?.value || 'Votre titre';
      const description = this.getFormField('description')?.value || 'Description de votre offre...';
      const ctaText = this.getFormField('cta_text')?.value || "Voir l'offre";
      
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
        mediaEl.innerHTML = '<i class="fas fa-image text-slate-500 text-2xl"></i>';
      }
    } catch (error) {
      console.error('[Campaigns] updatePreview error:', error);
      // Ne pas bloquer la saisie
    }
  },

  // ==========================================
  // SAUVEGARDE CAMPAGNE - v5.6 CORRIGÉ
  // ==========================================
  
  save: async function() {
    console.log('[Campaigns] ========== SAVE STARTED ==========');
    
    try {
      // 🔥 CORRECTION: Utiliser getFormField pour chercher UNIQUEMENT dans le modal
      const nameField = this.getFormField('name');
      const headlineField = this.getFormField('headline');
      const startDateField = this.getFormField('start_date');
      const endDateField = this.getFormField('end_date');
      
      console.log('[Campaigns] Fields found via getFormField:', {
        name: !!nameField,
        headline: !!headlineField,
        startDate: !!startDateField,
        endDate: !!endDateField
      });
      
      const name = nameField?.value?.trim();
      const headline = headlineField?.value?.trim();
      const startDate = startDateField?.value;
      const endDate = endDateField?.value;
      
      console.log('[Campaigns] Final values:', { name, headline, startDate, endDate });

      // Validation
      if (!name) {
        console.error('[Campaigns] Validation failed: name empty');
        this.showToast('Le nom de la campagne est requis', 'error');
        nameField?.focus();
        return false;
      }
      
      if (!headline) {
        console.error('[Campaigns] Validation failed: headline empty');
        this.showToast('Le titre principal est requis', 'error');
        headlineField?.focus();
        return false;
      }
      
      if (!startDate || !endDate) {
        console.error('[Campaigns] Validation failed: dates empty');
        this.showToast('Les dates de début et fin sont requises', 'error');
        return false;
      }
      
      if (new Date(endDate) <= new Date(startDate)) {
        this.showToast('La date de fin doit être après la date de début', 'error');
        return false;
      }

      // CTA Link
      const ctaTypeSelect = document.getElementById('cta-link-type');
      const ctaType = ctaTypeSelect?.value || 'product';
      
      console.log('[Campaigns] CTA type:', ctaType);
      
      let ctaLink = '';
      let ctaSourceElement = null;

      if (ctaType === 'external') {
        ctaSourceElement = document.getElementById('cta-external-url');
        ctaLink = ctaSourceElement?.value?.trim();
      } else {
        ctaSourceElement = document.getElementById('cta-product-select');
        ctaLink = ctaSourceElement?.value;
        console.log('[Campaigns] Product select value:', ctaLink);
      }

      if (!ctaLink) {
        this.showToast('Veuillez sélectionner un produit ou entrer un lien de destination', 'error');
        ctaSourceElement?.focus();
        return false;
      }

      // Produits ciblés
      const targetProducts = [];
      const checkboxes = document.querySelectorAll('input[name^="target_product_"]:checked');
      console.log('[Campaigns] Target checkboxes found:', checkboxes.length);
      
      checkboxes.forEach(cb => {
        const productId = parseInt(cb.value);
        if (!isNaN(productId)) {
          targetProducts.push(productId);
        }
      });
      
      console.log('[Campaigns] Target products:', targetProducts);

      if (targetProducts.length === 0) {
        this.showToast('Sélectionnez au moins un produit cible', 'error');
        return false;
      }

      // Upload média
      let mediaUrl = null;
      let mediaType = this.state.currentMediaType;

      if (this.state.uploadedMedia?.isNew) {
        console.log('[Campaigns] Uploading new media...');
        try {
          this.showLoading(true);
          const uploadResult = await this.uploadMediaToCloudinary();
          if (uploadResult) {
            mediaUrl = uploadResult.url;
            mediaType = uploadResult.type;
          }
        } catch (err) {
          this.showLoading(false);
          this.showToast('Erreur upload: ' + err.message, 'error');
          return false;
        }
      } else if (this.state.uploadedMedia?.existingUrl) {
        mediaUrl = this.state.uploadedMedia.existingUrl;
        mediaType = this.state.uploadedMedia.existingType;
      }

      if (!mediaUrl && !this.state.editingCampaignId) {
        this.showToast('Une image ou vidéo est requise', 'error');
        return false;
      }

      const campaignData = {
        name: name,
        type: 'overlay',
        media_url: mediaUrl,
        media_type: mediaType,
        headline: headline,
        description: this.getFormField('description')?.value?.trim() || '',
        cta_text: this.getFormField('cta_text')?.value?.trim() || "Voir l'offre",
        cta_link: ctaLink,
        target_products: targetProducts,
        start_date: startDate,
        end_date: endDate,
        status: 'active'
      };

      console.log('[Campaigns] Sending data:', campaignData);

      this.showLoading(true);
      
      let response;
      if (this.state.editingCampaignId) {
        console.log('[Campaigns] Updating campaign:', this.state.editingCampaignId);
        response = await BrandiaAPI.Supplier.updateCampaign(this.state.editingCampaignId, campaignData);
      } else {
        console.log('[Campaigns] Creating new campaign');
        response = await BrandiaAPI.Supplier.createCampaign(campaignData);
      }
      
      this.showLoading(false);
      
      console.log('[Campaigns] Response:', response);

      if (response.success) {
        this.showToast(this.state.editingCampaignId ? 'Campagne mise à jour' : 'Campagne créée avec succès !', 'success');
        this.closeModal();
        await this.loadCampaigns();
      } else {
        throw new Error(response.message || 'Erreur serveur');
      }
      
    } catch (error) {
      console.error('[Campaigns] Save error:', error);
      this.showLoading(false);
      this.showToast('Erreur: ' + error.message, 'error');
    }
  },

  // ==========================================
  // ACTIONS CAMPAGNES
  // ==========================================
  
  editCampaign: function(id) {
    this.openModal(id);
  },

  toggleStatus: async function(id, newStatus) {
    try {
      const response = await BrandiaAPI.Supplier.updateCampaign(id, { status: newStatus });
      
      if (response.success) {
        this.showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
        await this.loadCampaigns();
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('[Campaigns] Toggle status error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
    }
  },

  deleteCampaign: async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
    
    try {
      const response = await BrandiaAPI.Supplier.deleteCampaign(id);
      
      if (response.success) {
        this.showToast('Campagne supprimée', 'success');
        await this.loadCampaigns();
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('[Campaigns] Delete error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
    }
  },

  // ==========================================
  // GRAPHIQUE PERFORMANCE
  // ==========================================
  
  initChart: function() {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) return;
    
    if (this.state.chart) {
      this.state.chart.destroy();
    }
    
    this.state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Vues',
          data: [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }, {
          label: 'Clics',
          data: [],
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true }
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
  },

  updateChart: function() {
    if (!this.state.chart) return;
    
    const labels = [];
    const viewsData = [];
    const clicksData = [];
    
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

  // ==========================================
  // UTILITAIRES
  // ==========================================
  
  formatDate: function(dateString) {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  showToast: function(message, type) {
    type = type || 'success';
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log('[' + type + '] ' + message);
    }
  }
};

// ==========================================
// FONCTIONS GLOBALES
// ==========================================

window.openCampaignModal = function() {
  console.log('[Global] openCampaignModal called');
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.openModal();
  } else {
    console.error('[Global] SupplierCampaigns not found');
  }
};

window.saveCampaign = function() {
  console.log('[Global] saveCampaign called');
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.save();
  } else {
    console.error('[Global] SupplierCampaigns not found');
  }
};

window.closeModal = function(modalId) {
  if (modalId === 'campaign-modal' && window.SupplierCampaigns) {
    window.SupplierCampaigns.closeModal();
  } else {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
};

window.toggleCampaignStatus = function(id, status) {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.toggleStatus(id, status);
  }
};

window.deleteCampaign = function(id) {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.deleteCampaign(id);
  }
};

window.editCampaign = function(id) {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.editCampaign(id);
  }
};

window.handleCampaignMedia = function(e) {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.handleMediaSelect(e);
  }
};

window.updateAdPreview = function() {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.updatePreview();
  }
};

window.toggleMediaType = function(type) {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.toggleMediaType(type);
  }
};

window.handleCtaType = function(type) {
  console.log('[Global] handleCtaType called with:', type);
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.handleCtaType(type);
  } else {
    console.error('[Global] SupplierCampaigns not found');
  }
};