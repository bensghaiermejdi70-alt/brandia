// ============================================
// SUPPLIER CAMPAIGNS MODULE - v4.6 CORRIGÉ
// Correction: Images fallback + logs upload détaillés
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

  // 🔥 Image fallback locale (SVG base64)
  FALLBACK_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzNDE1NSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DYW1wYWduZTwvdGV4dD48L3N2Zz4=',

  init: async function() {
    console.log('[Campaigns] Initializing v4.6...');
    await this.loadProducts();
    await this.loadCampaigns();
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
      } else if (response.data && typeof response.data === 'object') {
        const possibleArrays = Object.values(response.data).filter(v => Array.isArray(v));
        if (possibleArrays.length > 0) {
          productsArray = possibleArrays[0];
        }
      }
      
      this.state.products = productsArray;
      console.log('[Campaigns] Loaded products:', this.state.products.length);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      this.state.products = [];
    }
  },

  // ... (garder toutes les autres méthodes identiques à v4.5)

  // 🔥 CORRECTION: Méthode upload avec logs détaillés
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
    
    console.log('[Campaigns Upload] Début upload:', {
      type: type,
      name: file.name,
      size: file.size,
      mimeType: file.type
    });

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
      const fullUrl = BrandiaAPI.config.apiURL + endpoint;
      
      console.log('[Campaigns Upload] URL:', fullUrl);
      console.log('[Campaigns Upload] Token présent:', !!localStorage.getItem('token'));

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: formData
      });

      console.log('[Campaigns Upload] Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Campaigns Upload] Erreur serveur:', errorText);
        
        let errorMessage = 'Erreur serveur ' + response.status;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) errorMessage = errorJson.message;
        } catch(e) {
          if (errorText) errorMessage = errorText.substring(0, 200);
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[Campaigns Upload] Succès:', result);

      if (result.success) {
        const mediaUrl = result.data?.url || result.data?.secure_url || result.data || result.url;
        
        if (!mediaUrl) {
          console.error('[Campaigns Upload] Pas d\'URL dans:', result);
          throw new Error('URL média non trouvée');
        }
        
        return {
          url: mediaUrl,
          type: type
        };
      } else {
        throw new Error(result.message || 'Erreur upload inconnue');
      }
    } catch (error) {
      console.error('[Campaigns Upload] Erreur:', error);
      throw error;
    } finally {
      if (window.DashboardApp && window.DashboardApp.showLoading) {
        window.DashboardApp.showLoading(false);
      }
    }
  },

  // 🔥 CORRECTION: renderList avec fallback images
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
      
      // 🔥 CORRECTION: Image fallback
      const mediaUrl = c.media_url || this.FALLBACK_IMAGE;
      
      html += '<div class="campaign-row p-6 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 group">' +
        '<div class="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">' +
          (c.media_type === 'video' 
            ? '<div class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"><i class="fas fa-play-circle text-white text-2xl"></i></div><video src="' + mediaUrl + '" class="w-full h-full object-cover" muted></video>'
            : '<img src="' + mediaUrl + '" class="w-full h-full object-cover" onerror="this.src=\'' + this.FALLBACK_IMAGE + '\'">'
          ) +
          (c.status === 'active' ? '<span class="absolute top-1 left-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse z-20"></span>' : '') +
        '</div>' +
        // ... reste identique
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

  // ... (garder toutes les autres méthodes identiques à v4.5)

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
    } else if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log('[' + type + '] ' + message);
    }
  }
};

// Fonctions globales (identiques à v4.5)
window.openCampaignModal = function() {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.resetModalForCreate();
    window.SupplierCampaigns.openModal();
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

console.log('[SupplierCampaigns] Module v4.6 chargé - Fallback images + logs upload');