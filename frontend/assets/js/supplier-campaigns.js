// ============================================
// SUPPLIER CAMPAIGNS MODULE (Publicité) - CORRIGÉ v3.1
// ============================================

window.SupplierCampaigns = {
  state: {
    campaigns: [],
    products: [],
    chart: null,
    currentMediaType: 'image',
    uploadedMedia: null
  },

  init: async function() {
    console.log('[Campaigns] Initializing...');
    await this.loadProducts();
    await this.loadCampaigns();
    await this.loadStats();
  },

  loadProducts: async function() {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      this.state.products = response.data?.products || response.data || [];
      console.log('[Campaigns] Loaded products:', this.state.products.length);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      this.state.products = [];
    }
  },

  loadCampaigns: async function() {
    try {
      const response = await BrandiaAPI.Supplier.getCampaigns();
      this.state.campaigns = response.data || [];
      console.log('[Campaigns] Loaded campaigns:', this.state.campaigns.length);
      this.renderList();
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
      this.state.campaigns = [];
      const container = document.getElementById('campaigns-list');
      if (container) {
        container.innerHTML = `
          <div class="p-8 text-center text-slate-500">
            <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
            <p>Créez votre première campagne publicitaire</p>
            <button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 mt-4">
              <i class="fas fa-plus mr-2"></i>Créer une campagne
            </button>
          </div>
        `;
      }
    }
  },

  loadStats: function() {
    const campaigns = this.state.campaigns;
    const totalViews = campaigns.reduce((sum, c) => sum + (parseInt(c.views_count) || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (parseInt(c.clicks_count) || 0), 0);
    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;

    const viewsEl = document.getElementById('ad-views');
    const clicksEl = document.getElementById('ad-clicks');
    const ctrEl = document.getElementById('ad-ctr');
    const convEl = document.getElementById('ad-conversions');

    if (viewsEl) viewsEl.textContent = totalViews.toLocaleString('fr-FR');
    if (clicksEl) clicksEl.textContent = totalClicks.toLocaleString('fr-FR');
    if (ctrEl) ctrEl.textContent = ctr + '%';
    if (convEl) convEl.textContent = '0';
    
    this.renderChart();
  },

  renderList: function() {
    const container = document.getElementById('campaigns-list');
    if (!container) {
      console.error('[Campaigns] Container not found');
      return;
    }

    if (this.state.campaigns.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
          <p class="text-lg mb-2">Aucune campagne active</p>
          <p class="text-sm mb-4">Créez votre première publicité contextuelle</p>
          <button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all">
            <i class="fas fa-plus mr-2"></i>Créer une campagne
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.campaigns.map(c => `
      <div class="p-6 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0">
        <div class="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
          ${c.media_type === 'video' 
            ? `<div class="absolute inset-0 flex items-center justify-center bg-black/50"><i class="fas fa-play-circle text-white text-2xl"></i></div>
               ${c.media_url ? `<video src="${c.media_url}" class="w-full h-full object-cover" muted></video>` : ''}`
            : `<img src="${c.media_url || 'https://via.placeholder.com/100'}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100'">`
          }
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-semibold text-white truncate">${c.name || 'Sans nom'}</h4>
            <span class="badge badge-${c.status || 'active'} text-xs capitalize">${c.status || 'active'}</span>
          </div>
          <p class="text-sm text-slate-400 mb-2 truncate">${c.headline || ''}</p>
          <div class="flex items-center gap-4 text-xs text-slate-500">
            <span><i class="fas fa-crosshairs mr-1"></i>${(c.target_products || []).length} produits</span>
            <span><i class="fas fa-calendar mr-1"></i>${this.formatDate(c.start_date)} - ${this.formatDate(c.end_date)}</span>
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
          </div>
          <div class="flex gap-2 justify-end">
            <button onclick="SupplierCampaigns.toggleStatus(${c.id}, '${c.status === 'active' ? 'paused' : 'active'}')" 
                    class="px-3 py-1.5 rounded-lg text-xs font-medium ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-colors">
              ${c.status === 'active' ? '<i class="fas fa-pause mr-1"></i>Pause' : '<i class="fas fa-play mr-1"></i>Activer'}
            </button>
            <button onclick="SupplierCampaigns.deleteCampaign(${c.id})" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderChart: function() {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) return;
    
    if (this.state.chart) {
      this.state.chart.destroy();
    }

    const data = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      datasets: [{
        label: 'Vues',
        data: [65, 59, 80, 81, 56, 55, 40],
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        fill: true,
        tension: 0.4
      }]
    };

    try {
      this.state.chart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } }
          },
          scales: {
            y: {
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
    } catch (e) {
      console.error('[Campaigns] Chart error:', e);
    }
  },

  openModal: function() {
    console.log('[Campaigns] Opening modal...');
    const modal = document.getElementById('campaign-modal');
    if (!modal) {
      console.error('[Campaigns] Modal element not found!');
      alert('Erreur: Modal non trouvé dans le DOM');
      return;
    }
    
    // Reset state
    this.state.currentMediaType = 'image';
    this.state.uploadedMedia = null;
    
    // Reset form
    const form = document.getElementById('campaign-form');
    if (form) form.reset();
    
    const linkValue = document.getElementById('cta-link-value');
    if (linkValue) linkValue.value = '';
    
    // Reset media preview
    this.resetMediaPreview();
    
    // Charger les produits
    const targetList = document.getElementById('target-products-list');
    const productSelect = document.getElementById('cta-product-select');
    
    const products = this.state.products;
    console.log('[Campaigns] Products for modal:', products.length);
    
    if (products.length === 0) {
      if (targetList) {
        targetList.innerHTML = '<div class="text-center py-4 text-amber-400"><i class="fas fa-exclamation-triangle mr-2"></i>Aucun produit disponible. Créez d\'abord un produit.</div>';
      }
    } else {
      // Liste des checkboxes
      if (targetList) {
        targetList.innerHTML = products.map(p => `
          <label class="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer border border-transparent hover:border-slate-600 transition-all">
            <input type="checkbox" name="target_products" value="${p.id}" class="w-4 h-4 rounded border-slate-600 text-indigo-600 bg-slate-700 focus:ring-indigo-500" onchange="SupplierCampaigns.updateCtaLink()">
            <img src="${p.main_image_url || 'https://via.placeholder.com/100'}" class="w-10 h-10 rounded object-cover bg-slate-700" onerror="this.src='https://via.placeholder.com/100'">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white truncate">${p.name || 'Produit sans nom'}</p>
              <p class="text-xs text-slate-400">${this.formatPrice(p.price)}</p>
            </div>
          </label>
        `).join('');
      }
      
      // Select pour CTA
      if (productSelect) {
        productSelect.innerHTML = '<option value="">Choisir un produit...</option>' + 
          products.map(p => `<option value="https://brandia-marketplace.netlify.app/product.html?id=${p.id}">${p.name || 'Produit ' + p.id}</option>`).join('');
      }
    }
    
    // Dates par défaut
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate = document.querySelector('[name="start_date"]');
    const endDate = document.querySelector('[name="end_date"]');
    if (startDate) startDate.value = today;
    if (endDate) endDate.value = nextMonth;
    
    // Initialiser le type de CTA
    this.handleCtaType('product');
    
    // Afficher le modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    console.log('[Campaigns] Modal opened successfully');
  },

  // ==========================================
  // 🔥 CORRECTION CRITIQUE : Gestion média
  // ==========================================
  resetMediaPreview: function() {
    const dropzone = document.getElementById('campaign-dropzone');
    const placeholder = document.getElementById('campaign-media-placeholder');
    
    // Supprimer anciens éléments preview
    const oldPreview = dropzone.querySelector('.media-preview-container');
    if (oldPreview) oldPreview.remove();
    
    if (placeholder) placeholder.classList.remove('hidden');
    
    this.state.uploadedMedia = null;
  },

  handleMedia: function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const maxSize = this.state.currentMediaType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
      alert(`Le fichier ne doit pas dépasser ${this.state.currentMediaType === 'video' ? '50MB' : '5MB'}`);
      return;
    }
    
    const dropzone = document.getElementById('campaign-dropzone');
    const placeholder = document.getElementById('campaign-media-placeholder');
    
    if (!dropzone) return;
    
    // Cacher le placeholder
    if (placeholder) placeholder.classList.add('hidden');
    
    // Supprimer ancien preview
    const oldPreview = dropzone.querySelector('.media-preview-container');
    if (oldPreview) oldPreview.remove();
    
    // Créer le conteneur de preview
    const previewContainer = document.createElement('div');
    previewContainer.className = 'media-preview-container relative w-full h-48 flex items-center justify-center';
    
    const url = URL.createObjectURL(file);
    
    if (this.state.currentMediaType === 'video' || file.type.startsWith('video/')) {
      // 🔥 CRÉATION ÉLÉMENT VIDÉO CORRECTE
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.muted = true;
      video.className = 'max-h-full max-w-full rounded-lg shadow-lg';
      video.style.maxHeight = '200px';
      
      // Gestion erreur chargement
      video.onerror = () => {
        console.error('[Campaigns] Video load error');
        previewContainer.innerHTML = '<div class="text-red-400"><i class="fas fa-exclamation-circle text-2xl"></i><p class="text-sm mt-2">Erreur chargement vidéo</p></div>';
      };
      
      // Gestion succès
      video.onloadeddata = () => {
        console.log('[Campaigns] Video loaded successfully');
      };
      
      previewContainer.appendChild(video);
      
      // Stocker pour upload
      this.state.uploadedMedia = {
        type: 'video',
        file: file,
        previewUrl: url
      };
      
    } else {
      // Image
      const img = document.createElement('img');
      img.src = url;
      img.className = 'max-h-full max-w-full rounded-lg shadow-lg object-cover';
      img.style.maxHeight = '200px';
      
      img.onerror = () => {
        previewContainer.innerHTML = '<div class="text-red-400"><i class="fas fa-exclamation-circle text-2xl"></i><p class="text-sm mt-2">Erreur chargement image</p></div>';
      };
      
      previewContainer.appendChild(img);
      
      this.state.uploadedMedia = {
        type: 'image',
        file: file,
        previewUrl: url
      };
    }
    
    dropzone.appendChild(previewContainer);
    
    // Bouton supprimer
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      this.resetMediaPreview();
      document.getElementById('campaign-media').value = '';
    };
    previewContainer.appendChild(removeBtn);
  },

  toggleMediaType: function(type) {
    this.state.currentMediaType = type;
    this.resetMediaPreview();
    document.getElementById('campaign-media').value = '';
    
    // Mettre à jour l'accept du input file
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
    
    // Nettoyer les anciens listeners
    const newProductSelect = productSelect.cloneNode(true);
    const newExternalUrl = externalUrl.cloneNode(true);
    productSelect.parentNode.replaceChild(newProductSelect, productSelect);
    externalUrl.parentNode.replaceChild(newExternalUrl, externalUrl);
    
    if (type === 'product') {
      newProductSelect.classList.remove('hidden');
      newExternalUrl.classList.add('hidden');
      newProductSelect.addEventListener('change', (e) => {
        linkValue.value = e.target.value;
      });
    } else if (type === 'external') {
      newProductSelect.classList.add('hidden');
      newExternalUrl.classList.remove('hidden');
      newExternalUrl.addEventListener('input', (e) => {
        linkValue.value = e.target.value;
      });
    } else {
      newProductSelect.classList.add('hidden');
      newExternalUrl.classList.add('hidden');
      linkValue.value = 'https://brandia-marketplace.netlify.app/catalogue.html';
    }
  },

  updateCtaLink: function() {
    const checked = document.querySelectorAll('input[name="target_products"]:checked');
    const linkValue = document.getElementById('cta-link-value');
    const type = document.querySelector('[name="cta_link_type"]')?.value;
    
    if (!linkValue) return;
    
    if (checked.length > 0 && type === 'product' && !linkValue.value) {
      const firstProductId = checked[0].value;
      linkValue.value = `https://brandia-marketplace.netlify.app/product.html?id=${firstProductId}`;
    }
  },

  /// ==========================================
// UPLOAD CLOUDINARY (Image & Vidéo)
// ==========================================
uploadMediaToCloudinary: async function() {
  if (!this.state.uploadedMedia) {
    throw new Error('Aucun média sélectionné');
  }

  const { file, type } = this.state.uploadedMedia;
  
  // Vérifier durée vidéo si c'est une vidéo
  if (type === 'video') {
    const isValidDuration = await this.checkVideoDuration(file);
    if (!isValidDuration) {
      throw new Error('La vidéo ne doit pas dépasser 15 secondes');
    }
  }

  const formData = new FormData();
  // 🔥 CORRECTION : Utiliser 'media' comme fieldname pour les deux types
  formData.append('media', file);

  try {
    window.DashboardApp?.showLoading(true);
    
    const endpoint = type === 'video' 
      ? '/supplier/upload-video' 
      : '/supplier/upload-image';
    
    console.log(`[Campaigns] Uploading ${type} to ${endpoint}`);
    
    const response = await fetch(`${BrandiaAPI.config.apiURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
        // 🔥 NE PAS mettre Content-Type, le navigateur le fait automatiquement avec boundary
      },
      body: formData
    });

    const result = await response.json();
    console.log('[Campaigns] Upload response:', result);

    if (result.success) {
      return {
        url: result.data?.url || result.data,
        type: type
      };
    } else {
      throw new Error(result.message || 'Erreur upload');
    }
  } catch (error) {
    console.error('[Campaigns] Upload error:', error);
    throw error;
  } finally {
    window.DashboardApp?.showLoading(false);
  }
},

  checkVideoDuration: function(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        console.log(`[Campaigns] Video duration: ${duration}s`);
        resolve(duration <= 15);
      };
      
      video.onerror = () => {
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
    
    // Produits sélectionnés
    const targetProducts = Array.from(form.querySelectorAll('input[name="target_products"]:checked'))
      .map(cb => parseInt(cb.value));
    
    if (targetProducts.length === 0) {
      alert('Veuillez sélectionner au moins un produit cible');
      return;
    }

    // Upload média si présent
    let mediaUrl = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800';
    let mediaType = this.state.currentMediaType;
    
    if (this.state.uploadedMedia) {
      try {
        const uploadResult = await this.uploadMediaToCloudinary();
        mediaUrl = uploadResult.url;
        mediaType = uploadResult.type;
      } catch (error) {
        alert('Erreur upload média: ' + error.message);
        return;
      }
    }

    // Lien CTA
    let ctaLink = document.getElementById('cta-link-value')?.value;
    if (!ctaLink) {
      ctaLink = `https://brandia-marketplace.netlify.app/product.html?id=${targetProducts[0]}`;
    }

    const data = {
      name: formData.get('name'),
      headline: formData.get('headline'),
      description: formData.get('description') || '',
      cta_text: formData.get('cta_text') || 'Voir l\'offre',
      cta_link: ctaLink,
      media_type: mediaType,
      media_url: mediaUrl,
      target_products: targetProducts,
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date')
    };

    console.log('[Campaign] Saving:', data);

    try {
      const response = await BrandiaAPI.Supplier.createCampaign(data);
      console.log('[Campaign] Response:', response);
      
      if (response.success) {
        this.showToast('Campagne créée avec succès !', 'success');
        this.closeModal();
        form.reset();
        this.resetMediaPreview();
        this.loadCampaigns();
      } else {
        throw new Error(response.message || 'Erreur inconnue');
      }
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
    this.resetMediaPreview();
  },

  toggleStatus: async function(id, newStatus) {
    try {
      const response = await BrandiaAPI.Supplier.updateCampaign(id, { status: newStatus });
      
      if (response.success) {
        const campaign = this.state.campaigns.find(c => c.id === id);
        if (campaign) {
          campaign.status = newStatus;
        }
        this.renderList();
        this.showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
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
      console.log(`[Campaign] Deleting ${id}...`);
      
      const response = await BrandiaAPI.Supplier.deleteCampaign(id);
      
      if (response.success) {
        this.state.campaigns = this.state.campaigns.filter(c => c.id !== id);
        this.renderList();
        this.loadStats();
        this.showToast('Campagne supprimée définitivement', 'success');
        console.log(`[Campaign] Deleted successfully: ${id}`);
      } else {
        throw new Error(response.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('[Campaign] Delete error:', error);
      this.showToast('Erreur: ' + error.message, 'error');
    }
  },

  updatePreview: function() {
    const headline = document.querySelector('[name="headline"]')?.value || 'Votre titre';
    const desc = document.querySelector('[name="description"]')?.value || 'Description';
    const cta = document.querySelector('[name="cta_text"]')?.value || 'Voir l\'offre';
    
    const previewHeadline = document.getElementById('ad-preview-headline');
    const previewDesc = document.getElementById('ad-preview-desc');
    const previewCta = document.getElementById('ad-preview-cta');
    
    if (previewHeadline) previewHeadline.textContent = headline;
    if (previewDesc) previewDesc.textContent = desc;
    if (previewCta) previewCta.textContent = cta;
  },

  // ==========================================
  // UTILITAIRES
  // ==========================================
  formatPrice: function(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  },

  formatDate: function(dateString) {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  showToast: function(message, type = 'success') {
    if (window.DashboardApp?.showToast) {
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

console.log('[SupplierCampaigns] Module loaded successfully v3.1');