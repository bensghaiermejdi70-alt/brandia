// ============================================
// SUPPLIER CAMPAIGNS MODULE (Publicité)
// ============================================

window.SupplierCampaigns = {
  state: {
    campaigns: [],
    products: [],
    chart: null
  },

  init: async () => {
    console.log('[Campaigns] Initializing...');
    await SupplierCampaigns.loadProducts();
    await SupplierCampaigns.loadCampaigns();
    await SupplierCampaigns.loadStats();
  },

  loadProducts: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      SupplierCampaigns.state.products = response.data?.products || response.data || [];
      console.log('[Campaigns] Loaded products:', SupplierCampaigns.state.products.length);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      SupplierCampaigns.state.products = [];
    }
  },

  loadCampaigns: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getCampaigns();
      SupplierCampaigns.state.campaigns = response.data || [];
      console.log('[Campaigns] Loaded campaigns:', SupplierCampaigns.state.campaigns.length);
      SupplierCampaigns.renderList();
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
      SupplierCampaigns.state.campaigns = [];
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

  loadStats: () => {
    const campaigns = SupplierCampaigns.state.campaigns;
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
    
    SupplierCampaigns.renderChart();
  },

  renderList: () => {
    const container = document.getElementById('campaigns-list');
    if (!container) {
      console.error('[Campaigns] Container not found');
      return;
    }

    if (SupplierCampaigns.state.campaigns.length === 0) {
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

    container.innerHTML = SupplierCampaigns.state.campaigns.map(c => `
      <div class="p-6 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0">
        <div class="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
          ${c.media_type === 'video' 
            ? `<div class="absolute inset-0 flex items-center justify-center bg-black/50"><i class="fas fa-play-circle text-white text-2xl"></i></div>`
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
            <span><i class="fas fa-calendar mr-1"></i>${SupplierCampaigns.formatDate(c.start_date)} - ${SupplierCampaigns.formatDate(c.end_date)}</span>
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

  renderChart: () => {
    const ctx = document.getElementById('campaignChart');
    if (!ctx) return;
    
    if (SupplierCampaigns.state.chart) {
      SupplierCampaigns.state.chart.destroy();
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
      SupplierCampaigns.state.chart = new Chart(ctx, {
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

  openModal: () => {
    console.log('[Campaigns] Opening modal...');
    const modal = document.getElementById('campaign-modal');
    if (!modal) {
      console.error('[Campaigns] Modal element not found!');
      alert('Erreur: Modal non trouvé dans le DOM');
      return;
    }
    
    // Reset form
    const form = document.getElementById('campaign-form');
    if (form) form.reset();
    
    const linkValue = document.getElementById('cta-link-value');
    if (linkValue) linkValue.value = '';
    
    const preview = document.getElementById('campaign-media-preview');
    const placeholder = document.getElementById('campaign-media-placeholder');
    if (preview) {
      preview.src = '';
      preview.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    
    // Charger les produits
    const targetList = document.getElementById('target-products-list');
    const productSelect = document.getElementById('cta-product-select');
    
    const products = SupplierCampaigns.state.products;
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
              <p class="text-xs text-slate-400">${SupplierCampaigns.formatPrice(p.price)}</p>
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
    SupplierCampaigns.handleCtaType('product');
    
    // Afficher le modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    console.log('[Campaigns] Modal opened successfully');
  },

  handleCtaType: (type) => {
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

  updateCtaLink: () => {
    const checked = document.querySelectorAll('input[name="target_products"]:checked');
    const linkValue = document.getElementById('cta-link-value');
    const type = document.querySelector('[name="cta_link_type"]')?.value;
    
    if (!linkValue) return;
    
    if (checked.length > 0 && type === 'product' && !linkValue.value) {
      const firstProductId = checked[0].value;
      linkValue.value = `https://brandia-marketplace.netlify.app/product.html?id=${firstProductId}`;
    }
  },

  save: async () => {
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

    // Gérer l'image
    let mediaUrl = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800';
    const preview = document.getElementById('campaign-media-preview');
    if (preview && !preview.classList.contains('hidden') && preview.src && preview.src.startsWith('http')) {
      mediaUrl = preview.src;
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
      media_type: formData.get('media_type') || 'image',
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
        alert('Campagne créée avec succès !');
        SupplierCampaigns.closeModal();
        form.reset();
        SupplierCampaigns.loadCampaigns();
      } else {
        alert('Erreur: ' + (response.message || 'Inconnue'));
      }
    } catch (error) {
      console.error('[Campaign] Error:', error);
      alert('Erreur réseau: ' + error.message);
    }
  },

  closeModal: () => {
    const modal = document.getElementById('campaign-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  },

  toggleStatus: async (id, newStatus) => {
    try {
      // TODO: Implémenter l'appel API quand le backend sera prêt
      console.log(`[Campaign] Toggle status ${id} -> ${newStatus}`);
      alert(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`);
      SupplierCampaigns.loadCampaigns();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la mise à jour');
    }
  },

  deleteCampaign: async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
    
    try {
      // TODO: Implémenter l'appel API
      console.log(`[Campaign] Delete ${id}`);
      SupplierCampaigns.state.campaigns = SupplierCampaigns.state.campaigns.filter(c => c.id !== id);
      SupplierCampaigns.renderList();
      SupplierCampaigns.loadStats();
      alert('Campagne supprimée');
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  },

  handleMedia: (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Le fichier ne doit pas dépasser 5MB');
      return;
    }
    
    const preview = document.getElementById('campaign-media-preview');
    const placeholder = document.getElementById('campaign-media-placeholder');
    
    if (preview && placeholder) {
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }
  },

  updatePreview: () => {
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

  // Utilitaires
  formatPrice: (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  },

  formatDate: (dateString) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
};

// ============================================
// FONCTIONS GLOBALES EXPOSÉES
// ============================================
window.openCampaignModal = () => {
  console.log('[Global] openCampaignModal called');
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.openModal();
  } else {
    console.error('[Global] SupplierCampaigns not loaded');
    alert('Erreur: Module campagnes non chargé. Rafraîchissez la page.');
  }
};

window.saveCampaign = () => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.save();
  }
};

window.closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

window.toggleCampaignStatus = (id, status) => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.toggleStatus(id, status);
  }
};

window.deleteCampaign = (id) => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.deleteCampaign(id);
  }
};

window.handleCampaignMedia = (e) => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.handleMedia(e);
  }
};

window.updateAdPreview = () => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.updatePreview();
  }
};

window.toggleMediaType = (type) => {
  const input = document.getElementById('campaign-media');
  if (input) input.accept = type === 'video' ? 'video/mp4' : 'image/*';
};

window.handleCtaType = (type) => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.handleCtaType(type);
  }
};

window.updateCtaLink = () => {
  if (window.SupplierCampaigns) {
    window.SupplierCampaigns.updateCtaLink();
  }
};

console.log('[SupplierCampaigns] Module loaded successfully');