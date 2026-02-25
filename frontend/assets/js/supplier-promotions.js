// ============================================
// SUPPLIER PROMOTIONS MODULE - v3.1 PRODUCTION READY
// Corrections: Validation robuste, Gestion dates TZ, Modal cleanup, Error mapping
// ============================================

window.SupplierPromotions = {
  state: {
    promotions: [],
    products: [],
    editingId: null,
    isSaving: false,
    activeTab: 'active' // 'active' | 'expired' | 'all'
  },

  // Configuration validation
  CONFIG: {
    PROMO_CODE_REGEX: /^[A-Z0-9_-]{3,20}$/,
    MIN_VALUE: { percentage: 1, fixed: 0.01 },
    MAX_VALUE: { percentage: 100, fixed: 10000 },
    DATE_BUFFER_DAYS: 1 // Buffer pour éviter les problèmes de fuseau horaire
  },

  // ==========================================
  // INITIALISATION
  // ==========================================
  init: async function() {
    console.log('[Promotions] Initialisation v3.1...');
    await this.loadPromotions();
    this.setupEventListeners();
  },

  setupEventListeners: function() {
    // Écouteur pour changement d'onglet
    document.querySelectorAll('[data-promo-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.promoTab;
        this.state.activeTab = tab;
        this.render();
        
        // Update UI active state
        document.querySelectorAll('[data-promo-tab]').forEach(b => {
          b.classList.toggle('bg-indigo-600', b.dataset.promoTab === tab);
          b.classList.toggle('text-white', b.dataset.promoTab === tab);
          b.classList.toggle('bg-slate-800', b.dataset.promoTab !== tab);
          b.classList.toggle('text-slate-300', b.dataset.promoTab !== tab);
        });
      });
    });

    // Validation en temps réel du code promo
    const codeInput = document.getElementById('promo-code');
    if (codeInput) {
      codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        this.validateCodePreview(e.target.value);
      });
    }

    // Changement type promotion pour ajuster les labels
    const typeSelect = document.getElementById('promo-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.updateTypeLabels(e.target.value);
      });
    }
  },

  // ==========================================
  // CHARGEMENT DES PROMOTIONS
  // ==========================================
  loadPromotions: async function() {
    try {
      console.log('[Promotions] Chargement...');
      DashboardApp?.showLoading?.(true);

      if (!window.BrandiaAPI?.Supplier?.getPromotions) {
        throw new Error('API promotions non disponible');
      }

      const response = await BrandiaAPI.Supplier.getPromotions();
      console.log('[Promotions] Réponse API:', response);

      if (!response?.success) {
        throw new Error(response?.message || 'Erreur chargement promotions');
      }

      // Tri : actives d'abord, puis par date de fin décroissante
      this.state.promotions = (response.data || [])
        .map(p => ({
          ...p,
          // Normalisation dates avec gestion TZ
          start_date: this.normalizeDate(p.start_date),
          end_date: this.normalizeDate(p.end_date),
          // Calcul statut réel basé sur dates serveur
          _is_active: this.isPromotionActive(p)
        }))
        .sort((a, b) => {
          if (a._is_active !== b._is_active) return b._is_active - a._is_active;
          return new Date(b.end_date) - new Date(a.end_date);
        });

      console.log('[Promotions] Chargées:', this.state.promotions.length);
      this.render();
      this.updateStats();

    } catch (error) {
      console.error('[Promotions] Erreur chargement:', error);
      DashboardApp?.showToast?.(
        'Impossible de charger les promotions: ' + (error.message || 'Erreur inconnue'),
        'error'
      );
      this.state.promotions = [];
      this.render();
    } finally {
      DashboardApp?.showLoading?.(false);
    }
  },

  // Normalisation date avec gestion fuseau horaire
  normalizeDate: function(dateInput) {
    if (!dateInput) return null;
    
    // Si déjà une Date, retourner
    if (dateInput instanceof Date) return dateInput;
    
    // Si string ISO, créer Date locale
    if (typeof dateInput === 'string') {
      // Ajouter le buffer pour éviter les décalages TZ
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + this.CONFIG.DATE_BUFFER_DAYS);
        return date;
      }
    }
    
    return null;
  },

  // Vérifie si une promotion est active selon dates serveur
  isPromotionActive: function(promo) {
    if (!promo || promo.status !== 'active') return false;
    
    const now = new Date();
    const start = this.normalizeDate(promo.start_date);
    const end = this.normalizeDate(promo.end_date);
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    
    return true;
  },

  // ==========================================
  // RENDU DE LA LISTE
  // ==========================================
  render: function() {
    const container = document.getElementById('active-promotions');
    const tabsContainer = document.getElementById('promo-tabs');
    
    if (!container) {
      console.error('[Promotions] Container #active-promotions non trouvé');
      return;
    }

    // Filtrer selon onglet actif
    let filtered = this.state.promotions;
    if (this.state.activeTab === 'active') {
      filtered = filtered.filter(p => p._is_active);
    } else if (this.state.activeTab === 'expired') {
      filtered = filtered.filter(p => !p._is_active);
    }

    // Rendu des onglets si présent
    if (tabsContainer) {
      const counts = {
        active: this.state.promotions.filter(p => p._is_active).length,
        expired: this.state.promotions.filter(p => !p._is_active).length,
        all: this.state.promotions.length
      };
      
      tabsContainer.innerHTML = `
        <div class="flex gap-2 overflow-x-auto pb-2">
          <button data-promo-tab="active" 
                  class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    this.state.activeTab === 'active' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }">
            Actives <span class="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">${counts.active}</span>
          </button>
          <button data-promo-tab="expired" 
                  class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    this.state.activeTab === 'expired' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }">
            Expirées <span class="ml-2 bg-slate-700 px-2 py-0.5 rounded-full text-xs">${counts.expired}</span>
          </button>
          <button data-promo-tab="all" 
                  class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    this.state.activeTab === 'all' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }">
            Toutes <span class="ml-2 bg-slate-700 px-2 py-0.5 rounded-full text-xs">${counts.all}</span>
          </button>
        </div>
      `;
    }

    // État vide
    if (filtered.length === 0) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    // Rendu liste
    container.innerHTML = filtered.map(p => this.renderPromotionCard(p)).join('');
  },

  renderEmptyState: function() {
    const isExpired = this.state.activeTab === 'expired';
    return `
      <div class="p-8 text-center text-slate-500">
        <i class="fas ${isExpired ? 'fa-hourglass-end' : 'fa-percent'} text-4xl mb-4 opacity-50"></i>
        <p class="text-lg mb-2">${isExpired ? 'Aucune promotion expirée' : 'Aucune promotion active'}</p>
        <p class="text-sm mb-4">${
          isExpired 
            ? 'Les promotions expirées apparaîtront ici' 
            : 'Créez votre première promotion pour booster vos ventes'
        }</p>
        ${!isExpired ? `
          <button onclick="SupplierPromotions.openModal()" 
                  class="btn-primary px-6 py-3 rounded-lg text-sm font-medium inline-flex items-center gap-2">
            <i class="fas fa-plus"></i>Créer une promotion
          </button>
        ` : ''}
      </div>
    `;
  },

  renderPromotionCard: function(p) {
    const isActive = p._is_active;
    const isPercentage = p.type === 'percentage';
    const valueDisplay = isPercentage ? `-${p.value}%` : `-${parseFloat(p.value).toFixed(2)}€`;
    const iconClass = isPercentage 
      ? 'bg-indigo-500/20 text-indigo-400 fa-percent' 
      : 'bg-emerald-500/20 text-emerald-400 fa-euro-sign';
    
    // Formatage dates
    const formatDate = (date) => {
      if (!date) return '—';
      return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };

    // Badge statut
    const statusBadge = isActive 
      ? `<span class="badge badge-active">Active</span>`
      : `<span class="badge badge-secondary text-slate-400">Expirée</span>`;

    // Usage
    const usageText = p.max_usage 
      ? `${p.usage_count || 0} / ${p.max_usage}`
      : `${p.usage_count || 0} utilisations`;

    return `
      <div class="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 group">
        <div class="flex items-center gap-4 min-w-0">
          <div class="w-12 h-12 rounded-lg ${iconClass} flex items-center justify-center flex-shrink-0">
            <i class="fas ${iconClass.split(' ')[1]} text-xl"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-semibold text-white truncate">${p.name || 'Sans nom'}</h4>
              ${statusBadge}
            </div>
            <p class="text-sm text-slate-400">
              ${valueDisplay} avec code 
              <span class="font-mono bg-slate-700 px-2 py-0.5 rounded text-indigo-300 select-all">${p.code || '—'}</span>
            </p>
            <p class="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
              <span><i class="fas fa-calendar mr-1"></i>${formatDate(p.start_date)} → ${formatDate(p.end_date)}</span>
              <span>•</span>
              <span><i class="fas fa-ticket-alt mr-1"></i>${usageText}</span>
              ${p.applies_to && p.applies_to !== 'all' ? `<span>• ${p.applies_to === 'category' ? 'Catégorie' : 'Produits spécifiques'}</span>` : ''}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 campaign-actions opacity-0 group-hover:opacity-100 transition-opacity">
          ${isActive ? `
            <button onclick="SupplierPromotions.toggleStatus(${p.id}, 'paused')" 
                    class="w-8 h-8 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 transition-colors"
                    title="Mettre en pause">
              <i class="fas fa-pause text-xs"></i>
            </button>
          ` : `
            <button onclick="SupplierPromotions.toggleStatus(${p.id}, 'active')" 
                    class="w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 transition-colors"
                    title="Réactiver">
              <i class="fas fa-play text-xs"></i>
            </button>
          `}
          <button onclick="SupplierPromotions.edit(${p.id})" 
                  class="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-colors"
                  title="Modifier">
            <i class="fas fa-edit text-xs"></i>
          </button>
          <button onclick="SupplierPromotions.delete(${p.id})" 
                  class="w-8 h-8 bg-red-600/20 hover:bg-red-600 rounded-lg flex items-center justify-center text-red-400 hover:text-white transition-colors"
                  title="Supprimer">
            <i class="fas fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    `;
  },

  updateStats: function() {
    const activeCount = this.state.promotions.filter(p => p._is_active).length;
    const totalUsage = this.state.promotions.reduce((sum, p) => sum + (p.usage_count || 0), 0);
    
    const statsEl = document.getElementById('promo-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="flex gap-4 text-sm">
          <span><strong class="text-white">${activeCount}</strong> actives</span>
          <span>•</span>
          <span><strong class="text-white">${totalUsage}</strong> utilisations totales</span>
        </div>
      `;
    }
  },

  // ==========================================
  // MODAL - CRÉATION/ÉDITION
  // ==========================================
  openModal: function(promoId = null) {
    // Protection contre ouverture multiple
    if (document.getElementById('promotion-modal')) {
      console.warn('[Promotions] Modal déjà ouvert');
      return;
    }

    this.state.editingId = promoId;
    this.state.isSaving = false;

    // Créer le modal si n'existe pas
    if (!document.getElementById('promotion-modal')) {
      this.createModal();
    }

    const modal = document.getElementById('promotion-modal');
    if (!modal) return;

    // Reset form
    const form = document.getElementById('promotion-form');
    if (form) form.reset();

    // Mise à jour labels selon type
    this.updateTypeLabels('percentage');

    if (promoId) {
      // Mode édition
      const promo = this.state.promotions.find(p => p.id === promoId);
      if (!promo) {
        DashboardApp?.showToast?.('Promotion non trouvée', 'error');
        return;
      }

      this.fillForm(promo);
      this.updateModalTitle('Modifier la promotion');
      this.updateSubmitButton('Mettre à jour');
      
    } else {
      // Mode création - valeurs par défaut
      this.setFormDefaults();
      this.updateModalTitle('Nouvelle promotion');
      this.updateSubmitButton('Créer la promotion');
    }

    // Ouvrir modal via DashboardApp ou fallback
    if (DashboardApp?.openModal) {
      DashboardApp.openModal('promotion-modal');
    } else {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    // Focus premier champ
    setTimeout(() => {
      document.getElementById('promo-name')?.focus();
    }, 100);
  },

  createModal: function() {
    const modalHTML = `
      <div id="promotion-modal" class="fixed inset-0 z-[100] hidden" role="dialog" aria-modal="true" aria-labelledby="promotion-modal-title">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="SupplierPromotions.closeModal()" aria-hidden="true"></div>
        <div class="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          
          <!-- Header -->
          <div class="flex justify-between items-center p-6 border-b border-slate-800">
            <h3 id="promotion-modal-title" class="text-xl font-bold text-white">Nouvelle promotion</h3>
            <button type="button" onclick="SupplierPromotions.closeModal()" 
                    class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    aria-label="Fermer">
              <i class="fas fa-times text-lg"></i>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <form id="promotion-form" class="space-y-5" onsubmit="event.preventDefault(); SupplierPromotions.save();">
              
              <!-- Nom -->
              <div>
                <label for="promo-name" class="block text-sm font-medium text-slate-400 mb-2">
                  Nom de la promotion <span class="text-red-400">*</span>
                </label>
                <input type="text" id="promo-name" name="name" required maxlength="100"
                       class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white 
                              focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                       placeholder="Ex: Soldes d'hiver 2026">
                <p class="text-xs text-slate-500 mt-1">Nom visible par les clients</p>
              </div>

              <!-- Type et Valeur -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="promo-type" class="block text-sm font-medium text-slate-400 mb-2">
                    Type de réduction <span class="text-red-400">*</span>
                  </label>
                  <select id="promo-type" name="type" required
                          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white 
                                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors">
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (€)</option>
                  </select>
                </div>
                <div>
                  <label for="promo-value" class="block text-sm font-medium text-slate-400 mb-2" id="value-label">
                    Valeur (%) <span class="text-red-400">*</span>
                  </label>
                  <input type="number" id="promo-value" name="value" required 
                         min="0.01" max="100" step="0.01"
                         class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white 
                                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                         placeholder="20">
                  <p class="text-xs text-slate-500 mt-1" id="value-hint">Entre 0.01 et 100%</p>
                </div>
              </div>

              <!-- Code promo -->
              <div>
                <label for="promo-code" class="block text-sm font-medium text-slate-400 mb-2">
                  Code promo <span class="text-red-400">*</span>
                </label>
                <input type="text" id="promo-code" name="code" required maxlength="20"
                       pattern="[A-Z0-9_-]+"
                       class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono uppercase
                              focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                       placeholder="HIVER2026" autocomplete="off">
                <p class="text-xs text-slate-500 mt-1">3-20 caractères, majuscules, chiffres, tirets uniquement</p>
                <div id="code-preview" class="hidden mt-2 text-xs"></div>
              </div>

              <!-- Usage max -->
              <div>
                <label for="promo-max-usage" class="block text-sm font-medium text-slate-400 mb-2">
                  Nombre d'utilisations maximum <span class="text-slate-500">(optionnel)</span>
                </label>
                <input type="number" id="promo-max-usage" name="max_usage" min="1"
                       class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white 
                              focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                       placeholder="Laisser vide pour illimité">
                <p class="text-xs text-slate-500 mt-1">Si vide, la promotion peut être utilisée indéfiniment</p>
              </div>

              <!-- Dates -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="promo-start" class="block text-sm font-medium text-slate-400 mb-2">
                    Date de début <span class="text-red-400">*</span>
                  </label>
                  <input type="date" id="promo-start" name="start_date" required
                         class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white 
                                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors">
                </div>
                <div>
                  <label for="promo-end" class="block text-sm font-medium text-slate-400 mb-2">
                    Date de fin <span class="text-red-400">*</span>
                  </label>
                  <input type="date" id="promo-end" name="end_date" required
                         class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white 
                                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors">
                </div>
              </div>

              <!-- Ciblage (optionnel - pour future version) -->
              <div class="pt-4 border-t border-slate-800">
                <label class="block text-sm font-medium text-slate-400 mb-2">
                  Ciblage <span class="text-slate-500">(optionnel - version future)</span>
                </label>
                <div class="flex gap-3">
                  <label class="flex items-center gap-2 text-sm text-slate-300">
                    <input type="radio" name="applies_to" value="all" checked class="rounded border-slate-600">
                    Tous les produits
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-300 opacity-50 cursor-not-allowed">
                    <input type="radio" name="applies_to" value="category" disabled class="rounded border-slate-600">
                    Catégorie spécifique
                  </label>
                </div>
              </div>

            </form>
          </div>

          <!-- Footer -->
          <div class="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
            <button type="button" onclick="SupplierPromotions.closeModal()" 
                    class="px-6 py-2.5 text-slate-400 hover:text-white transition-colors">
              Annuler
            </button>
            <button type="submit" form="promotion-form" id="promo-submit-btn"
                    class="btn-primary px-6 py-2.5 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Créer la promotion
            </button>
          </div>
        </div>
      </div>
    `;

    // Injection sécurisée
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);

    // Gestion fermeture avec Escape
    document.addEventListener('keydown', this.handleEscapeClose);
  },

  handleEscapeClose: function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('promotion-modal');
      if (modal && !modal.classList.contains('hidden')) {
        SupplierPromotions.closeModal();
      }
    }
  },

  fillForm: function(promo) {
    const fields = {
      'promo-name': promo.name || '',
      'promo-type': promo.type || 'percentage',
      'promo-value': promo.value || '',
      'promo-code': promo.code || '',
      'promo-max-usage': promo.max_usage || '',
      'promo-start': promo.start_date ? new Date(promo.start_date).toISOString().split('T')[0] : '',
      'promo-end': promo.end_date ? new Date(promo.end_date).toISOString().split('T')[0] : ''
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    // Mise à jour labels selon type
    this.updateTypeLabels(promo.type);
  },

  setFormDefaults: function() {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const fields = {
      'promo-type': 'percentage',
      'promo-value': '',
      'promo-max-usage': '',
      'promo-start': today.toISOString().split('T')[0],
      'promo-end': nextMonth.toISOString().split('T')[0]
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    this.updateTypeLabels('percentage');
  },

  updateTypeLabels: function(type) {
    const label = document.getElementById('value-label');
    const hint = document.getElementById('value-hint');
    const input = document.getElementById('promo-value');
    
    if (!label || !hint || !input) return;

    if (type === 'percentage') {
      label.innerHTML = 'Valeur (%) <span class="text-red-400">*</span>';
      hint.textContent = 'Entre 1 et 100%';
      input.min = this.CONFIG.MIN_VALUE.percentage;
      input.max = this.CONFIG.MAX_VALUE.percentage;
      input.step = '1';
    } else {
      label.innerHTML = 'Valeur (€) <span class="text-red-400">*</span>';
      hint.textContent = 'Montant en euros';
      input.min = this.CONFIG.MIN_VALUE.fixed;
      input.max = this.CONFIG.MAX_VALUE.fixed;
      input.step = '0.01';
    }
  },

  updateModalTitle: function(title) {
    const el = document.getElementById('promotion-modal-title');
    if (el) el.textContent = title;
  },

  updateSubmitButton: function(text) {
    const btn = document.getElementById('promo-submit-btn');
    if (btn) {
      btn.textContent = text;
      btn.disabled = this.state.isSaving;
    }
  },

  validateCodePreview: function(code) {
    const preview = document.getElementById('code-preview');
    if (!preview) return;

    if (!code) {
      preview.classList.add('hidden');
      return;
    }

    const isValid = this.CONFIG.PROMO_CODE_REGEX.test(code);
    
    preview.textContent = isValid 
      ? '✓ Format valide' 
      : '✗ Format invalide (majuscules, chiffres, tirets uniquement)';
    preview.className = `mt-2 text-xs ${isValid ? 'text-emerald-400' : 'text-red-400'}`;
    preview.classList.remove('hidden');
  },

  closeModal: function() {
    const modal = document.getElementById('promotion-modal');
    if (!modal) return;

    // Nettoyage
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    
    // Supprimer listener Escape
    document.removeEventListener('keydown', this.handleEscapeClose);
    
    // Reset état
    this.state.editingId = null;
    this.state.isSaving = false;
    
    // Optionnel: supprimer le modal du DOM après animation
    // setTimeout(() => {
    //   if (modal.classList.contains('hidden')) {
    //     modal.remove();
    //   }
    // }, 300);
  },

  // ==========================================
  // VALIDATION & SAUVEGARDE
  // ==========================================
  save: async function() {
    // Protection contre double soumission
    if (this.state.isSaving) {
      console.warn('[Promotions] Sauvegarde déjà en cours');
      return;
    }

    try {
      this.state.isSaving = true;
      this.updateSubmitButton(this.state.editingId ? 'Mise à jour...' : 'Création...');
      DashboardApp?.showLoading?.(true);

      // Collecte et validation des données
      const data = this.collectAndValidateFormData();
      if (!data) return; // Validation échouée, messages déjà affichés

      console.log('[Promotions] Données validées:', data);

      // Appel API
      let response;
      if (this.state.editingId) {
        console.log('[Promotions] Mise à jour ID:', this.state.editingId);
        response = await BrandiaAPI.Supplier.updatePromotion(this.state.editingId, data);
      } else {
        console.log('[Promotions] Création nouvelle promotion');
        response = await BrandiaAPI.Supplier.createPromotion(data);
      }

      // Gestion réponse
      if (response?.success) {
        DashboardApp?.showToast?.(
          this.state.editingId ? 'Promotion mise à jour ✓' : 'Promotion créée ✓',
          'success'
        );
        this.closeModal();
        await this.loadPromotions(); // Recharger liste
      } else {
        // Mapping erreurs API
        const errorMsg = this.mapApiError(response?.message, data);
        DashboardApp?.showToast?.(errorMsg, 'error');
      }

    } catch (error) {
      console.error('[Promotions] Erreur sauvegarde:', error);
      
      // Gestion erreurs réseau/API
      let userMessage = 'Erreur lors de la sauvegarde';
      if (error.message?.includes('401')) {
        userMessage = 'Session expirée, veuillez vous reconnecter';
      } else if (error.message?.includes('403')) {
        userMessage = 'Accès refusé - permissions insuffisantes';
      } else if (error.message?.includes('Failed to fetch')) {
        userMessage = 'Connexion au serveur impossible';
      } else if (error.message) {
        userMessage = error.message;
      }
      
      DashboardApp?.showToast?.(userMessage, 'error');
      
    } finally {
      this.state.isSaving = false;
      this.updateSubmitButton(this.state.editingId ? 'Mettre à jour' : 'Créer la promotion');
      DashboardApp?.showLoading?.(false);
    }
  },

  collectAndValidateFormData: function() {
    const fields = {
      name: document.getElementById('promo-name')?.value?.trim(),
      type: document.getElementById('promo-type')?.value,
      value: parseFloat(document.getElementById('promo-value')?.value),
      code: document.getElementById('promo-code')?.value?.trim()?.toUpperCase(),
      max_usage: document.getElementById('promo-max-usage')?.value 
        ? parseInt(document.getElementById('promo-max-usage').value) 
        : null,
      start_date: document.getElementById('promo-start')?.value,
      end_date: document.getElementById('promo-end')?.value
    };

    // Validation champs obligatoires
    if (!fields.name || fields.name.length < 2) {
      DashboardApp?.showToast?.('Le nom doit contenir au moins 2 caractères', 'error');
      document.getElementById('promo-name')?.focus();
      return null;
    }

    if (!fields.type || !['percentage', 'fixed'].includes(fields.type)) {
      DashboardApp?.showToast?.('Type de réduction invalide', 'error');
      return null;
    }

    // Validation valeur selon type
    const min = this.CONFIG.MIN_VALUE[fields.type];
    const max = this.CONFIG.MAX_VALUE[fields.type];
    if (isNaN(fields.value) || fields.value < min || fields.value > max) {
      DashboardApp?.showToast?.(
        `Valeur invalide: entre ${min} et ${max}${fields.type === 'percentage' ? '%' : '€'}`,
        'error'
      );
      document.getElementById('promo-value')?.focus();
      return null;
    }

    // Validation code promo
    if (!fields.code || !this.CONFIG.PROMO_CODE_REGEX.test(fields.code)) {
      DashboardApp?.showToast?.('Code promo invalide (3-20 caractères, majuscules, chiffres, tirets)', 'error');
      document.getElementById('promo-code')?.focus();
      return null;
    }

    // Vérification unicité code (locale)
    const codeExists = this.state.promotions.some(p => 
      p.code?.toUpperCase() === fields.code && 
      p.id !== this.state.editingId
    );
    if (codeExists) {
      DashboardApp?.showToast?.('Ce code promo existe déjà', 'error');
      document.getElementById('promo-code')?.focus();
      return null;
    }

    // Validation dates
    if (!fields.start_date || !fields.end_date) {
      DashboardApp?.showToast?.('Les dates de début et fin sont requises', 'error');
      return null;
    }

    const startDate = new Date(fields.start_date);
    const endDate = new Date(fields.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      DashboardApp?.showToast?.('La date de début ne peut pas être dans le passé', 'error');
      document.getElementById('promo-start')?.focus();
      return null;
    }

    if (endDate <= startDate) {
      DashboardApp?.showToast?.('La date de fin doit être après la date de début', 'error');
      document.getElementById('promo-end')?.focus();
      return null;
    }

    // Durée max 1 an
    const maxDuration = 365 * 24 * 60 * 60 * 1000;
    if (endDate - startDate > maxDuration) {
      DashboardApp?.showToast?.('La durée de la promotion ne peut pas dépasser 1 an', 'error');
      return null;
    }

    return fields;
  },

  mapApiError: function(apiMessage, data) {
    if (!apiMessage) return 'Erreur serveur';
    
    // Mapping erreurs PostgreSQL
    if (apiMessage.includes('duplicate key') || apiMessage.includes('unique constraint')) {
      if (apiMessage.includes('code')) {
        return 'Ce code promo existe déjà';
      }
      if (apiMessage.includes('name')) {
        return 'Une promotion avec ce nom existe déjà';
      }
      return 'Données en conflit avec la base de données';
    }
    
    if (apiMessage.includes('foreign key')) {
      return 'Référence invalide';
    }
    
    if (apiMessage.includes('not null') || apiMessage.includes('violates')) {
      return 'Champ requis manquant';
    }
    
    return apiMessage;
  },

  // ==========================================
  // ACTIONS PROMOTIONS
  // ==========================================
  edit: function(id) {
    this.openModal(id);
  },

  delete: async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette promotion ?\nCette action est irréversible.')) {
      return;
    }

    try {
      DashboardApp?.showLoading?.(true);
      
      if (!BrandiaAPI.Supplier?.deletePromotion) {
        throw new Error('API deletePromotion non disponible');
      }

      const response = await BrandiaAPI.Supplier.deletePromotion(id);
      
      if (response?.success) {
        DashboardApp?.showToast?.('Promotion supprimée ✓', 'success');
        await this.loadPromotions();
      } else {
        throw new Error(response?.message || 'Erreur suppression');
      }
      
    } catch (error) {
      console.error('[Promotions] Erreur suppression:', error);
      DashboardApp?.showToast?.('Erreur: ' + (error.message || 'Suppression échouée'), 'error');
    } finally {
      DashboardApp?.showLoading?.(false);
    }
  },

  toggleStatus: async function(id, newStatus) {
    try {
      DashboardApp?.showLoading?.(true);
      
      const response = await BrandiaAPI.Supplier.updatePromotion(id, { status: newStatus });
      
      if (response?.success) {
        DashboardApp?.showToast?.(
          newStatus === 'active' ? 'Promotion activée ✓' : 'Promotion mise en pause',
          'success'
        );
        await this.loadPromotions();
      } else {
        throw new Error(response?.message || 'Erreur mise à jour statut');
      }
      
    } catch (error) {
      console.error('[Promotions] Erreur toggle status:', error);
      DashboardApp?.showToast?.('Erreur: ' + (error.message || 'Mise à jour échouée'), 'error');
    } finally {
      DashboardApp?.showLoading?.(false);
    }
  },

  // ==========================================
  // UTILITAIRES
  // ==========================================
  formatDate: function(dateInput, options = {}) {
    if (!dateInput) return '—';
    
    const date = this.normalizeDate(dateInput);
    if (!date) return '—';
    
    const defaultOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    
    return date.toLocaleDateString('fr-FR', { ...defaultOptions, ...options });
  },

  isExpired: function(promo) {
    return !this.isPromotionActive(promo);
  }
};

// ==========================================
// EXPOSITION GLOBALE & COMPATIBILITÉ
// ==========================================
window.openPromotionModal = () => SupplierPromotions.openModal();
window.savePromotion = () => SupplierPromotions.save();
window.closePromotionModal = () => SupplierPromotions.closeModal();
window.editPromotion = (id) => SupplierPromotions.edit(id);
window.deletePromotion = (id) => SupplierPromotions.delete(id);
window.togglePromotionStatus = (id, status) => SupplierPromotions.toggleStatus(id, status);

console.log('[SupplierPromotions] Module v3.1 PRODUCTION READY chargé');