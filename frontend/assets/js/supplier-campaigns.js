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
    await SupplierCampaigns.loadProducts();
    await SupplierCampaigns.loadCampaigns();
    await SupplierCampaigns.loadStats();
  },

  loadProducts: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      SupplierCampaigns.state.products = response.data?.products || [];
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  },

  loadCampaigns: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getCampaigns();
      SupplierCampaigns.state.campaigns = response.data || [];
      SupplierCampaigns.renderList();
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
      document.getElementById('campaigns-list').innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
          <p>Créez votre première campagne publicitaire</p>
        </div>
      `;
    }
  },

  loadStats: () => {
    // Calculer les stats réelles ou mockées
    const campaigns = SupplierCampaigns.state.campaigns;
    const totalViews = campaigns.reduce((sum, c) => sum + (c.views_count || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks_count || 0), 0);
    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;

    document.getElementById('ad-views').textContent = totalViews.toLocaleString();
    document.getElementById('ad-clicks').textContent = totalClicks.toLocaleString();
    document.getElementById('ad-ctr').textContent = ctr + '%';
    document.getElementById('ad-conversions').textContent = '0'; // À implémenter
    
    SupplierCampaigns.renderChart();
  },

  renderList: () => {
    const container = document.getElementById('campaigns-list');
    if (!container) return;

    if (SupplierCampaigns.state.campaigns.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
          <p class="text-lg mb-2">Aucune campagne active</p>
          <p class="text-sm mb-4">Créez votre première publicité contextuelle</p>
          <button onclick="SupplierCampaigns.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm bg-gradient-to-r from-pink-500 to-rose-500">
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
            : `<img src="${c.media_url}" class="w-full h-full object-cover">`
          }
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-semibold text-white truncate">${c.name}</h4>
            <span class="badge badge-${c.status} text-xs capitalize">${c.status}</span>
          </div>
          <p class="text-sm text-slate-400 mb-2">${c.headline}</p>
          <div class="flex items-center gap-4 text-xs text-slate-500">
            <span><i class="fas fa-crosshairs mr-1"></i>${c.target_products?.length || 0} produits</span>
            <span><i class="fas fa-calendar mr-1"></i>${DashboardApp.formatDate(c.start_date)} - ${DashboardApp.formatDate(c.end_date)}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="flex items-center gap-4 mb-2">
            <div class="text-center">
              <p class="text-lg font-bold text-white">${c.views_count || 0}</p>
              <p class="text-xs text-slate-500">Vues</p>
            </div>
            <div class="text-center">
              <p class="text-lg font-bold text-indigo-400">${c.clicks_count || 0}</p>
              <p class="text-xs text-slate-500">Clics</p>
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button onclick="SupplierCampaigns.toggleStatus(${c.id}, '${c.status === 'active' ? 'paused' : 'active'}')" 
                    class="px-3 py-1.5 rounded-lg text-xs font-medium ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}">
              ${c.status === 'active' ? '<i class="fas fa-pause mr-1"></i>Pause' : '<i class="fas fa-play mr-1"></i>Activer'}
            </button>
            <button onclick="SupplierCampaigns.delete(${c.id})" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10">
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

    // Données mockées pour l'exemple
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
  },

  openModal: () => {
    const modal = document.getElementById('campaign-modal');
    if (!modal) return;
    
    // Charger les produits cibles
    const targetList = document.getElementById('target-products-list');
    if (targetList && SupplierCampaigns.state.products.length > 0) {
      targetList.innerHTML = SupplierCampaigns.state.products.map(p => `
        <label class="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer">
          <input type="checkbox" name="target_products" value="${p.id}" class="w-4 h-4 rounded border-slate-600 text-indigo-600 bg-slate-700">
          <img src="${p.main_image_url || '/placeholder.jpg'}" class="w-10 h-10 rounded object-cover bg-slate-700">
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">${p.name}</p>
            <p class="text-xs text-slate-400">${DashboardApp.formatPrice(p.price)}</p>
          </div>
        </label>
      `).join('');
    }
    
    // Dates par défaut
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.querySelector('[name="start_date"]').value = today;
    document.querySelector('[name="end_date"]').value = nextMonth;
    
    DashboardApp.openModal('campaign-modal');
  },

  save: async () => {
    const form = document.getElementById('campaign-form');
    const formData = new FormData(form);
    
    const targetProducts = Array.from(form.querySelectorAll('input[name="target_products"]:checked'))
      .map(cb => parseInt(cb.value));
    
    if (targetProducts.length === 0) {
      DashboardApp.showToast('Veuillez sélectionner au moins un produit cible', 'error');
      return;
    }

    const data = {
      name: formData.get('name'),
      headline: formData.get('headline'),
      description: formData.get('description'),
      cta_text: formData.get('cta_text') || 'Voir l\'offre',
      media_type: formData.get('media_type') || 'image',
      target_products: targetProducts,
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date')
    };

    try {
      await BrandiaAPI.Supplier.createCampaign(data);
      DashboardApp.showToast('Campagne créée avec succès !', 'success');
      DashboardApp.closeModal('campaign-modal');
      SupplierCampaigns.loadCampaigns();
    } catch (error) {
      DashboardApp.showToast('Erreur lors de la création', 'error');
    }
  },

  toggleStatus: async (id, newStatus) => {
    try {
      // await BrandiaAPI.Supplier.updateCampaignStatus(id, { status: newStatus });
      DashboardApp.showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
      SupplierCampaigns.loadCampaigns();
    } catch (error) {
      DashboardApp.showToast('Erreur', 'error');
    }
  },

  delete: async (id) => {
    if (!confirm('Supprimer cette campagne ?')) return;
    try {
      // await BrandiaAPI.Supplier.deleteCampaign(id);
      SupplierCampaigns.state.campaigns = SupplierCampaigns.state.campaigns.filter(c => c.id !== id);
      SupplierCampaigns.renderList();
      DashboardApp.showToast('Campagne supprimée', 'success');
    } catch (error) {
      DashboardApp.showToast('Erreur', 'error');
    }
  },

  handleMedia: (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      DashboardApp.showToast('Le fichier ne doit pas dépasser 5MB', 'error');
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
    
    document.getElementById('ad-preview-headline').textContent = headline;
    document.getElementById('ad-preview-desc').textContent = desc;
    document.getElementById('ad-preview-cta').textContent = cta;
  }
};

window.openCampaignModal = () => SupplierCampaigns.openModal();
window.saveCampaign = () => SupplierCampaigns.save();
window.toggleCampaignStatus = (id, status) => SupplierCampaigns.toggleStatus(id, status);
window.deleteCampaign = (id) => SupplierCampaigns.delete(id);
window.handleCampaignMedia = (e) => SupplierCampaigns.handleMedia(e);
window.updateAdPreview = () => SupplierCampaigns.updatePreview();
window.toggleMediaType = (type) => {
  const input = document.getElementById('campaign-media');
  if (input) input.accept = type === 'video' ? 'video/mp4' : 'image/*';
};