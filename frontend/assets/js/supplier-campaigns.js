// ============================================
// SUPPLIER CAMPAIGNS MODULE - v5.1 CORRIGÉ
// Upload Cloudinary fonctionnel
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
    console.log('[Campaigns] Initializing v5.1...');
    await this.loadProducts();
    await this.loadCampaigns();
    this.initChart();
  },

  loadProducts: async function() {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      console.log('[Campaigns] Products response:', response);
      
      let productsArray = [];
      if (response.data && Array.isArray(response.data)) {
        productsArray = response.data;
      } else if (response.data && response.data.products && Array.isArray(response.data.products)) {
        productsArray = response.data.products;
      }
      
      this.state.products = productsArray;
      console.log('[Campaigns] Loaded products:', this.state.products.length);
    } catch (error) {
      console.error('[Campaigns] Error loading products:', error);
      this.state.products = [];
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
  
  openModal: function(campaignId = null) {
    this.state.editingCampaignId = campaignId;
    this.state.uploadedMedia = null;
    this.state.currentMediaType = 'image';
    
    const modal = document.getElementById('campaign-modal');
    if (!modal) {
      console.error('[Campaigns] Modal not found');
      return;
    }
    
    // Reset form
    const form = document.getElementById('campaign-form');
    if (form) form.reset();
    
    // Reset UI upload
    this.resetUploadUI();
    
    // Charger liste produits pour ciblage
    this.renderTargetProductsList();
    
    // Charger produits pour CTA
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
      
      const startInput = document.querySelector('[name="start_date"]');
      const endInput = document.querySelector('[name="end_date"]');
      if (startInput) startInput.value = today;
      if (endInput) endInput.value = nextMonth.toISOString().split('T')[0];
    }
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    this.updatePreview();
  },

  resetUploadUI: function() {
    // 🔥 CORRECTION CRITIQUE : Reset complet de la zone d'upload
    const dropzone = document.getElementById('campaign-dropzone');
    const fileInput = document.getElementById('campaign-media');
    
    if (fileInput) {
      fileInput.value = ''; // Reset input file
    }
    
    if (dropzone) {
      // Recréer le contenu initial
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
      const input = document.querySelector(`[name="${field}"]`);
      if (input && campaign[field]) input.value = campaign[field];
    });
    
    // CTA Link
    if (campaign.cta_link) {
      const ctaTypeSelect = document.querySelector('[name="cta_link_type"]');
      if (ctaTypeSelect) {
        if (campaign.cta_link.startsWith('http')) {
          ctaTypeSelect.value = 'external';
          const externalInput = document.getElementById('cta-external-url');
          if (externalInput) {
            externalInput.value = campaign.cta_link;
            externalInput.classList.remove('hidden');
          }
          const productSelect = document.getElementById('cta-product-select');
          if (productSelect) productSelect.classList.add('hidden');
        } else {
          ctaTypeSelect.value = 'product';
          const productSelect = document.getElementById('cta-product-select');
          if (productSelect) {
            productSelect.value = campaign.cta_link;
            productSelect.classList.remove('hidden');
          }
          const externalInput = document.getElementById('cta-external-url');
          if (externalInput) externalInput.classList.add('hidden');
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
    
    if (campaign.target_products) {
      setTimeout(() => {
        campaign.target_products.forEach(pid => {
          const checkbox = document.querySelector(`[name="target_product_${pid}"]`);
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
  // GESTION MÉDIAS - CORRIGÉ
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
  // UPLOAD CLOUDINARY - CORRIGÉ
  // ==========================================
  
  uploadMediaToCloudinary: async function() {
    // Si pas de nouveau média mais média existant en édition
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
    formData.append('media', file); // 🔥 'media' doit correspondre au nom dans multer

    try {
      this.showLoading(true);
      
      const endpoint = type === 'video' ? '/supplier/upload-video' : '/supplier/upload-image';
      const fullUrl = BrandiaAPI.config.apiURL + endpoint;
      
      console.log('[Campaigns Upload] URL:', fullUrl);
      console.log('[Campaigns Upload] Token:', localStorage.getItem('token') ? 'Present' : 'Missing');

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
          // Ne PAS mettre Content-Type, fetch le gère automatiquement pour FormData
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
    
    if (this.state.products.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-slate-500 text-sm">Aucun produit disponible</div>';
      return;
    }
    
    let html = '';
    for (const p of this.state.products) {
      html += `
        <label class="flex items-center gap-3 p-2 hover:bg-slate-700 rounded cursor-pointer">
          <input type="checkbox" name="target_product_${p.id}" value="${p.id}" 
                 class="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500">
          <img src="${p.main_image_url || this.FALLBACK_IMAGE}" class="w-10 h-10 rounded object-cover" onerror="this.src='${this.FALLBACK_IMAGE}'">
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
    if (!select) return;
    
    let html = '<option value="">Choisir un produit...</option>';
    for (const p of this.state.products) {
      html += `<option value="/product.html?id=${p.id}">${p.name} - ${parseFloat(p.price).toFixed(2)} €</option>`;
    }
    
    select.innerHTML = html;
  },

    handleCtaType: function(type) {
    const productSelect = document.getElementById('cta-product-select');
    const externalUrl = document.getElementById('cta-external-url');
    
    if (type === 'external') {
      if (productSelect) productSelect.classList.add('hidden');
      if (externalUrl) {
        externalUrl.classList.remove('hidden');
        externalUrl.required = true;
      }
    } else {
      // type === 'product'
      if (productSelect) {
        productSelect.classList.remove('hidden');
        productSelect.required = true;
      }
      if (externalUrl) {
        externalUrl.classList.add('hidden');
        externalUrl.required = false;
        externalUrl.value = ''; // Reset
      }
    }
  },
 
  updatePreview: function() {
    const headline = document.querySelector('[name="headline"]')?.value || 'Votre titre';
    const description = document.querySelector('[name="description"]')?.value || 'Description de votre offre...';
    const ctaText = document.querySelector('[name="cta_text"]')?.value || "Voir l'offre";
    
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
  },

  // ==========================================
  // SAUVEGARDE CAMPAGNE - CORRIGÉ v5.2
  // ==========================================
  
  save: async function() {
    try {
      console.log('[Campaigns] Starting save...');
      
      // Récupération des valeurs avec vérification
      const name = document.querySelector('[name="name"]')?.value?.trim();
      const headline = document.querySelector('[name="headline"]')?.value?.trim();
      const description = document.querySelector('[name="description"]')?.value?.trim() || '';
      const ctaText = document.querySelector('[name="cta_text"]')?.value?.trim() || "Voir l'offre";
      const startDate = document.querySelector('[name="start_date"]')?.value;
      const endDate = document.querySelector('[name="end_date"]')?.value;
      
      // 🔥 CORRECTION CTA Link - Récupérer la valeur correctement
      const ctaType = document.querySelector('[name="cta_link_type"]')?.value || 'product';
      let ctaLink = '';
      
      if (ctaType === 'external') {
        ctaLink = document.getElementById('cta-external-url')?.value?.trim() || '';
      } else if (ctaType === 'product') {
        const productSelect = document.getElementById('cta-product-select');
        ctaLink = productSelect?.value || '';
      } else if (ctaType === 'category') {
        // Si tu ajoutes des catégories plus tard
        ctaLink = '/catalogue.html';
      }
      
      console.log('[Campaigns] CTA Type:', ctaType, 'CTA Link:', ctaLink);

      // Validation
      if (!name) {
        this.showToast('Le nom de la campagne est requis', 'error');
        document.querySelector('[name="name"]')?.focus();
        return;
      }
      if (!headline) {
        this.showToast('Le titre principal est requis', 'error');
        document.querySelector('[name="headline"]')?.focus();
        return;
      }
      if (!ctaLink) {
        this.showToast('Le lien de destination est requis. Sélectionnez un produit ou entrez une URL.', 'error');
        return;
      }
      if (!startDate || !endDate) {
        this.showToast('Les dates de début et fin sont requises', 'error');
        return;
      }
      
      // Vérifier que la date de fin est après la date de début
      if (new Date(endDate) <= new Date(startDate)) {
        this.showToast('La date de fin doit être après la date de début', 'error');
        return;
      }

      // 🔥 CORRECTION: Récupérer les produits ciblés correctement
      const targetProducts = [];
      const checkboxes = document.querySelectorAll('input[name^="target_product_"]:checked');
      checkboxes.forEach(cb => {
        targetProducts.push(parseInt(cb.value));
      });
      
      console.log('[Campaigns] Target products selected:', targetProducts.length);

      if (targetProducts.length === 0) {
        this.showToast('Sélectionnez au moins un produit cible', 'error');
        return;
      }

      // Upload média si nouveau
      let mediaUrl = null;
      let mediaType = this.state.currentMediaType;
      
      // Vérifier si on a un média (nouveau ou existant)
      if (this.state.uploadedMedia) {
        if (this.state.uploadedMedia.isNew) {
          // Upload nécessaire
          try {
            this.showLoading(true);
            const uploadResult = await this.uploadMediaToCloudinary();
            if (uploadResult) {
              mediaUrl = uploadResult.url;
              mediaType = uploadResult.type;
            }
          } catch (uploadError) {
            console.error('[Campaigns] Upload failed:', uploadError);
            this.showToast('Erreur upload: ' + uploadError.message, 'error');
            this.showLoading(false);
            return;
          }
        } else if (this.state.uploadedMedia.existingUrl) {
          // Utiliser l'URL existante (mode édition)
          mediaUrl = this.state.uploadedMedia.existingUrl;
          mediaType = this.state.uploadedMedia.existingType;
        }
      }
      
      // Si création et pas de média, erreur
      if (!mediaUrl && !this.state.editingCampaignId) {
        this.showToast('Une image ou vidéo est requise', 'error');
        return;
      }

      // 🔥 CORRECTION: Construction des données avec les bonnes clés pour PostgreSQL
      const campaignData = {
        name: name,
        type: 'overlay',
        media_url: mediaUrl,
        media_type: mediaType,
        headline: headline,
        description: description,
        cta_text: ctaText,
        cta_link: ctaLink,
        target_products: targetProducts, // Array d'IDs
        start_date: startDate, // Format YYYY-MM-DD
        end_date: endDate,     // Format YYYY-MM-DD
        status: 'active'
      };
      
      console.log('[Campaigns] Saving data:', campaignData);

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
      
      console.log('[Campaigns] Save response:', response);

      if (response.success) {
        this.showToast(
          this.state.editingCampaignId ? 'Campagne mise à jour avec succès' : 'Campagne créée avec succès', 
          'success'
        );
        this.closeModal();
        await this.loadCampaigns(); // Recharger la liste
      } else {
        throw new Error(response.message || 'Erreur lors de la sauvegarde');
      }
      
    } catch (error) {
      console.error('[Campaigns] Save error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
      this.showLoading(false);
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
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.openModal();
  }
};

window.saveCampaign = function() {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.save();
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
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.handleCtaType(type);
  }
};