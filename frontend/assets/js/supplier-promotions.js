// ============================================
// SUPPLIER PROMOTIONS MODULE
// ============================================

window.SupplierPromotions = {
  state: {
    promotions: [],
    products: []
  },

  init: async () => {
    await SupplierPromotions.loadProducts();
    await SupplierPromotions.loadPromotions();
  },

  loadProducts: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      SupplierPromotions.state.products = response.data?.products || [];
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  },

  loadPromotions: async () => {
    try {
      DashboardApp.showLoading(true);
      // Simulation - remplacer par vrai appel API quand prêt
      // const response = await BrandiaAPI.Supplier.getPromotions();
      // SupplierPromotions.state.promotions = response.data || [];
      
      // Données mockées pour démo
      SupplierPromotions.state.promotions = [
        {
          id: 1,
          name: 'Soldes d\'hiver',
          type: 'percentage',
          value: 20,
          code: 'HIVER20',
          usage_count: 45,
          max_usage: 100,
          status: 'active',
          start_date: '2026-01-15',
          end_date: '2026-02-28'
        }
      ];
      
      SupplierPromotions.render();
    } catch (error) {
      console.error('Erreur chargement promotions:', error);
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  render: () => {
    const container = document.getElementById('active-promotions');
    if (!container) return;

    if (SupplierPromotions.state.promotions.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-percent text-4xl mb-4 opacity-50"></i>
          <p class="text-lg mb-2">Aucune promotion active</p>
          <p class="text-sm mb-4">Créez votre première promotion pour booster vos ventes</p>
          <button onclick="SupplierPromotions.openModal()" class="btn-primary px-6 py-3 rounded-lg text-sm">
            <i class="fas fa-plus mr-2"></i>Créer une promotion
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = SupplierPromotions.state.promotions.map(p => `
      <div class="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-lg ${p.type === 'percentage' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'} flex items-center justify-center">
            <i class="fas ${p.type === 'percentage' ? 'fa-percent' : 'fa-euro-sign'} text-xl"></i>
          </div>
          <div>
            <h4 class="font-semibold text-white">${p.name}</h4>
            <p class="text-sm text-slate-400">
              ${p.type === 'percentage' ? '-' + p.value + '%' : '-' + p.value + '€'} 
              avec code <span class="font-mono bg-slate-700 px-2 py-0.5 rounded text-indigo-300">${p.code}</span>
            </p>
            <p class="text-xs text-slate-500 mt-1">
              ${p.usage_count || 0} / ${p.max_usage || '∞'} utilisations • 
              Jusqu'au ${new Date(p.end_date).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="badge badge-${p.status} capitalize">${p.status === 'active' ? 'Active' : 'Inactive'}</span>
          <button onclick="SupplierPromotions.edit(${p.id})" class="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300">
            <i class="fas fa-edit text-xs"></i>
          </button>
          <button onclick="SupplierPromotions.delete(${p.id})" class="w-8 h-8 bg-red-600/20 hover:bg-red-600 rounded-lg flex items-center justify-center text-red-400 hover:text-white">
            <i class="fas fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    `).join('');
  },

  openModal: (promoId = null) => {
    const modal = document.getElementById('promotion-modal');
    if (!modal) {
      // Créer le modal s'il n'existe pas
      SupplierPromotions.createModal();
      return;
    }
    
    if (promoId) {
      const promo = SupplierPromotions.state.promotions.find(p => p.id === promoId);
      if (promo) {
        document.getElementById('promo-name').value = promo.name;
        document.getElementById('promo-type').value = promo.type;
        document.getElementById('promo-value').value = promo.value;
        document.getElementById('promo-code').value = promo.code;
        document.getElementById('promo-start').value = promo.start_date;
        document.getElementById('promo-end').value = promo.end_date;
      }
    } else {
      document.getElementById('promotion-form')?.reset();
      // Dates par défaut
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      document.getElementById('promo-start').value = today;
      document.getElementById('promo-end').value = nextMonth;
    }
    
    DashboardApp.openModal('promotion-modal');
  },

  createModal: () => {
    // Création dynamique du modal si non présent dans HTML
    const html = `
      <div id="promotion-modal" class="fixed inset-0 z-50 hidden">
        <div class="modal-backdrop absolute inset-0" onclick="closeModal('promotion-modal')"></div>
        <div class="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl p-6">
          <h3 class="text-xl font-bold mb-6">Nouvelle promotion</h3>
          <form id="promotion-form" class="space-y-4">
            <div>
              <label class="block text-sm text-slate-400 mb-2">Nom de la promotion</label>
              <input type="text" id="promo-name" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white" placeholder="Ex: Soldes d'hiver">
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Type</label>
                <select id="promo-type" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white">
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (€)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-2">Valeur</label>
                <input type="number" id="promo-value" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white" placeholder="20">
              </div>
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-2">Code promo</label>
              <input type="text" id="promo-code" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono uppercase" placeholder="HIVER20">
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Date de début</label>
                <input type="date" id="promo-start" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white">
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-2">Date de fin</label>
                <input type="date" id="promo-end" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white">
              </div>
            </div>
          </form>
          <div class="mt-6 flex justify-end gap-3">
            <button onclick="closeModal('promotion-modal')" class="px-6 py-2.5 text-slate-400 hover:text-white">Annuler</button>
            <button onclick="SupplierPromotions.save()" class="btn-primary px-6 py-2.5 rounded-lg">Créer la promotion</button>
          </div>
        </div>
      </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    DashboardApp.openModal('promotion-modal');
  },

  save: async () => {
    const data = {
      name: document.getElementById('promo-name')?.value,
      type: document.getElementById('promo-type')?.value,
      value: parseFloat(document.getElementById('promo-value')?.value),
      code: document.getElementById('promo-code')?.value?.toUpperCase(),
      start_date: document.getElementById('promo-start')?.value,
      end_date: document.getElementById('promo-end')?.value
    };

    if (!data.name || !data.value || !data.code) {
      DashboardApp.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    DashboardApp.showToast('Promotion créée avec succès !', 'success');
    DashboardApp.closeModal('promotion-modal');
    
    // Ajout temporaire à la liste locale
    SupplierPromotions.state.promotions.push({
      id: Date.now(),
      ...data,
      status: 'active',
      usage_count: 0
    });
    SupplierPromotions.render();
  },

  edit: (id) => {
    SupplierPromotions.openModal(id);
  },

  delete: async (id) => {
    if (!confirm('Supprimer cette promotion ?')) return;
    SupplierPromotions.state.promotions = SupplierPromotions.state.promotions.filter(p => p.id !== id);
    SupplierPromotions.render();
    DashboardApp.showToast('Promotion supprimée', 'success');
  }
};

window.openPromotionModal = () => SupplierPromotions.openModal();