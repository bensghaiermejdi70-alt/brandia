// ============================================
// SUPPLIER PROMOTIONS MODULE - v2.0 CORRIGÉ
// Fix: Noms de champs alignés avec le backend (discount_type, discount_value)
// ============================================

window.SupplierPromotions = {
  state: {
    promotions: [],
    isLoading: false,
    editingId: null
  },

  init: async function() {
  console.log('[Promotions] Initialisation v2.0...');
  await this.loadPromotions(); // 🔥 Attendre le chargement
  this.setupEventListeners();
},

  setupEventListeners: function() {
    // Fermeture modal avec Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  loadPromotions: async function() {
    try {
      this.showLoading(true);
      console.log('[Promotions] Chargement...');

      if (!window.BrandiaAPI || !BrandiaAPI.Supplier) {
        throw new Error('API non disponible');
      }

      const response = await BrandiaAPI.Supplier.getPromotions();
      console.log('[Promotions] Réponse:', response);

      if (!response?.success) {
        throw new Error(response?.message || 'Erreur de chargement');
      }

      // 🔥 CORRECTION: Gestion flexible des données
      let promotionsData = [];
      if (Array.isArray(response.data)) {
        promotionsData = response.data;
      } else if (response.data?.promotions) {
        promotionsData = response.data.promotions;
      } else if (response.data?.data) {
        promotionsData = response.data.data;
      }

      this.state.promotions = promotionsData.map(p => ({
        ...p,
        // Normalisation des champs
        id: p.id,
        code: p.code || '',
        name: p.name || p.code || 'Promotion sans nom',
        // 🔥 IMPORTANT: Utiliser les noms de champs du backend
        discount_type: p.discount_type || p.type || 'percentage',
        discount_value: parseFloat(p.discount_value || p.value || p.amount || 0),
        minimum_order: parseFloat(p.minimum_order || p.min_order || 0),
        start_date: p.start_date || p.startDate || new Date().toISOString(),
        end_date: p.end_date || p.endDate || null,
        usage_limit: p.usage_limit || p.max_uses || null,
        usage_count: p.usage_count || p.used_count || 0,
        status: p.status || 'active'
      }));

      console.log(`[Promotions] ${this.state.promotions.length} promotions chargées`);
      this.renderPromotions();

    } catch (error) {
      console.error('[Promotions] Erreur chargement:', error);
      this.showToast('Erreur chargement promotions: ' + error.message, 'error');
      this.renderEmpty();
    } finally {
      this.showLoading(false);
    }
  },

  renderPromotions: function() {
    const container = document.getElementById('active-promotions');
    if (!container) {
      console.warn('[Promotions] Container #active-promotions non trouvé');
      return;
    }

    if (this.state.promotions.length === 0) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    container.innerHTML = this.state.promotions.map(promo => {
      const isActive = promo.status === 'active';
      const isExpired = promo.end_date && new Date(promo.end_date) < new Date();
      const usagePercent = promo.usage_limit ? 
        Math.round((promo.usage_count / promo.usage_limit) * 100) : 0;

      // Format de la réduction
      let discountText = '';
      if (promo.discount_type === 'percentage') {
        discountText = `-${promo.discount_value}%`;
      } else if (promo.discount_type === 'fixed') {
        discountText = `-${promo.discount_value.toFixed(2)}€`;
      } else {
        discountText = `-${promo.discount_value}`;
      }

      return `
        <div class="promotion-card p-6 border-b border-slate-800 hover:bg-slate-800/30 transition-colors" data-promo-id="${promo.id}">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                ${discountText}
              </div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="text-lg font-bold text-white">${promo.code}</h4>
                  <span class="px-2 py-0.5 rounded text-xs font-medium ${isActive && !isExpired ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
                    ${isActive && !isExpired ? 'Active' : isExpired ? 'Expirée' : 'Inactive'}
                  </span>
                </div>
                <p class="text-slate-400 text-sm">
                  ${promo.discount_type === 'percentage' ? 'Réduction en pourcentage' : 'Réduction fixe'}
                  ${promo.minimum_order > 0 ? ` • Min. ${promo.minimum_order.toFixed(2)}€` : ''}
                </p>
                <p class="text-slate-500 text-xs mt-1">
                  <i class="far fa-calendar-alt mr-1"></i>
                  ${this.formatDate(promo.start_date)} - ${promo.end_date ? this.formatDate(promo.end_date) : 'Illimité'}
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="SupplierPromotions.editPromotion('${promo.id}')" 
                      class="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors" title="Modifier">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="SupplierPromotions.deletePromotion('${promo.id}')" 
                      class="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          ${promo.usage_limit ? `
            <div class="mt-4">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-slate-400">Utilisations</span>
                <span class="text-white font-medium">${promo.usage_count} / ${promo.usage_limit}</span>
              </div>
              <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full transition-all" style="width: ${Math.min(usagePercent, 100)}%"></div>
              </div>
            </div>
          ` : `
            <div class="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <i class="fas fa-infinity"></i>
              <span>Utilisations illimitées (${promo.usage_count} utilisé${promo.usage_count > 1 ? 's' : ''})</span>
            </div>
          `}
        </div>
      `;
    }).join('');
  },

  renderEmptyState: function() {
    return `
      <div class="p-8 text-center text-slate-500">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <i class="fas fa-percent text-3xl opacity-50"></i>
        </div>
        <p class="text-lg font-medium text-white mb-2">Aucune promotion active</p>
        <p class="text-sm mb-4">Créez votre première promotion pour booster vos ventes</p>
        <button onclick="SupplierPromotions.openModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors">
          <i class="fas fa-plus mr-2"></i>Créer une promotion
        </button>
      </div>
    `;
  },

  renderEmpty: function() {
    const container = document.getElementById('active-promotions');
    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-400">
          <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
          <p>Erreur de chargement</p>
          <button onclick="SupplierPromotions.loadPromotions()" class="mt-3 px-4 py-2 bg-slate-700 rounded-lg text-white text-sm">
            Réessayer
          </button>
        </div>
      `;
    }
  },

  openModal: function(promoId = null) {
    this.state.editingId = promoId;
    
    const modal = document.getElementById('promotion-modal') || this.createModal();
    const title = document.getElementById('promo-modal-title');
    const form = document.getElementById('promotion-form');
    
    if (form) form.reset();
    
    if (promoId) {
      const promo = this.state.promotions.find(p => p.id === promoId);
      if (!promo) {
        this.showToast('Promotion non trouvée', 'error');
        return;
      }
      
      if (title) title.textContent = 'Modifier la promotion';
      
      // Remplir le formulaire
      document.getElementById('promo-code').value = promo.code || '';
      document.getElementById('promo-type').value = promo.discount_type || 'percentage';
      document.getElementById('promo-value').value = promo.discount_value || '';
      document.getElementById('promo-min-order').value = promo.minimum_order || '';
      document.getElementById('promo-start').value = promo.start_date ? promo.start_date.split('T')[0] : '';
      document.getElementById('promo-end').value = promo.end_date ? promo.end_date.split('T')[0] : '';
      document.getElementById('promo-usage-limit').value = promo.usage_limit || '';
    } else {
      if (title) title.textContent = 'Nouvelle promotion';
      
      // Valeurs par défaut
      document.getElementById('promo-start').value = new Date().toISOString().split('T')[0];
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  },

  createModal: function() {
    // Créer le modal s'il n'existe pas
    const modal = document.createElement('div');
    modal.id = 'promotion-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div class="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 id="promo-modal-title" class="text-xl font-bold text-white">Nouvelle promotion</h3>
          <button onclick="SupplierPromotions.closeModal()" class="text-slate-400 hover:text-white">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <form id="promotion-form" class="p-6 space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">Code promo *</label>
            <input type="text" id="promo-code" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none uppercase" placeholder="EX: SUMMER2024">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-400 mb-2">Type de réduction *</label>
              <select id="promo-type" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none">
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed">Montant fixe (€)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-2">Valeur *</label>
              <input type="number" id="promo-value" required step="0.01" min="0" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" placeholder="20">
            </div>
          </div>
          
          <div>
            <label class="block text-sm text-slate-400 mb-2">Commande minimum (€)</label>
            <input type="number" id="promo-min-order" step="0.01" min="0" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" placeholder="0 = pas de minimum">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-400 mb-2">Date de début *</label>
              <input type="date" id="promo-start" required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none">
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-2">Date de fin</label>
              <input type="date" id="promo-end" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none">
            </div>
          </div>
          
          <div>
            <label class="block text-sm text-slate-400 mb-2">Limite d'utilisation</label>
            <input type="number" id="promo-usage-limit" min="1" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" placeholder="Vide = illimité">
          </div>
        </form>
        
        <div class="p-6 border-t border-slate-800 flex gap-3">
          <button onclick="SupplierPromotions.closeModal()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors">Annuler</button>
          <button onclick="SupplierPromotions.save()" class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  },

  closeModal: function() {
    const modal = document.getElementById('promotion-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
    this.state.editingId = null;
  },

  save: async function() {
    try {
      const code = document.getElementById('promo-code')?.value?.trim().toUpperCase();
      const discount_type = document.getElementById('promo-type')?.value;
      const discount_value = parseFloat(document.getElementById('promo-value')?.value);
      const minimum_order = parseFloat(document.getElementById('promo-min-order')?.value) || 0;
      const start_date = document.getElementById('promo-start')?.value;
      const end_date = document.getElementById('promo-end')?.value || null;
      const usage_limit = document.getElementById('promo-usage-limit')?.value ? 
        parseInt(document.getElementById('promo-usage-limit').value) : null;

      // Validation
      if (!code || code.length < 3) {
        this.showToast('Le code promo doit contenir au moins 3 caractères', 'error');
        return;
      }

      if (!discount_type || !['percentage', 'fixed'].includes(discount_type)) {
        this.showToast('Type de réduction invalide', 'error');
        return;
      }

      if (isNaN(discount_value) || discount_value <= 0) {
        this.showToast('Veuillez saisir une valeur valide', 'error');
        return;
      }

      if (discount_type === 'percentage' && discount_value > 100) {
        this.showToast('Le pourcentage ne peut pas dépasser 100%', 'error');
        return;
      }

      if (!start_date) {
        this.showToast('La date de début est requise', 'error');
        return;
      }

      // 🔥 CORRECTION: Construction des données avec les noms de champs exacts attendus par le backend
      const data = {
        code: code,
        discount_type: discount_type,  // ← Backend attend ce nom exact
        discount_value: discount_value, // ← Backend attend ce nom exact
        minimum_order: minimum_order,
        start_date: start_date,
        end_date: end_date,
        usage_limit: usage_limit,
        status: 'active'
      };

      console.log('[Promotions Save] Données envoyées:', data);

      this.showLoading(true);

      let response;
      if (this.state.editingId) {
        response = await BrandiaAPI.Supplier.updatePromotion(this.state.editingId, data);
      } else {
        response = await BrandiaAPI.Supplier.createPromotion(data);
      }

      if (response?.success) {
        this.showToast(this.state.editingId ? 'Promotion mise à jour ✓' : 'Promotion créée ✓', 'success');
        this.closeModal();
        await this.loadPromotions();
      } else {
        throw new Error(response?.message || 'Erreur lors de la sauvegarde');
      }

    } catch (error) {
      console.error('[Promotions Save] Erreur:', error);
      this.showToast('Erreur: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  },

  editPromotion: function(id) {
    this.openModal(id);
  },

  deletePromotion: async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette promotion ?')) return;

    try {
      this.showLoading(true);
      const response = await BrandiaAPI.Supplier.deletePromotion(id);
      
      if (response?.success) {
        this.showToast('Promotion supprimée ✓', 'success');
        await this.loadPromotions();
      } else {
        throw new Error(response?.message || 'Erreur de suppression');
      }
    } catch (error) {
      this.showToast('Erreur: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  },

  formatDate: function(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  showLoading: function(show) {
    if (window.showLoading) {
      showLoading(show);
    } else {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.classList.toggle('hidden', !show);
    }
  },

  showToast: function(message, type = 'success') {
    if (window.showToast) {
      showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
      if (type === 'error') alert(message);
    }
  }
};

// Exposition globale
window.openPromotionModal = () => SupplierPromotions.openModal();
window.closePromotionModal = () => SupplierPromotions.closeModal();

console.log('[SupplierPromotions] Module v2.0 chargé - Champs discount_type/discount_value corrigés');