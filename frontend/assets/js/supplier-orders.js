// ============================================
// SUPPLIER ORDERS MODULE - v3.1 CORRIGÉ
// Correction: SyntaxError ligne 165 (guillemets manquants)
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    counts: { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 },
    currentFilter: 'all',
    selectedOrders: new Set()
  },

  init: async () => {
    console.log('[SupplierOrders] Initializing...');
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
  },

  setFilter: (filter) => {
    SupplierOrders.state.currentFilter = filter;
    
    // Mettre à jour UI onglets
    document.querySelectorAll('[data-order-filter]').forEach(btn => {
      if (btn.dataset.orderFilter === filter) {
        btn.classList.add('border-indigo-500', 'text-indigo-400');
        btn.classList.remove('border-transparent', 'text-slate-400');
      } else {
        btn.classList.remove('border-indigo-500', 'text-indigo-400');
        btn.classList.add('border-transparent', 'text-slate-400');
      }
    });

    SupplierOrders.render();
  },

  loadOrders: async () => {
    try {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }

      console.log('[SupplierOrders] Loading orders...');
      
      const response = await window.BrandiaAPI.Supplier.getOrders(
        SupplierOrders.state.currentFilter === 'all' ? null : SupplierOrders.state.currentFilter
      );

      console.log('[SupplierOrders] API Response:', response);

      if (!response.success) {
        throw new Error(response.message || 'Erreur de chargement');
      }

      // 🔥 CORRECTION: Gestion flexible de la structure de réponse
      const data = response.data || {};
      SupplierOrders.state.orders = data.orders || [];
      SupplierOrders.state.counts = data.counts || {
        all: SupplierOrders.state.orders.length,
        pending: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
      };

      console.log(`[SupplierOrders] Loaded ${SupplierOrders.state.orders.length} orders`);
      console.log('[SupplierOrders] Counts:', SupplierOrders.state.counts);

      SupplierOrders.updateCounts();
      SupplierOrders.render();

    } catch (error) {
      console.error('[SupplierOrders] Error:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur chargement commandes: ' + error.message, 'error');
      }
      SupplierOrders.renderEmpty();
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  },

  updateCounts: () => {
    const counts = SupplierOrders.state.counts;
    
    // Mettre à jour les badges des onglets
    const setBadge = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '0';
    };

    setBadge('count-all', counts.all);
    setBadge('count-pending', counts.pending);
    setBadge('count-shipped', counts.shipped);
    setBadge('count-delivered', counts.delivered);
  },

  render: () => {
    const container = document.getElementById('orders-list');
    if (!container) {
      console.warn('[SupplierOrders] Container #orders-list not found');
      return;
    }

    const filteredOrders = SupplierOrders.getFilteredOrders();

    if (filteredOrders.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center">
            <div class="text-slate-500">
              <i class="fas fa-box-open text-4xl mb-4 opacity-50"></i>
              <p>Aucune commande ${SupplierOrders.getFilterLabel()}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = filteredOrders.map(order => {
      const statusConfig = SupplierOrders.getStatusConfig(order.status);
      const date = order.created_at 
        ? new Date(order.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '-';

      // 🔥 CORRECTION: Gestion sécurisée des items (JSON ou tableau)
      let items = [];
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
      } catch (e) {
        items = [];
      }

      const firstItem = items[0] || {};
      const itemsCount = items.length;

      return `
        <tr class="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors" data-order-id="${order.id}">
          <td class="py-4 px-4">
            <input type="checkbox" class="order-checkbox rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" 
                   ${SupplierOrders.state.selectedOrders.has(order.id) ? 'checked' : ''}>
          </td>
          <td class="py-4 px-4">
            <div>
              <p class="text-white font-medium">#${order.order_number || order.id}</p>
              <p class="text-xs text-slate-500">${date}</p>
            </div>
          </td>
          <td class="py-4 px-4">
            <div class="flex items-center gap-3">
              ${firstItem.product_image_url ? `
                <img src="${firstItem.product_image_url}" alt="" class="w-10 h-10 rounded object-cover bg-slate-800">
              ` : `
                <div class="w-10 h-10 rounded bg-slate-800 flex items-center justify-center">
                  <i class="fas fa-box text-slate-600"></i>
                </div>
              `}
              <div>
                <p class="text-white text-sm">${firstItem.product_name || 'Produit'}</p>
                ${itemsCount > 1 ? `<p class="text-xs text-slate-500">+${itemsCount - 1} article(s)</p>` : ''}
              </div>
            </div>
          </td>
          <td class="py-4 px-4 text-white font-medium">
            ${SupplierOrders.formatPrice(order.total_amount)}
          </td>
          <td class="py-4 px-4">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.class}">
              ${statusConfig.label}
            </span>
          </td>
          <td class="py-4 px-4">
            <div class="flex gap-2">
              <button onclick="SupplierOrders.viewOrder(${order.id})" class="p-2 text-slate-400 hover:text-white transition-colors" title="Voir">
                <i class="fas fa-eye"></i>
              </button>
              ${order.status === 'pending' ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" class="p-2 text-emerald-400 hover:text-emerald-300 transition-colors" title="Marquer expédiée">
                  <i class="fas fa-shipping-fast"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  getFilteredOrders: () => {
    const filter = SupplierOrders.state.currentFilter;
    if (filter === 'all') return SupplierOrders.state.orders;
    
    // Mapping des filtres vers les statuts
    const statusMap = {
      'pending': ['pending', 'paid', 'processing', null],
      'shipped': ['shipped'],
      'delivered': ['delivered'],
      'cancelled': ['cancelled', 'refunded']
    };
    
    const allowedStatuses = statusMap[filter] || [filter];
    return SupplierOrders.state.orders.filter(o => allowedStatuses.includes(o.status));
  },

  getFilterLabel: () => {
    const labels = {
      'all': '',
      'pending': 'à préparer',
      'shipped': 'expédiées',
      'delivered': 'l      'delivered': 'livrées',
      'cancelled': 'annulées'
    };
    return labels[SupplierOrders.state.currentFilter] || '';
  },

  getStatusConfig: (status) => {
    const configs = {
      'pending': { 
        label: 'À préparer', 
        class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
      },
      'paid': { 
        label: 'Payée', 
        class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
      },
      'processing': { 
        label: 'En traitement', 
        class: 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
      },
      'shipped': { 
        label: 'Expédiée', 
        class: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' 
      },
      'delivered': { 
        label: 'Livrée', 
        class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
      },
      'cancelled': { 
        label: 'Annulée', 
        class: 'bg-red-500/20 text-red-400 border-red-500/30' 
      },
      'refunded': { 
        label: 'Remboursée', 
        class: 'bg-slate-500/20 text-slate-400 border-slate-500/30' 
      }
    };
    return configs[status] || { 
      label: status || 'Inconnu', 
      class: 'bg-slate-500/20 text-slate-400 border-slate-500/30' 
    };
  },

  renderEmpty: () => {
    const container = document.getElementById('orders-list');
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-500">
            <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
            <p>Erreur de chargement des commandes</p>
            <button onclick="SupplierOrders.loadOrders()" class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
              <i class="fas fa-sync-alt mr-2"></i>Réessayer
            </button>
          </td>
        </tr>
      `;
    }
  },

  toggleSelectAll: (e) => {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.order-checkbox');
    
    checkboxes.forEach(cb => {
      cb.checked = checked;
      const orderId = parseInt(cb.closest('tr').dataset.orderId);
      if (checked) {
        SupplierOrders.state.selectedOrders.add(orderId);
      } else {
        SupplierOrders.state.selectedOrders.delete(orderId);
      }
    });
  },

  viewOrder: async (orderId) => {
    try {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }

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
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  },

  showOrderModal: (order) => {
    // Créer modal dynamiquement si pas présent
    let modal = document.getElementById('order-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'order-detail-modal';
      modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }

    let items = [];
    try {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    } catch (e) {
      items = [];
    }

    const itemsHtml = items.map(item => `
      <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
        ${item.product_image_url ? `
          <img src="${item.product_image_url}" alt="" class="w-12 h-12 rounded object-cover">
        ` : `
          <div class="w-12 h-12 rounded bg-slate-700 flex items-center justify-center">
            <i class="fas fa-box text-slate-500"></i>
          </div>
        `}
        <div class="flex-1">
          <p class="text-white font-medium">${item.product_name}</p>
          <p class="text-sm text-slate-400">Qté: ${item.quantity} × ${SupplierOrders.formatPrice(item.unit_price)}</p>
        </div>
        <p class="text-white font-medium">${SupplierOrders.formatPrice(item.total_price)}</p>
      </div>
    `).join('');

    const statusConfig = SupplierOrders.getStatusConfig(order.status);

    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div class="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 class="text-xl font-bold text-white">Commande #${order.order_number || order.id}</h3>
            <p class="text-slate-400 text-sm">${new Date(order.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <button onclick="document.getElementById('order-detail-modal').classList.add('hidden')" class="text-slate-400 hover:text-white">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          <!-- Status -->
          <div class="flex items-center gap-4">
            <span class="text-slate-400">Statut:</span>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.class}">
              ${statusConfig.label}
            </span>
          </div>

          <!-- Items -->
          <div>
            <h4 class="text-white font-medium mb-3">Articles</h4>
            <div class="space-y-2">
              ${itemsHtml || '<p class="text-slate-500">Aucun article</p>'}
            </div>
          </div>

          <!-- Totaux -->
          <div class="border-t border-slate-800 pt-4 space-y-2">
            <div class="flex justify-between text-slate-400">
              <span>Sous-total</span>
              <span>${SupplierOrders.formatPrice(order.subtotal)}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Livraison</span>
              <span>${SupplierOrders.formatPrice(order.shipping_cost)}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>TVA</span>
              <span>${SupplierOrders.formatPrice(order.vat_amount)}</span>
            </div>
            <div class="flex justify-between text-white text-lg font-bold pt-2 border-t border-slate-800">
              <span>Total</span>
              <span>${SupplierOrders.formatPrice(order.total_amount)}</span>
            </div>
          </div>

          <!-- Client -->
          <div class="bg-slate-800/50 rounded-lg p-4">
            <h4 class="text-white font-medium mb-2">Client</h4>
            <p class="text-slate-300">${order.customer_first_name || ''} ${order.customer_last_name || ''}</p>
            <p class="text-slate-400 text-sm">${order.customer_email || ''}</p>
            <p class="text-slate-400 text-sm">${order.customer_phone || ''}</p>
          </div>

          <!-- Livraison -->
          <div class="bg-slate-800/50 rounded-lg p-4">
            <h4 class="text-white font-medium mb-2">Adresse de livraison</h4>
            <p class="text-slate-300">${order.shipping_address || ''}</p>
            <p class="text-slate-400">${order.shipping_postal_code || ''} ${order.shipping_city || ''}</p>
            <p class="text-slate-400">${order.shipping_country_code || ''}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 border-t border-slate-800 flex gap-3">
          ${order.status === 'pending' || order.status === 'paid' ? `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped'); document.getElementById('order-detail-modal').classList.add('hidden')" 
                    class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors">
              <i class="fas fa-shipping-fast mr-2"></i>Marquer comme expédiée
            </button>
          ` : ''}
          <button onclick="window.print()" class="px-4 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition-colors">
            <i class="fas fa-print"></i>
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }

      const response = await window.BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast(`Statut mis à jour: ${newStatus}`, 'success');
      }

      // Recharger les commandes
      await SupplierOrders.loadOrders();
      
    } catch (error) {
      console.error('[SupplierOrders] Update status error:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur: ' + error.message, 'error');
      }
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
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

console.log('[SupplierOrders] Module chargé v3.1 - Corrigé pour Brandia API');

// Exposer globalement
window.viewOrder = (id) => SupplierOrders.viewOrder(id);
window.updateOrderStatus = (id, status) => SupplierOrders.updateStatus(id, status);