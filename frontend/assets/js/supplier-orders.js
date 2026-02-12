// ============================================
// SUPPLIER ORDERS MODULE - v3.4 CORRIGÉ & AMÉLIORÉ
// - Correction parsing JSON robuste
// - Gestion des différents formats de données
// - Logs améliorés pour debugging
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    counts: { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 },
    currentFilter: 'all',
    selectedOrders: new Set(),
    isLoading: false
  },

  init: async () => {
    console.log('[SupplierOrders] Initializing v3.4...');
    SupplierOrders.setupEventListeners();
    await SupplierOrders.loadOrders();
  },

  setupEventListeners: () => {
    // Filtres par onglet
    document.querySelectorAll('[data-order-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.closest('[data-order-filter]').dataset.orderFilter;
        SupplierOrders.setFilter(filter);
      });
    });

    // Sélection multiple
    const selectAll = document.getElementById('select-all-orders');
    if (selectAll) {
      selectAll.addEventListener('change', SupplierOrders.toggleSelectAll);
    }

    // Recherche
    const searchInput = document.getElementById('order-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(SupplierOrders.searchTimeout);
        SupplierOrders.searchTimeout = setTimeout(() => {
          SupplierOrders.searchTerm = e.target.value.toLowerCase();
          SupplierOrders.render();
        }, 300);
      });
    }
  },

  setFilter: (filter) => {
    SupplierOrders.state.currentFilter = filter;
    
    // Animation de transition
    const container = document.getElementById('orders-list');
    if (container) {
      container.style.opacity = '0.5';
      setTimeout(() => {
        SupplierOrders.render();
        container.style.opacity = '1';
      }, 150);
    }

    // Mise à jour UI onglets
    document.querySelectorAll('[data-order-filter]').forEach(btn => {
      const isActive = btn.dataset.orderFilter === filter;
      btn.classList.toggle('border-indigo-500', isActive);
      btn.classList.toggle('text-indigo-400', isActive);
      btn.classList.toggle('border-transparent', !isActive);
      btn.classList.toggle('text-slate-400', !isActive);
      
      // Animation badge
      const badge = btn.querySelector('.tab-badge');
      if (badge) {
        badge.classList.toggle('bg-indigo-500', isActive);
        badge.classList.toggle('text-white', isActive);
        badge.classList.toggle('bg-slate-700', !isActive);
        badge.classList.toggle('text-slate-300', !isActive);
      }
    });
  },

  loadOrders: async () => {
    try {
      SupplierOrders.state.isLoading = true;
      SupplierOrders.showLoading(true);

      console.log('[SupplierOrders] Loading orders...');
      
      const response = await window.BrandiaAPI.Supplier.getOrders(
        SupplierOrders.state.currentFilter === 'all' ? null : SupplierOrders.state.currentFilter
      );

      console.log('[SupplierOrders] API Response:', response);

      if (!response.success) {
        throw new Error(response.message || 'Erreur de chargement');
      }

      const data = response.data || {};
      
      // ✅ CORRECTION : Normalisation des statuts
      SupplierOrders.state.orders = (data.orders || []).map(order => ({
        ...order,
        status: order.status || 'pending' // Défaut à 'pending' si null
      }));
      
      // ✅ CORRECTION : Recalcul correct des compteurs
      const orders = SupplierOrders.state.orders;
      SupplierOrders.state.counts = {
        all: orders.length,
        pending: orders.filter(o => ['pending', 'paid', 'processing', null].includes(o.status)).length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => ['cancelled', 'refunded'].includes(o.status)).length
      };

      console.log(`[SupplierOrders] Loaded ${orders.length} orders`, SupplierOrders.state.counts);

      SupplierOrders.updateCounts();
      SupplierOrders.render();

    } catch (error) {
      console.error('[SupplierOrders] Error:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur chargement commandes: ' + error.message, 'error');
      }
      SupplierOrders.renderEmpty();
    } finally {
      SupplierOrders.state.isLoading = false;
      SupplierOrders.showLoading(false);
    }
  },

  updateCounts: () => {
    const counts = SupplierOrders.state.counts;
    const total = counts.all;
    
    // Animation des compteurs
    const animateValue = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      
      const start = parseInt(el.textContent) || 0;
      const end = value;
      const duration = 300;
      const startTime = performance.now();
      
      const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        const current = Math.round(start + (end - start) * easeProgress);
        
        el.textContent = current;
        
        if (progress < 1) {
          requestAnimationFrame(update);
        }
      };
      
      requestAnimationFrame(update);
    };

    animateValue('count-all', counts.all);
    animateValue('count-pending', counts.pending);
    animateValue('count-shipped', counts.shipped);
    animateValue('count-delivered', counts.delivered);
  },

  // ✅ CORRECTION : Fonction utilitaire pour parser les items de manière robuste
  parseItems: (rawItems) => {
    let items = [];
    try {
      if (!rawItems) {
        items = [];
      } else if (typeof rawItems === 'string') {
        // C'est une chaîne JSON, la parser
        items = JSON.parse(rawItems);
      } else if (Array.isArray(rawItems)) {
        // C'est déjà un tableau
        items = rawItems;
      } else if (typeof rawItems === 'object') {
        // C'est un objet (cas jsonb_agg), convertir en tableau si nécessaire
        items = Object.values(rawItems);
      }
    } catch (e) {
      console.warn('[SupplierOrders] Erreur parsing items:', e, 'Raw:', rawItems);
      items = [];
    }

    // ✅ Vérification finale : s'assurer que c'est un tableau
    if (!Array.isArray(items)) {
      console.warn('[SupplierOrders] Items n\'est pas un tableau, conversion forcée');
      items = [];
    }

    return items;
  },

  render: () => {
    const container = document.getElementById('orders-list');
    if (!container) {
      console.warn('[SupplierOrders] Container #orders-list not found');
      return;
    }

    let filteredOrders = SupplierOrders.getFilteredOrders();
    
    // Filtre recherche
    if (SupplierOrders.searchTerm) {
      filteredOrders = filteredOrders.filter(o => 
        (o.order_number || '').toLowerCase().includes(SupplierOrders.searchTerm) ||
        (o.customer_name || '').toLowerCase().includes(SupplierOrders.searchTerm)
      );
    }

    if (filteredOrders.length === 0) {
      container.innerHTML = SupplierOrders.renderEmptyState();
      return;
    }

    container.innerHTML = filteredOrders.map((order, index) => {
      const statusConfig = SupplierOrders.getStatusConfig(order.status);
      const date = order.created_at 
        ? new Date(order.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })
        : '-';
      
      const time = order.created_at
        ? new Date(order.created_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : '';

      // ✅ UTILISATION de la fonction parseItems corrigée
      const items = SupplierOrders.parseItems(order.items);
      const firstItem = items[0] || {};
      const itemsCount = items.length;
      const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      // Progression visuelle du statut
      const statusProgress = {
        'pending': 25,
        'paid': 50,
        'processing': 50,
        'shipped': 75,
        'delivered': 100,
        'cancelled': 0
      }[order.status] || 25;

      return `
        <div class="order-card group bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 border border-slate-700 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1" 
             style="animation: slideIn 0.3s ease ${index * 0.05}s both;"
             data-order-id="${order.id}">
          
          <!-- Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${statusConfig.gradient} flex items-center justify-center shadow-lg">
                <i class="fas ${statusConfig.icon} text-white text-lg"></i>
              </div>
              <div>
                <h3 class="text-white font-bold text-lg">#${order.order_number || order.id}</h3>
                <p class="text-slate-400 text-sm">
                  <i class="far fa-calendar-alt mr-1"></i>${date}
                  <span class="mx-2">•</span>
                  <i class="far fa-clock mr-1"></i>${time}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1.5 rounded-full text-xs font-semibold border ${statusConfig.class} flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full ${statusConfig.dot}"></span>
                ${statusConfig.label}
              </span>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="mb-4">
            <div class="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Commande reçue</span>
              <span>${statusConfig.label}</span>
            </div>
            <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r ${statusConfig.gradient} rounded-full transition-all duration-1000" 
                   style="width: ${statusProgress}%"></div>
            </div>
          </div>

          <!-- Items preview -->
          <div class="flex items-center gap-4 mb-4 p-3 bg-slate-800/50 rounded-xl">
            ${firstItem.product_image_url ? `
              <img src="${firstItem.product_image_url}" alt="" class="w-16 h-16 rounded-lg object-cover border border-slate-600">
            ` : `
              <div class="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center border border-slate-600">
                <i class="fas fa-box text-slate-500 text-xl"></i>
              </div>
            `}
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium truncate">${firstItem.product_name || 'Produit'}</p>
              <p class="text-slate-400 text-sm">${firstItem.quantity || 1} × ${SupplierOrders.formatPrice(firstItem.unit_price)}</p>
              ${itemsCount > 1 ? `
                <p class="text-indigo-400 text-xs mt-1">
                  <i class="fas fa-plus-circle mr-1"></i>+${itemsCount - 1} article(s)
                </p>
              ` : ''}
            </div>
            <div class="text-right">
              <p class="text-white font-bold text-lg">${SupplierOrders.formatPrice(order.total_amount)}</p>
              <p class="text-slate-500 text-xs">${totalItems} article${totalItems > 1 ? 's' : ''}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-3 border-t border-slate-700/50">
            <div class="flex items-center gap-2 text-sm text-slate-400">
              <i class="fas fa-user-circle"></i>
              <span>${order.customer_first_name || ''} ${order.customer_last_name || 'Client'}</span>
            </div>
            <div class="flex gap-2">
              <button onclick="SupplierOrders.viewOrder(${order.id})" 
                      class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm">
                <i class="fas fa-eye"></i>
                Détails
              </button>
              ${['pending', 'paid', 'processing'].includes(order.status) ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" 
                        class="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-sm font-medium">
                  <i class="fas fa-shipping-fast"></i>
                  Expédier
                </button>
              ` : order.status === 'shipped' ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" 
                        class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 text-sm font-medium">
                  <i class="fas fa-check-circle"></i>
                  Livrer
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Ajouter styles d'animation si pas présents
    if (!document.getElementById('order-animations')) {
      const style = document.createElement('style');
      style.id = 'order-animations';
      style.textContent = `
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .order-card { animation: slideIn 0.3s ease both; }
      `;
      document.head.appendChild(style);
    }
  },

  getFilteredOrders: () => {
    const filter = SupplierOrders.state.currentFilter;
    if (filter === 'all') return SupplierOrders.state.orders;
    
    const statusMap = {
      'pending': ['pending', 'paid', 'processing'],
      'shipped': ['shipped'],
      'delivered': ['delivered'],
      'cancelled': ['cancelled', 'refunded']
    };
    
    const allowedStatuses = statusMap[filter] || [filter];
    return SupplierOrders.state.orders.filter(o => allowedStatuses.includes(o.status));
  },

  getStatusConfig: (status) => {
    const configs = {
      'pending': { 
        label: 'À préparer', 
        class: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        gradient: 'from-amber-500 to-orange-500',
        icon: 'fa-clock',
        dot: 'bg-amber-400'
      },
      'paid': { 
        label: 'Payée', 
        class: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        gradient: 'from-blue-500 to-cyan-500',
        icon: 'fa-credit-card',
        dot: 'bg-blue-400'
      },
      'processing': { 
        label: 'En traitement', 
        class: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        gradient: 'from-purple-500 to-pink-500',
        icon: 'fa-cog fa-spin',
        dot: 'bg-purple-400'
      },
      'shipped': { 
        label: 'Expédiée', 
        class: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        gradient: 'from-indigo-500 to-purple-500',
        icon: 'fa-shipping-fast',
        dot: 'bg-indigo-400'
      },
      'delivered': { 
        label: 'Livrée', 
        class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        gradient: 'from-emerald-500 to-teal-500',
        icon: 'fa-check-circle',
        dot: 'bg-emerald-400'
      },
      'cancelled': { 
        label: 'Annulée', 
        class: 'bg-red-500/20 text-red-400 border-red-500/30',
        gradient: 'from-red-500 to-pink-500',
        icon: 'fa-times-circle',
        dot: 'bg-red-400'
      },
      'refunded': { 
        label: 'Remboursée', 
        class: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        gradient: 'from-slate-500 to-gray-500',
        icon: 'fa-undo',
        dot: 'bg-slate-400'
      }
    };
    return configs[status] || configs['pending'];
  },

  renderEmptyState: () => `
    <div class="text-center py-16">
      <div class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
        <i class="fas fa-inbox text-4xl text-slate-600"></i>
      </div>
      <h3 class="text-xl font-semibold text-white mb-2">Aucune commande ${SupplierOrders.getFilterLabel()}</h3>
      <p class="text-slate-400 mb-6">Les commandes apparaîtront ici</p>
      ${SupplierOrders.state.currentFilter !== 'all' ? `
        <button onclick="SupplierOrders.setFilter('all')" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
          Voir toutes les commandes
        </button>
      ` : ''}
    </div>
  `,

  getFilterLabel: () => {
    const labels = {
      'all': '',
      'pending': 'à préparer',
      'shipped': 'expédiées',
      'delivered': 'livrées',
      'cancelled': 'annulées'
    };
    return labels[SupplierOrders.state.currentFilter] || '';
  },

  renderEmpty: () => {
    const container = document.getElementById('orders-list');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-16">
          <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
          <h3 class="text-xl font-semibold text-white mb-2">Erreur de chargement</h3>
          <p class="text-slate-400 mb-4">Impossible de charger les commandes</p>
          <button onclick="SupplierOrders.loadOrders()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
            <i class="fas fa-sync-alt mr-2"></i>Réessayer
          </button>
        </div>
      `;
    }
  },

  showLoading: (show) => {
    const loader = document.getElementById('orders-loader');
    if (loader) {
      loader.style.display = show ? 'flex' : 'none';
    }
  },

  toggleSelectAll: (e) => {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.order-checkbox');
    
    checkboxes.forEach(cb => {
      cb.checked = checked;
      const orderId = parseInt(cb.closest('.order-card')?.dataset.orderId);
      if (orderId) {
        if (checked) {
          SupplierOrders.state.selectedOrders.add(orderId);
        } else {
          SupplierOrders.state.selectedOrders.delete(orderId);
        }
      }
    });
  },

  viewOrder: async (orderId) => {
    try {
      SupplierOrders.showLoading(true);
      
      const response = await window.BrandiaAPI.Supplier.getOrderById(orderId);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      SupplierOrders.showOrderModal(response.data);
      
    } catch (error) {
      console.error('[SupplierOrders] View error:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur: ' + error.message, 'error');
      }
    } finally {
      SupplierOrders.showLoading(false);
    }
  },

  showOrderModal: (order) => {
    let modal = document.getElementById('order-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'order-detail-modal';
      modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }

    // ✅ UTILISATION de la fonction parseItems corrigée
    const items = SupplierOrders.parseItems(order.items);

    const statusConfig = SupplierOrders.getStatusConfig(order.status);
    const canShip = ['pending', 'paid', 'processing'].includes(order.status);
    const canDeliver = order.status === 'shipped';

    const itemsHtml = items.map(item => `
      <div class="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        ${item.product_image_url ? `
          <img src="${item.product_image_url}" alt="" class="w-20 h-20 rounded-lg object-cover border border-slate-600">
        ` : `
          <div class="w-20 h-20 rounded-lg bg-slate-700 flex items-center justify-center border border-slate-600">
            <i class="fas fa-box text-slate-500 text-2xl"></i>
          </div>
        `}
        <div class="flex-1">
          <p class="text-white font-semibold text-lg">${item.product_name}</p>
          <p class="text-slate-400 text-sm">Réf: ${item.product_sku || 'N/A'}</p>
          <div class="flex items-center gap-4 mt-2 text-sm">
            <span class="text-slate-300">${item.quantity} × ${SupplierOrders.formatPrice(item.unit_price)}</span>
            <span class="text-white font-semibold">${SupplierOrders.formatPrice(item.total_price)}</span>
          </div>
        </div>
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-scaleIn">
        
        <!-- Header -->
        <div class="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-800/50">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-2xl font-bold text-white">Commande #${order.order_number || order.id}</h3>
              <span class="px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.class}">
                ${statusConfig.label}
              </span>
            </div>
            <p class="text-slate-400">
              <i class="far fa-calendar-alt mr-2"></i>
              ${new Date(order.created_at).toLocaleString('fr-FR')}
            </p>
          </div>
          <button onclick="document.getElementById('order-detail-modal').classList.add('hidden')" 
                  class="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- Content -->
        <div class="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          
          <!-- Timeline -->
          <div class="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl">
            <div class="flex items-center gap-2 ${order.status !== 'cancelled' ? 'text-emerald-400' : 'text-slate-500'}">
              <i class="fas fa-check-circle text-xl"></i>
              <span class="text-sm font-medium">Commande reçue</span>
            </div>
            <div class="h-0.5 flex-1 mx-4 bg-slate-700 ${['shipped', 'delivered'].includes(order.status) ? 'bg-emerald-500/50' : ''}"></div>
            <div class="flex items-center gap-2 ${order.status === 'shipped' || order.status === 'delivered' ? 'text-emerald-400' : 'text-slate-500'}">
              <i class="fas fa-box text-xl"></i>
              <span class="text-sm font-medium">Expédiée</span>
            </div>
            <div class="h-0.5 flex-1 mx-4 bg-slate-700 ${order.status === 'delivered' ? 'bg-emerald-500/50' : ''}"></div>
            <div class="flex items-center gap-2 ${order.status === 'delivered' ? 'text-emerald-400' : 'text-slate-500'}">
              <i class="fas fa-home text-xl"></i>
              <span class="text-sm font-medium">Livrée</span>
            </div>
          </div>

          <!-- Items -->
          <div>
            <h4 class="text-white font-semibold mb-3 flex items-center gap-2">
              <i class="fas fa-shopping-bag text-indigo-400"></i>
              Articles (${items.length})
            </h4>
            <div class="space-y-3">
              ${itemsHtml || '<p class="text-slate-500">Aucun article</p>'}
            </div>
          </div>

          <!-- Totaux -->
          <div class="bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-700">
            <div class="flex justify-between text-slate-400">
              <span>Sous-total</span>
              <span>${SupplierOrders.formatPrice(order.subtotal)}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Livraison</span>
              <span>${order.shipping_cost > 0 ? SupplierOrders.formatPrice(order.shipping_cost) : 'Gratuit'}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>TVA</span>
              <span>${SupplierOrders.formatPrice(order.vat_amount)}</span>
            </div>
            ${order.discount_amount > 0 ? `
              <div class="flex justify-between text-emerald-400">
                <span>Remise</span>
                <span>-${SupplierOrders.formatPrice(order.discount_amount)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between text-white text-xl font-bold pt-3 border-t border-slate-700">
              <span>Total</span>
              <span>${SupplierOrders.formatPrice(order.total_amount)}</span>
            </div>
          </div>

          <!-- Client -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
              <h4 class="text-white font-semibold mb-3 flex items-center gap-2">
                <i class="fas fa-user text-indigo-400"></i>
                Client
              </h4>
              <p class="text-white font-medium">${order.customer_first_name || ''} ${order.customer_last_name || ''}</p>
              <p class="text-slate-400 text-sm">${order.customer_email || ''}</p>
              <p class="text-slate-400 text-sm">${order.customer_phone || ''}</p>
            </div>

            <div class="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
              <h4 class="text-white font-semibold mb-3 flex items-center gap-2">
                <i class="fas fa-map-marker-alt text-indigo-400"></i>
                Livraison
              </h4>
              <p class="text-white">${order.shipping_address || ''}</p>
              <p class="text-slate-400 text-sm">${order.shipping_postal_code || ''} ${order.shipping_city || ''}</p>
              <p class="text-slate-400 text-sm">${order.shipping_country_code || ''}</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 border-t border-slate-700 bg-slate-800/30 flex gap-3">
          ${canShip ? `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped'); document.getElementById('order-detail-modal').classList.add('hidden')" 
                    class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
              <i class="fas fa-shipping-fast"></i>
              Marquer comme expédiée
            </button>
          ` : ''}
          ${canDeliver ? `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered'); document.getElementById('order-detail-modal').classList.add('hidden')" 
                    class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
              <i class="fas fa-check-circle"></i>
              Marquer comme livrée
            </button>
          ` : ''}
          <button onclick="window.print()" class="px-6 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2">
            <i class="fas fa-print"></i>
            Imprimer
          </button>
        </div>
      </div>
    `;

    // Animation d'entrée
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
    `;
    modal.appendChild(style);
    
    modal.classList.remove('hidden');
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      SupplierOrders.showLoading(true);

      const response = await window.BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast(`Statut mis à jour: ${newStatus}`, 'success');
      }

      // Recharger avec animation
      await SupplierOrders.loadOrders();
      
    } catch (error) {
      console.error('[SupplierOrders] Update status error:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur: ' + error.message, 'error');
      }
    } finally {
      SupplierOrders.showLoading(false);
    }
  },

  formatPrice: (amount) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
};

console.log('[SupplierOrders] Module v3.4 chargé - Parsing JSON corrigé');

// Exposer globalement
window.viewOrder = (id) => SupplierOrders.viewOrder(id);
window.updateOrderStatus = (id, status) => SupplierOrders.updateStatus(id, status);