// ============================================
// SUPPLIER PROMOTIONS MODULE - Version Persistante
// ============================================

window.SupplierPromotions = {
  state: {
    promotions: [],
    products: [],
    editingId: null
  },

  init: async () => {
    await SupplierPromotions.loadPromotions();
  },

  loadPromotions: async () => {
    try {
      DashboardApp.showLoading(true);
      
      // Appel API réel
      const response = await BrandiaAPI.Supplier.getPromotions();
      
      if (response.success) {
        SupplierPromotions.state.promotions = response.data || [];
      } else {
        console.error('Erreur chargement promotions:', response.message);
        SupplierPromotions.state.promotions = [];
      }
      
      SupplierPromotions.render();
    } catch (error) {
      console.error('Erreur chargement promotions:', error);
      DashboardApp.showToast('Erreur de chargement des promotions', 'error');
      SupplierPromotions.state.promotions = [];
      SupplierPromotions.render();
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
      <div class="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0">
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
    SupplierPromotions.state.editingId = promoId;
    const modal = document.getElementById('promotion-modal');
    
    if (!modal) {
      SupplierPromotions.createModal();
      return;
    }
    
    // Reset form
    document.getElementById('promotion-form')?.reset();
    
    if (promoId) {
      const promo = SupplierPromotions.state.promotions.find(p => p.id === promoId);
      if (promo) {
        document.getElementById('promo-name').value = promo.name;
        document.getElementById('promo-type').value = promo.type;
        document.getElementById('promo-value').value = promo.value;
        document.getElementById('promo-code').value = promo.code;
        document.getElementById('promo-max-usage').value = promo.max_usage || '';
        document.getElementById('promo-start').value = promo.start_date?.split('T')[0] || promo.start_date;
        document.getElementById('promo-end').value = promo.end_date?.split('T')[0] || promo.end_date;
        
        // Changer le texte du bouton
        const submitBtn = document.querySelector('#promotion-modal button[onclick="SupplierPromotions.save()"]');
        if (submitBtn) submitBtn.textContent = 'Mettre à jour';
      }
    } else {
      // Valeurs par défaut pour nouvelle promo
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      document.getElementById('promo-start').value = today;
      document.getElementById('promo-end').value = nextMonth;
      
      const submitBtn = document.querySelector('#promotion-modal button[onclick="SupplierPromotions.save()"]');
      if (submitBtn) submitBtn.textContent = 'Créer la promotion';
    }
    
    DashboardApp.openModal('promotion-modal');
  },

  createModal: () => {
    const html = `
      <div id="promotion-modal" class="fixed inset-0 z-50 hidden">
        <div class="modal-backdrop absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeModal('promotion-modal')"></div>
        <div class="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <h3 class="text-xl font-bold mb-6 text-white">${SupplierPromotions.state.editingId ? 'Modifier' : 'Nouvelle'} promotion</h3>
          <form id="promotion-form" class="space-y-4" onsubmit="event.preventDefault(); SupplierPromotions.save();">
            <div>
              <label class="block text-sm text-slate-400 mb-2">Nom de la promotion *</label>
              <input type="text" id="promo-name" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" placeholder="Ex: Soldes d'hiver">
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Type *</label>
                <select id="promo-type" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none">
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (€)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-2">Valeur *</label>
                <input type="number" id="promo-value" required min="1" step="0.01" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" placeholder="20">
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Code promo *</label>
                <input type="text" id="promo-code" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono uppercase focus:border-indigo-500 focus:outline-none" placeholder="HIVER20">
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-2">Usage max (laisser vide = illimité)</label>
                <input type="number" id="promo-max-usage" min="1" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" placeholder="100">
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Date de début *</label>
                <input type="date" id="promo-start" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none">
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-2">Date de fin *</label>
                <input type="date" id="promo-end" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none">
              </div>
            </div>
            
            <div class="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button type="button" onclick="closeModal('promotion-modal')" class="px-6 py-2.5 text-slate-400 hover:text-white transition-colors">Annuler</button>
              <button type="submit" class="btn-primary px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
                ${SupplierPromotions.state.editingId ? 'Mettre à jour' : 'Créer la promotion'}
              </button>
            </div>
          </form>
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
      name: document.getElementById('promo-name')?.value?.trim(),
      type: document.getElementById('promo-type')?.value,
      value: parseFloat(document.getElementById('promo-value')?.value),
      code: document.getElementById('promo-code')?.value?.trim().toUpperCase(),
      max_usage: document.getElementById('promo-max-usage')?.value ? parseInt(document.getElementById('promo-max-usage').value) : null,
      start_date: document.getElementById('promo-start')?.value,
      end_date: document.getElementById('promo-end')?.value
    };

    // Validation
    if (!data.name || !data.value || !data.code || !data.start_date || !data.end_date) {
      DashboardApp.showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    if (data.value <= 0) {
      DashboardApp.showToast('La valeur doit être supérieure à 0', 'error');
      return;
    }

    if (new Date(data.end_date) < new Date(data.start_date)) {
      DashboardApp.showToast('La date de fin doit être après la date de début', 'error');
      return;
    }

    try {
      DashboardApp.showLoading(true);
      
      let response;
      if (SupplierPromotions.state.editingId) {
        // Modification
        response = await BrandiaAPI.Supplier.updatePromotion(SupplierPromotions.state.editingId, data);
        if (response.success) {
          DashboardApp.showToast('Promotion mise à jour avec succès', 'success');
        }
      } else {
        // Création
        response = await BrandiaAPI.Supplier.createPromotion(data);
        if (response.success) {
          DashboardApp.showToast('Promotion créée avec succès', 'success');
        }
      }
      
      if (response.success) {
        DashboardApp.closeModal('promotion-modal');
        await SupplierPromotions.loadPromotions(); // Recharger la liste
      } else {
        DashboardApp.showToast(response.message || 'Erreur lors de la sauvegarde', 'error');
      }
    } catch (error) {
      console.error('Erreur sauvegarde promotion:', error);
      DashboardApp.showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  edit: (id) => {
    SupplierPromotions.openModal(id);
  },

  delete: async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette promotion ?')) return;
    
    try {
      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.deletePromotion(id);
      
      if (response.success) {
        DashboardApp.showToast('Promotion supprimée', 'success');
        await SupplierPromotions.loadPromotions();
      } else {
        DashboardApp.showToast(response.message || 'Erreur lors de la suppression', 'error');
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      DashboardApp.showToast('Erreur lors de la suppression', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  }
};

window.openPromotionModal = () => SupplierPromotions.openModal();