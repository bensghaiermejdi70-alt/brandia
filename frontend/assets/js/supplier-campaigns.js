// ============================================
// SUPPLIER CAMPAIGNS MODULE (Publicité) - v4.4 CORRIGÉ
// Corrections : Syntaxe compatible, pas d'optional chaining
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

  init: async function() {
    console.log('[Campaigns] Initializing v4.4...');
    await this.loadProducts();
    await this.loadCampaigns();
  },

  loadProducts: async function() {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      // 🔥 CORRECTION : Pas d'optional chaining
      this.state.products = (response.data && response.data.products) ? response.data.products : (response.data || []);
      console.log('[Campaigns] Loaded products:', this.state.products.length);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      this.state.products = [];
    }
  },

  loadCampaignForEdit: async function(campaignId) {
    try {
      console.log('[Campaigns] Loading campaign ' + campaignId + ' for edit...');
      
      if (this.state.products.length === 0) {
        console.log('[Campaigns] Products not loaded, loading now...');
        await this.loadProducts();
      }
      
      const campaign = this.state.campaigns.find(function(c) { return c.id === parseInt(campaignId); });
      
      if (!campaign) {
        throw new Error('Campagne non trouvée dans la liste locale');
      }

      this.state.editingCampaignId = campaignId;
      
      const form = document.getElementById('campaign-form');
      if (form) {
        form.reset();
        
        // Champs texte
        const fields = ['name', 'headline', 'description', 'cta_text'];
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          const input = form.querySelector('[name="' + field + '"]');
          if (input && campaign[field]) {
            input.value = campaign[field];
          }
        }

        // Dates
        const startDate = form.querySelector('[name="start_date"]');
        const endDate = form.querySelector('[name="end_date"]');
        if (startDate && campaign.start_date) {
          startDate.value = campaign.start_date.split('T')[0];
        }
        if (endDate && campaign.end_date) {
          endDate.value = campaign.end_date.split('T')[0];
        }

        // Type média
        this.state.currentMediaType = campaign.media_type || 'image';
        const mediaTypeInputs = form.querySelectorAll('input[name="media_type"]');
        for (let i = 0; i < mediaTypeInputs.length; i++) {
          mediaTypeInputs[i].checked = (mediaTypeInputs[i].value === this.state.currentMediaType);
        }

        // Lien CTA
        const ctaLinkValue = document.getElementById('cta-link-value');
        if (ctaLinkValue) ctaLinkValue.value = campaign.cta_link || '';

        // Setup CTA fields
        this.setupCtaFields(campaign.cta_link, campaign.target_products);

        // Rendre les produits avec sélection
        this.renderProductTargets(campaign.target_products || []);

        // Afficher média existant
        this.displayExistingMedia(campaign.media_url, campaign.media_type);
      }

      // Mettre à jour UI modal pour mode edit
      const modalTitle = document.querySelector('#campaign-modal h3');
      if (modalTitle) modalTitle.textContent = 'Modifier la campagne';
      
      const modalSubtitle = document.querySelector('#campaign-modal p.text-sm');
      if (modalSubtitle) modalSubtitle.textContent = 'Modifiez votre publicité contextuelle';

      const saveBtn = document.querySelector('#campaign-modal button[onclick="saveCampaign()"]');
      if (saveBtn) {
        saveBtn.textContent = 'Mettre à jour la campagne';
        saveBtn.classList.remove('from-pink-500', 'to-rose-500');
        saveBtn.classList.add('from-indigo-500', 'to-purple-500');
      }

      // Afficher stats
      const quickStats = document.getElementById('campaign-quick-stats');
      if (quickStats) quickStats.classList.remove('hidden');
      
      const viewsEl = document.getElementById('modal-ad-views');
      const clicksEl = document.getElementById('modal-ad-clicks');
      const ctrEl = document.getElementById('modal-ad-ctr');
      
      if (viewsEl) viewsEl.textContent = (campaign.views_count || 0).toLocaleString('fr-FR');
      if (clicksEl) clicksEl.textContent = (campaign.clicks_count || 0).toLocaleString('fr-FR');
      const ctr = campaign.views_count > 0 
        ? ((campaign.clicks_count / campaign.views_count) * 100).toFixed(1) 
        : 0;
      if (ctrEl) ctrEl.textContent = ctr + '%';

      await this.loadCampaignStats(campaignId);
      this.openModal();
      
    } catch (error) {
      console.error('[Campaigns] Error loading for edit:', error);
      this.showToast('Erreur chargement campagne: ' + error.message, 'error');
    }
  },

  renderProductTargets: function(selectedProductIds) {
    const targetList = document.getElementById('target-products-list');
    const productSelect = document.getElementById('cta-product-select');
    
    const products = this.state.products;
    console.log('[Campaigns] Rendering', products.length, 'products, selected IDs:', selectedProductIds);
    
    if (products.length === 0) {
      if (targetList) {
        targetList.innerHTML = '<div class="text-center py-4 text-amber-400"><i class="fas fa-exclamation-triangle mr-2"></i>Aucun produit disponible. Créez d\'abord un produit dans la section "Produits".</div>';
      }
      return;
    }

    // Convertir selectedProductIds en nombres
    const selectedIds = (selectedProductIds || []).map(function(id) { return parseInt(id); });

    // Rendre la liste des checkboxes
    if (targetList) {
      let html = '';
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const isChecked = selectedIds.indexOf(p.id) !== -1;
        html += '<label class="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer border transition-all ' + (isChecked ? 'bg-indigo-500/10 border-indigo-500/50' : 'border-transparent hover:border-slate-600') + '">' +
          '<input type="checkbox" name="target_products" value="' + p.id + '" ' + (isChecked ? 'checked' : '') + ' class="w-4 h-4 rounded border-slate-600 text-indigo-600 bg-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-800" onchange="SupplierCampaigns.updateCtaLink();">' +
          '<img src="' + (p.main_image_url || 'https://via.placeholder.com/100') + '" class="w-10 h-10 rounded object-cover bg-slate-700 flex-shrink-0" onerror="this.src=\'https://via.placeholder.com/100\'">' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-sm text-white truncate font-medium">' + (p.name || 'Produit sans nom') + '</p>' +
            '<p class="text-xs text-slate-400">' + this.formatPrice(p.price) + ' • Stock: ' + (p.stock_quantity || 0) + '</p>' +
          '</div>' +
          (isChecked ? '<i class="fas fa-check-circle text-indigo-400"></i>' : '') +
        '</label>';
      }
      targetList.innerHTML = html;
    }
    
    // Mettre à jour le select pour CTA
    if (productSelect) {
      let selectedOption = '';
      if (selectedIds.length > 0) {
        const selectedProduct = products.find(function(p) { return selectedIds.indexOf(p.id) !== -1; });
        if (selectedProduct) {
          selectedOption = 'https://brandia-marketplace.netlify.app/product.html?id=' + selectedProduct.id;
        }
      }
      
      let html = '<option value="">Choisir un produit...</option>';
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const productUrl = 'https://brandia-marketplace.netlify.app/product.html?id=' + p.id;
        html += '<option value="' + productUrl + '" ' + (productUrl === selectedOption ? 'selected' : '') + '>' + (p.name || 'Produit ' + p.id) + '</option>';
      }
      productSelect.innerHTML = html;
        
      // Mettre à jour le lien caché
      const ctaLinkValue = document.getElementById('cta-link-value');
      if (ctaLinkValue && selectedOption) {
        ctaLinkValue.value = selectedOption;
      }
    }
  },

  setupCtaFields: function(ctaLink, targetProducts) {
    const linkTypeSelect = document.querySelector('[name="cta_link_type"]');
    
    if (!ctaLink || !linkTypeSelect) {
      this.handleCtaType('product');
      return;
    }

    if (ctaLink.indexOf('product.html') !== -1) {
      linkTypeSelect.value = 'product';
      this.handleCtaType('product');
    } else if (ctaLink.indexOf('catalogue') !== -1 || ctaLink.indexOf('category') !== -1) {
      linkTypeSelect.value = 'category';
      this.handleCtaType('category');
    } else {
      linkTypeSelect.value = 'external';
      this.handleCtaType('external');
      const externalUrl = document.getElementById('cta-external-url');
      if (externalUrl) externalUrl.value = ctaLink;
    }
  },

  displayExistingMedia: function(url, type) {
    const dropzone = document.getElementById('campaign-dropzone');
    const placeholder = document.getElementById('campaign-media-placeholder');
    
    if (!dropzone) return;

    const oldPreview = dropzone.querySelector('.media-preview-container');
    if (oldPreview) oldPreview.remove();

    if (placeholder) placeholder.classList.add('hidden');

    const previewContainer = document.createElement('div');
    previewContainer.className = 'media-preview-container relative w-full h-48 flex items-center justify-center';

    if (type === 'video') {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.muted = true;
      video.className = 'max-h-full max-w-full rounded-lg shadow-lg';
      video.style.maxHeight = '200px';
      previewContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'max-h-full max-w-full rounded-lg shadow-lg object-cover';
      img.style.maxHeight = '200px';
      img.onerror = function() {
        previewContainer.innerHTML = '<div class="text-amber-400"><i class="fas fa-exclamation-triangle text-2xl"></i><p class="text-sm mt-2">Image non disponible</p></div>';
      };
      previewContainer.appendChild(img);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    const self = this;
    removeBtn.onclick = function(e) {
      e.stopPropagation();
      self.resetMediaPreview();
      self.state.uploadedMedia = { removeExisting: true };
    };
    previewContainer.appendChild(removeBtn);

    dropzone.appendChild(previewContainer);
    
    this.state.uploadedMedia = { 
      existingUrl: url, 
      existingType: type,
      removeExisting: false 
    };
  },

  loadCampaignStats: async function(campaignId) {
    try {
      const campaign = this.state.campaigns.find(function(c) { return c.id === parseInt(campaignId); });
      if (!campaign) return;

      // Générer données historiques (7 derniers jours)
      const today = new Date();
      const historicalData = [];
      const baseViews = Math.floor((campaign.views_count || 0) / 7);
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const variance = Math.random() * 0.4 + 0.8;
        historicalData.push({
          date: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
          views: Math.floor(baseViews * variance),
          clicks: Math.floor(baseViews * variance * 0.15)
        });
      }

      this.state.currentChartData = historicalData;
      this.renderDetailedChart(historicalData);

    } catch (error) {
      console.error('[Campaigns] Error loading stats:', error);
    }
  },

  renderDetailedChart: function(data) {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) return;
    
    if (this.state.chart) {
      this.state.chart.destroy();
    }

    try {
      this.state.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(function(d) { return d.date; }),
          datasets: [
            {
              label: 'Vues',
              data: data.map(function(d) { return d.views; }),
              borderColor: '#ec4899',
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              fill: true,
              tension: 0.4,
              yAxisID: 'y'
            },
            {
              label: 'Clics',
              data: data.map(function(d) { return d.clicks; }),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: true,
              tension: 0.4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: { 
              labels: { color: '#94a3b8' },
              position: 'top'
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: { color: 'rgba(148, 163, 184, 0.1)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: 'Vues', color: '#94a3b8' }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: 'Clics', color: '#94a3b8' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    } catch (e) {
      console.error('[Campaigns] Chart error:', e);
    }
  },

  loadCampaigns: async function() {
    try {
      const response = await BrandiaAPI.Supplier.getCampaigns();
      // 🔥 CORRECTION : Pas d'optional chaining
      this.state.campaigns = response.data || [];
      console.log('[Campaigns] Loaded campaigns:', this.state.campaigns.length);
      this.renderList();
      this.loadGlobalStats();
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
      this.state.campaigns = [];
      const container = document.getElementById('campaigns-list');
      if (container) {
        container.innerHTML = '<div class="p-8 text-center text-slate-500"><i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i><p>Créez votre première campagne publicitaire</p><button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 mt-4"><i class="fas fa-plus mr-2"></i>Créer une campagne</button></div>';
      }
    }
  },

  loadGlobalStats: function() {
    const campaigns = this.state.campaigns;
    let totalViews = 0;
    let totalClicks = 0;
    
    for (let i = 0; i < campaigns.length; i++) {
      totalViews += parseInt(campaigns[i].views_count) || 0;
      totalClicks += parseInt(campaigns[i].clicks_count) || 0;
    }
    
    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;

    const viewsEl = document.getElementById('ad-views');
    const clicksEl = document.getElementById('ad-clicks');
    const ctrEl = document.getElementById('ad-ctr');
    const convEl = document.getElementById('ad-conversions');

    if (viewsEl) viewsEl.textContent = totalViews.toLocaleString('fr-FR');
    if (clicksEl) clicksEl.textContent = totalClicks.toLocaleString('fr-FR');
    if (ctrEl) ctrEl.textContent = ctr + '%';
    if (convEl) convEl.textContent = '0';
    
    if (this.state.campaigns.length > 0 && this.state.currentChartData) {
      this.renderDetailedChart(this.state.currentChartData);
    } else {
      this.renderEmptyChart();
    }
  },

  renderEmptyChart: function() {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) return;
    
    if (this.state.chart) {
      this.state.chart.destroy();
    }

    const mockData = [
      { date: 'Lun', views: 45, clicks: 8 },
      { date: 'Mar', views: 52, clicks: 12 },
      { date: 'Mer', views: 38, clicks: 5 },
      { date: 'Jeu', views: 65, clicks: 15 },
      { date: 'Ven', views: 48, clicks: 9 },
      { date: 'Sam', views: 72, clicks: 18 },
      { date: 'Dim', views: 55, clicks: 11 }
    ];

    this.renderDetailedChart(mockData);
  },

  renderList: function() {
    const container = document.getElementById('campaigns-list');
    if (!container) {
      console.error('[Campaigns] Container not found');
      return;
    }

    if (this.state.campaigns.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-slate-500"><i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i><p class="text-lg mb-2">Aucune campagne active</p><p class="text-sm mb-4">Créez votre première publicité contextuelle</p><button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all"><i class="fas fa-plus mr-2"></i>Créer une campagne</button></div>';
      return;
    }

    let html = '';
    for (let i = 0; i < this.state.campaigns.length; i++) {
      const c = this.state.campaigns[i];
      const targetCount = (c.target_products && c.target_products.length) || 0;
      const ctr = c.views_count > 0 ? ((c.clicks_count / c.views_count) * 100).toFixed(1) : 0;
      
      html += '<div class="campaign-row p-6 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 group">' +
        '<div class="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">' +
          (c.media_type === 'video' 
            ? '<div class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"><i class="fas fa-play-circle text-white text-2xl"></i></div><video src="' + (c.media_url || '') + '" class="w-full h-full object-cover" muted></video>'
            : '<img src="' + (c.media_url || 'https://via.placeholder.com/100') + '" class="w-full h-full object-cover" onerror="this.src=\'https://via.placeholder.com/100\'">'
          ) +
          (c.status === 'active' ? '<span class="absolute top-1 left-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse z-20"></span>' : '') +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 mb-1">' +
            '<h4 class="font-semibold text-white truncate">' + (c.name || 'Sans nom') + '</h4>' +
            '<span class="badge badge-' + (c.status || 'active') + ' text-xs capitalize">' + (c.status || 'active') + '</span>' +
            (c.status === 'active' ? '<span class="text-xs text-emerald-400">• En ligne</span>' : '') +
          '</div>' +
          '<p class="text-sm text-slate-400 mb-2 truncate">' + (c.headline || '') + '</p>' +
          '<div class="flex items-center gap-4 text-xs text-slate-500">' +
            '<span><i class="fas fa-crosshairs mr-1"></i>' + targetCount + ' produits</span>' +
            '<span><i class="fas fa-calendar mr-1"></i>' + this.formatDate(c.start_date) + ' - ' + this.formatDate(c.end_date) + '</span>' +
            (c.media_type === 'video' ? '<span><i class="fas fa-video mr-1"></i>Vidéo</span>' : '<span><i class="fas fa-image mr-1"></i>Image</span>') +
          '</div>' +
        '</div>' +
        '<div class="text-right">' +
          '<div class="flex items-center gap-4 mb-2">' +
            '<div class="text-center"><p class="text-lg font-bold text-white">' + (parseInt(c.views_count) || 0) + '</p><p class="text-xs text-slate-500">Vues</p></div>' +
            '<div class="text-center"><p class="text-lg font-bold text-indigo-400">' + (parseInt(c.clicks_count) || 0) + '</p><p class="text-xs text-slate-500">Clics</p></div>' +
            '<div class="text-center"><p class="text-lg font-bold text-emerald-400">' + ctr + '%</p><p class="text-xs text-slate-500">CTR</p></div>' +
          '</div>' +
          '<div class="flex gap-2 justify-end">' +
            '<button onclick="event.stopPropagation(); SupplierCampaigns.editCampaign(' + c.id + ')" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors" title="Modifier"><i class="fas fa-edit mr-1"></i>Modifier</button>' +
            '<button onclick="event.stopPropagation(); SupplierCampaigns.toggleStatus(' + c.id + ', \'' + (c.status === 'active' ? 'paused' : 'active') + '\')" class="px-3 py-1.5 rounded-lg text-xs font-medium ' + (c.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20') + ' transition-colors">' + (c.status === 'active' ? '<i class="fas fa-pause mr-1"></i>Pause' : '<i class="fas fa-play mr-1"></i>Activer') + '</button>' +
            '<button onclick="event.stopPropagation(); SupplierCampaigns.deleteCampaign(' + c.id + ')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors" title="Supprimer"><i class="fas fa-trash"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    
    container.innerHTML = html;
  },

  editCampaign: function(id) {
    console.log('[Campaigns] Editing campaign ' + id);
    this.loadCampaignForEdit(id);
  },

  openModal: function() {
    console.log('[Campaigns] Opening modal...');
    const modal = document.getElementById('campaign-modal');
    if (!modal) {
      console.error('[Campaigns] Modal element not found!');
      alert('Erreur: Modal non trouvé dans le DOM');
      return;
    }
    
    if (!this.state.editingCampaignId) {
      this.resetModalForCreate();
    }
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    console.log('[Campaigns] Modal opened successfully');
  },

  resetModalForCreate: function() {
    this.state.editingCampaignId = null;
    this.state.currentMediaType = 'image';
    this.state.uploadedMedia = null;
    
    const form = document.getElementById('campaign-form');
    if (form) form.reset();
    
    const linkValue = document.getElementById('cta-link-value');
    if (linkValue) linkValue.value = '';
    
    this.resetMediaPreview();

    const modalTitle = document.querySelector('#campaign-modal h3');
    if (modalTitle) modalTitle.textContent = 'Nouvelle campagne publicitaire';
    
    const modalSubtitle = document.querySelector('#campaign-modal p.text-sm');
    if (modalSubtitle) modalSubtitle.textContent = 'Créez une publicité contextuelle pour vos produits';

    const saveBtn = document.querySelector('#campaign-modal button[onclick="saveCampaign()"]');
    if (saveBtn) {
      saveBtn.textContent = 'Créer la campagne';
      saveBtn.classList.remove('from-indigo-500', 'to-purple-500');
      saveBtn.classList.add('from-pink-500', 'to-rose-500');
    }
    
    const quickStats = document.getElementById('campaign-quick-stats');
    if (quickStats) quickStats.classList.add('hidden');

    const targetList = document.getElementById('target-products-list');
    const productSelect = document.getElementById('cta-product-select');
    
    const products = this.state.products;
    
    if (products.length === 0) {
      if (targetList) {
        targetList.innerHTML = '<div class="text-center py-4 text-amber-400"><i class="fas fa-exclamation-triangle mr-2"></i>Aucun produit disponible. Créez d\'abord un produit.</div>';
      }
    } else {
      if (targetList) {
        let html = '';
        for (let i = 0; i < products.length; i++) {
          const p = products[i];
          html += '<label class="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer border border-transparent hover:border-slate-600 transition-all">' +
            '<input type="checkbox" name="target_products" value="' + p.id + '" class="w-4 h-4 rounded border-slate-600 text-indigo-600 bg-slate-700 focus:ring-indigo-500" onchange="SupplierCampaigns.updateCtaLink();">' +
            '<img src="' + (p.main_image_url || 'https://via.placeholder.com/100') + '" class="w-10 h-10 rounded object-cover bg-slate-700" onerror="this.src=\'https://via.placeholder.com/100\'">' +
            '<div class="flex-1 min-w-0">' +
              '<p class="text-sm text-white truncate">' + (p.name || 'Produit sans nom') + '</p>' +
              '<p class="text-xs text-slate-400">' + this.formatPrice(p.price) + '</p>' +
            '</div>' +
          '</label>';
        }
        targetList.innerHTML = html;
      }
      
      if (productSelect) {
        let html = '<option value="">Choisir un produit...</option>';
        for (let i = 0; i < products.length; i++) {
          const p = products[i];
          html += '<option value="https://brandia-marketplace.netlify.app/product.html?id=' + p.id + '">' + (p.name || 'Produit ' + p.id) + '</option>';
        }
        productSelect.innerHTML = html;
      }
    }
    
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate = document.querySelector('[name="start_date"]');
    const endDate = document.querySelector('[name="end_date"]');
    if (startDate) startDate.value = today;
    if (endDate) endDate.value = nextMonth;
    
    this.handleCtaType('product');
    this.renderEmptyChart();
  },

  resetMediaPreview: function() {
    const dropzone = document.getElementById('campaign-dropzone');
    const placeholder = document.getElementById('campaign-media-placeholder');
    
    const oldPreview = dropzone.querySelector('.media-preview-container');
    if (oldPreview) oldPreview.remove();
    
    if (placeholder) placeholder.classList.remove('hidden');
    
    if (!this.state.editingCampaignId) {
      this.state.uploadedMedia = null;
    }
  },

  handleMedia: function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const maxSize = this.state.currentMediaType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
      alert('Le fichier ne doit pas dépasser ' + (this.state.currentMediaType === 'video' ? '50MB' : '5MB'));
      return;
    }
    
    const dropzone = document.getElementById('campaign-dropzone');
    const placeholder = document.getElementById('campaign-media-placeholder');
    
    if (!dropzone) return;
    
    if (placeholder) placeholder.classList.add('hidden');
    
    const oldPreview = dropzone.querySelector('.media-preview-container');
    if (oldPreview) oldPreview.remove();
    
    const previewContainer = document.createElement('div');
    previewContainer.className = 'media-preview-container relative w-full h-48 flex items-center justify-center';
    
    const url = URL.createObjectURL(file);
    const self = this;
    
    if (this.state.currentMediaType === 'video' || file.type.indexOf('video/') === 0) {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.muted = true;
      video.className = 'max-h-full max-w-full rounded-lg shadow-lg';
      video.style.maxHeight = '200px';
      
      video.onerror = function() {
        previewContainer.innerHTML = '<div class="text-red-400"><i class="fas fa-exclamation-circle text-2xl"></i><p class="text-sm mt-2">Erreur chargement vidéo</p></div>';
      };
      
      previewContainer.appendChild(video);
      
      this.state.uploadedMedia = {
        type: 'video',
        file: file,
        previewUrl: url,
        isNew: true
      };
      
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'max-h-full max-w-full rounded-lg shadow-lg object-cover';
      img.style.maxHeight = '200px';
      
      img.onerror = function() {
        previewContainer.innerHTML = '<div class="text-red-400"><i class="fas fa-exclamation-circle text-2xl"></i><p class="text-sm mt-2">Erreur chargement image</p></div>';
      };
      
      previewContainer.appendChild(img);
      
      this.state.uploadedMedia = {
        type: 'image',
        file: file,
        previewUrl: url,
        isNew: true
      };
    }
    
    dropzone.appendChild(previewContainer);
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = function(e) {
      e.stopPropagation();
      self.resetMediaPreview();
      document.getElementById('campaign-media').value = '';
      self.state.uploadedMedia = self.state.editingCampaignId ? { removeExisting: true } : null;
    };
    previewContainer.appendChild(removeBtn);
  },

  toggleMediaType: function(type) {
    this.state.currentMediaType = type;
    this.resetMediaPreview();
    document.getElementById('campaign-media').value = '';
    
    const input = document.getElementById('campaign-media');
    if (input) {
      input.accept = type === 'video' ? 'video/mp4,video/webm' : 'image/*';
    }
  },

  handleCtaType: function(type) {
    const productSelect = document.getElementById('cta-product-select');
    const externalUrl = document.getElementById('cta-external-url');
    const linkValue = document.getElementById('cta-link-value');
    
    if (!productSelect || !externalUrl || !linkValue) return;
    
    const newProductSelect = productSelect.cloneNode(true);
    const newExternalUrl = externalUrl.cloneNode(true);
    productSelect.parentNode.replaceChild(newProductSelect, productSelect);
    externalUrl.parentNode.replaceChild(newExternalUrl, externalUrl);
    
    if (type === 'product') {
      newProductSelect.classList.remove('hidden');
      newExternalUrl.classList.add('hidden');
      newProductSelect.onchange = function(e) {
        linkValue.value = e.target.value;
      };
    } else if (type === 'external') {
      newProductSelect.classList.add('hidden');
      newExternalUrl.classList.remove('hidden');
      newExternalUrl.oninput = function(e) {
        linkValue.value = e.target.value;
      };
    } else {
      newProductSelect.classList.add('hidden');
      newExternalUrl.classList.add('hidden');
      linkValue.value = 'https://brandia-marketplace.netlify.app/catalogue.html';
    }
  },

  updateCtaLink: function() {
    const checked = document.querySelectorAll('input[name="target_products"]:checked');
    const linkValue = document.getElementById('cta-link-value');
    const typeSelect = document.querySelector('[name="cta_link_type"]');
    const type = typeSelect ? typeSelect.value : 'product';
    
    if (!linkValue) return;
    
    if (checked.length > 0 && type === 'product' && !linkValue.value) {
      const firstProductId = checked[0].value;
      linkValue.value = 'https://brandia-marketplace.netlify.app/product.html?id=' + firstProductId;
    }
  },

  uploadMediaToCloudinary: async function() {
    if (!this.state.uploadedMedia || !this.state.uploadedMedia.isNew) {
      if (this.state.uploadedMedia && this.state.uploadedMedia.existingUrl && !this.state.uploadedMedia.removeExisting) {
        return {
          url: this.state.uploadedMedia.existingUrl,
          type: this.state.uploadedMedia.existingType
        };
      }
      return null;
    }

    const file = this.state.uploadedMedia.file;
    const type = this.state.uploadedMedia.type;
    
    if (type === 'video') {
      const isValidDuration = await this.checkVideoDuration(file);
      if (!isValidDuration) {
        throw new Error('La vidéo ne doit pas dépasser 15 secondes');
      }
    }

    const formData = new FormData();
    formData.append('media', file);

    try {
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(true);
      }
      
      const endpoint = type === 'video' ? '/supplier/upload-video' : '/supplier/upload-image';
      
      console.log('[Campaigns] Uploading ' + type + ' to ' + endpoint);
      
      const response = await fetch(BrandiaAPI.config.apiURL + endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: formData
      });

      const result = await response.json();
      console.log('[Campaigns] Upload response:', result);

      if (result.success) {
        return {
          url: (result.data && result.data.url) ? result.data.url : result.data,
          type: type
        };
      } else {
        throw new Error(result.message || 'Erreur upload');
      }
    } catch (error) {
      console.error('[Campaigns] Upload error:', error);
      throw error;
    } finally {
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(false);
      }
    }
  },

  checkVideoDuration: function(file) {
    return new Promise(function(resolve) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        console.log('[Campaigns] Video duration: ' + duration + 's');
        resolve(duration <= 15);
      };
      
      video.onerror = function() {
        resolve(false);
      };
      
      video.src = URL.createObjectURL(file);
    });
  },

  save: async function() {
    const form = document.getElementById('campaign-form');
    if (!form) {
      alert('Formulaire non trouvé');
      return;
    }
    
    const formData = new FormData(form);
    
    const checkedBoxes = form.querySelectorAll('input[name="target_products"]:checked');
    const targetProducts = [];
    for (let i = 0; i < checkedBoxes.length; i++) {
      targetProducts.push(parseInt(checkedBoxes[i].value));
    }
    
    if (targetProducts.length === 0) {
      alert('Veuillez sélectionner au moins un produit cible');
      return;
    }

    let mediaUrl = null;
    let mediaType = this.state.currentMediaType;
    
    if (this.state.uploadedMedia) {
      if (this.state.uploadedMedia.isNew) {
        try {
          const uploadResult = await this.uploadMediaToCloudinary();
          if (uploadResult) {
            mediaUrl = uploadResult.url;
            mediaType = uploadResult.type;
          }
        } catch (error) {
          alert('Erreur upload média: ' + error.message);
          return;
        }
      } else if (!this.state.uploadedMedia.removeExisting) {
        mediaUrl = this.state.uploadedMedia.existingUrl;
        mediaType = this.state.uploadedMedia.existingType;
      }
    }

    const ctaLinkValue = document.getElementById('cta-link-value');
    let ctaLink = ctaLinkValue ? ctaLinkValue.value : '';
    if (!ctaLink) {
      ctaLink = 'https://brandia-marketplace.netlify.app/product.html?id=' + targetProducts[0];
    }

    const name = formData.get('name');
    const headline = formData.get('headline');
    const description = formData.get('description') || '';
    const cta_text = formData.get('cta_text') || 'Voir l\'offre';
    const start_date = formData.get('start_date');
    const end_date = formData.get('end_date');

    const data = {
      name: name,
      headline: headline,
      description: description,
      cta_text: cta_text,
      cta_link: ctaLink,
      media_type: mediaType,
      target_products: targetProducts,
      start_date: start_date,
      end_date: end_date
    };

    if (mediaUrl) {
      data.media_url = mediaUrl;
    }

    console.log('[Campaign] Saving:', data, 'Mode:', this.state.editingCampaignId ? 'EDIT' : 'CREATE');

    try {
      let response;
      
      if (this.state.editingCampaignId) {
        response = await BrandiaAPI.Supplier.updateCampaign(this.state.editingCampaignId, data);
        console.log('[Campaign] Update response:', response);
        
        if (response.success) {
          this.showToast('Campagne mise à jour avec succès !', 'success');
        } else {
          throw new Error(response.message || 'Erreur lors de la mise à jour');
        }
      } else {
        data.media_url = mediaUrl || 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800';
        
        response = await BrandiaAPI.Supplier.createCampaign(data);
        console.log('[Campaign] Create response:', response);
        
        if (response.success) {
          this.showToast('Campagne créée avec succès !', 'success');
        } else {
          throw new Error(response.message || 'Erreur lors de la création');
        }
      }

      this.closeModal();
      form.reset();
      this.resetMediaPreview();
      this.state.editingCampaignId = null;
      this.loadCampaigns();
      
    } catch (error) {
      console.error('[Campaign] Error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
    }
  },

  closeModal: function() {
    const modal = document.getElementById('campaign-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    this.state.editingCampaignId = null;
    this.resetMediaPreview();
  },

  toggleStatus: async function(id, newStatus) {
    try {
      const response = await BrandiaAPI.Supplier.updateCampaign(id, { status: newStatus });
      
      if (response.success) {
        const campaign = this.state.campaigns.find(function(c) { return c.id === id; });
        if (campaign) {
          campaign.status = newStatus;
        }
        this.renderList();
        this.showToast('Campagne ' + (newStatus === 'active' ? 'activée' : 'mise en pause'), 'success');
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Erreur toggle status:', error);
      this.showToast('Erreur lors de la mise à jour', 'error');
    }
  },

  deleteCampaign: async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ? Cette action est irréversible.')) return;
    
    try {
      console.log('[Campaign] Deleting ' + id + '...');
      
      const response = await BrandiaAPI.Supplier.deleteCampaign(id);
      
      if (response.success) {
        this.state.campaigns = this.state.campaigns.filter(function(c) { return c.id !== id; });
        this.renderList();
        this.loadGlobalStats();
        this.showToast('Campagne supprimée définitivement', 'success');
        console.log('[Campaign] Deleted successfully: ' + id);
      } else {
        throw new Error(response.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('[Campaign] Delete error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
    }
  },

  updatePreview: function() {
    const headlineInput = document.querySelector('[name="headline"]');
    const descInput = document.querySelector('[name="description"]');
    const ctaInput = document.querySelector('[name="cta_text"]');
    
    const headline = headlineInput ? headlineInput.value : 'Votre titre';
    const desc = descInput ? descInput.value : 'Description';
    const cta = ctaInput ? ctaInput.value : 'Voir l\'offre';
    
    const previewHeadline = document.getElementById('ad-preview-headline');
    const previewDesc = document.getElementById('ad-preview-desc');
    const previewCta = document.getElementById('ad-preview-cta');
    
    if (previewHeadline) previewHeadline.textContent = headline;
    if (previewDesc) previewDesc.textContent = desc;
    if (previewCta) previewCta.textContent = cta;
  },

  formatPrice: function(amount) {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  },

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
    if (window.DashboardApp && window.DashboardApp.showToast) {
      window.DashboardApp.showToast(message, type);
    } else {
      alert(message);
    }
  }
};

// ============================================
// FONCTIONS GLOBALES EXPOSÉES
// ============================================
window.openCampaignModal = function() {
  console.log('[Global] openCampaignModal called');
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.resetModalForCreate();
    window.SupplierCampaigns.openModal();
  } else {
    console.error('[Global] SupplierCampaigns not loaded');
    alert('Erreur: Module campagnes non chargé. Rafraîchissez la page.');
  }
};

window.saveCampaign = function() {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.save();
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  if (modalId === 'campaign-modal' && window.SupplierCampaigns) {
    window.SupplierCampaigns.state.editingCampaignId = null;
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
  } else {
    console.error('[Global] SupplierCampaigns not available');
  }
};

window.handleCampaignMedia = function(e) {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.handleMedia(e);
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

window.updateCtaLink = function() {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.updateCtaLink();
  }
};

console.log('[SupplierCampaigns] Module loaded successfully v4.4 - Syntax Compatible');
