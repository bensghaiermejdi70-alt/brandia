// ============================================
// SUPPLIER ORDERS MODULE - v3.5 CORRIGÉ
// - Correction parsing JSON robuste
// - Gestion des différents formats de données  
// - Fix: Affichage correct des commandes dans le dashboard
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    counts: { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 },
    currentFilter: 'all',
    selectedOrders: new Set(),
    isLoading: false,
    searchTerm: ''
  },

  init: async () => {
  console.log('[SupplierOrders] Initializing v3.5...');
  SupplierOrders.setupEventListeners();
  await SupplierOrders.loadOrders(); // 🔥 Attendre le chargement
},

  setupEventListeners: () => {
    // Recherche
    const searchInput = document.getElementById('order-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(SupplierOrders.searchTimeout);
        SupplierOrders.searchTimeout = setTimeout(() => {
          SupplierOrders.state.searchTerm = e.target.value.toLowerCase();
          SupplierOrders.render();
        }, 300);
      });
    }
  },

  setFilter: (filter) => {
    SupplierOrders.state.currentFilter = filter;
    
    // Mise à jour UI onglets
    document.querySelectorAll('.order-tab').forEach(btn => {
      const isActive = btn.dataset.filter === filter;
      if (isActive) {
        btn.classList.add('active', 'bg-indigo-600', 'text-white');
        btn.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
      } else {
        btn.classList.remove('active', 'bg-indigo-600', 'text-white');
        btn.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
      }
    });

    SupplierOrders.render();
  },

  loadOrders: async () => {
    try {
      SupplierOrders.state.isLoading = true;
      SupplierOrders.showLoading(true);

      console.log('[SupplierOrders] Loading orders...');
      
      // 🔥 CORRECTION: Utiliser l'API BrandiaAPI correctement
      if (!window.BrandiaAPI || !BrandiaAPI.Supplier) {
        throw new Error('API non disponible');
      }

      const response = await BrandiaAPI.Supplier.getOrders();
      console.log('[SupplierOrders] API Response:', response);

      if (!response || !response.success) {
        throw new Error(response?.message || 'Erreur de chargement');
      }

      // 🔥 CORRECTION: Gestion robuste des données reçues
      let ordersData = [];
      if (Array.isArray(response.data)) {
        ordersData = response.data;
      } else if (response.data?.orders && Array.isArray(response.data.orders)) {
        ordersData = response.data.orders;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        ordersData = response.data.data;
      }

      console.log(`[SupplierOrders] Raw orders received:`, ordersData.length);

      // 🔥 CORRECTION: Parsing JSON robuste pour chaque commande
      SupplierOrders.state.orders = ordersData.map(order => {
        // Parser les items si c'est une chaîne JSON
        let parsedItems = [];
        if (order.items) {
          if (typeof order.items === 'string') {
            try {
              parsedItems = JSON.parse(order.items);
            } catch (e) {
              console.warn('[SupplierOrders] Failed to parse items for order', order.id, e);
              parsedItems = [];
            }
          } else if (Array.isArray(order.items)) {
            parsedItems = order.items;
          } else if (typeof order.items === 'object') {
            parsedItems = [order.items];
          }
        }

        // Parser l'adresse si c'est une chaîne JSON
        let parsedAddress = {};
        if (order.shipping_address) {
          if (typeof order.shipping_address === 'string') {
            try {
              parsedAddress = JSON.parse(order.shipping_address);
            } catch (e) {
              parsedAddress = { raw: order.shipping_address };
            }
          } else if (typeof order.shipping_address === 'object') {
            parsedAddress = order.shipping_address;
          }
        }

        return {
          ...order,
          items: parsedItems,
          shipping_address: parsedAddress,
          status: order.status || 'pending',
          total_amount: parseFloat(order.total_amount) || 0,
          customer_first_name: order.customer_first_name || order.customer_name?.split(' ')[0] || '',
          customer_last_name: order.customer_last_name || order.customer_name?.split(' ').slice(1).join(' ') || ''
        };
      });

      // 🔥 CORRECTION: Recalcul correct des compteurs avec tous les statuts possibles
      const orders = SupplierOrders.state.orders;
      SupplierOrders.state.counts = {
        all: orders.length,
        pending: orders.filter(o => ['pending', 'paid', 'processing', 'confirmed', null, undefined].includes(o.status)).length,
        shipped: orders.filter(o => o.status === 'shipped' || o.status === 'in_transit').length,
        delivered: orders.filter(o => o.status === 'delivered' || o.status === 'completed').length,
        cancelled: orders.filter(o => ['cancelled', 'refunded', 'failed'].includes(o.status)).length
      };

      console.log(`[SupplierOrders] Loaded ${orders.length} orders`, SupplierOrders.state.counts);

      SupplierOrders.updateCounts();
      SupplierOrders.render();

    } catch (error) {
      console.error('[SupplierOrders] Error:', error);
      SupplierOrders.showToast('Erreur chargement commandes: ' + error.message, 'error');
      SupplierOrders.renderEmpty();
    } finally {
      SupplierOrders.state.isLoading = false;
      SupplierOrders.showLoading(false);
    }
  },

  updateCounts: () => {
    const counts = SupplierOrders.state.counts;
    
    // Mise à jour des badges avec animation
    const updateBadge = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
        el.classList.toggle('hidden', value === 0);
      }
    };

    updateBadge('count-all', counts.all);
    updateBadge('count-pending', counts.pending);
    updateBadge('count-shipped', counts.shipped);
    updateBadge('count-delivered', counts.delivered);

    // Badge dans la sidebar
    const orderBadge = document.getElementById('order-badge');
    if (orderBadge) {
      const totalPending = counts.pending;
      orderBadge.textContent = totalPending;
      orderBadge.classList.toggle('hidden', totalPending === 0);
    }
  },

  render: () => {
    const container = document.getElementById('orders-list');
    if (!container) {
      console.warn('[SupplierOrders] Container #orders-list not found');
      return;
    }

    let filteredOrders = SupplierOrders.getFilteredOrders();
    
    // Filtre recherche
    if (SupplierOrders.state.searchTerm) {
      filteredOrders = filteredOrders.filter(o => 
        (o.order_number || '').toLowerCase().includes(SupplierOrders.state.searchTerm) ||
        (o.customer_first_name + ' ' + o.customer_last_name).toLowerCase().includes(SupplierOrders.state.searchTerm) ||
        (o.customer_email || '').toLowerCase().includes(SupplierOrders.state.searchTerm)
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

      const items = order.items || [];
      const firstItem = items[0] || {};
      const itemsCount = items.length;
      const totalItems = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

      return `
        <div class="order-card bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-indigo-500/50 transition-all duration-300 mb-4" 
             data-order-id="${order.id}">
          
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${statusConfig.gradient} flex items-center justify-center">
                <i class="fas ${statusConfig.icon} text-white text-lg"></i>
              </div>
              <div>
                <h3 class="text-white font-bold text-lg">#${order.order_number || order.id}</h3>
                <p class="text-slate-400 text-sm">
                  <i class="far fa-calendar-alt mr-1"></i>${date} ${time}
                </p>
              </div>
            </div>
            <span class="px-3 py-1.5 rounded-full text-xs font-semibold border ${statusConfig.class}">
              ${statusConfig.label}
            </span>
          </div>

          <div class="flex items-center gap-4 mb-4 p-3 bg-slate-700/30 rounded-xl">
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
                <p class="text-indigo-400 text-xs mt-1">+${itemsCount - 1} article(s)</p>
              ` : ''}
            </div>
            <div class="text-right">
              <p class="text-white font-bold text-lg">${SupplierOrders.formatPrice(order.total_amount)}</p>
              <p class="text-slate-500 text-xs">${totalItems} article${totalItems > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-700">
            <div class="flex items-center gap-2 text-sm text-slate-400">
              <i class="fas fa-user-circle"></i>
              <span>${order.customer_first_name || ''} ${order.customer_last_name || 'Client'}</span>
            </div>
            <div class="flex gap-2">
              <button onclick="SupplierOrders.viewOrder(${order.id})" 
                      class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                <i class="fas fa-eye mr-1"></i> Détails
              </button>
              ${['pending', 'paid', 'processing', 'confirmed'].includes(order.status) ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" 
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors">
                  <i class="fas fa-shipping-fast mr-1"></i> Expédier
                </button>
              ` : order.status === 'shipped' ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" 
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors">
                  <i class="fas fa-check-circle mr-1"></i> Livrer
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  getFilteredOrders: () => {
    const filter = SupplierOrders.state.currentFilter;
    if (filter === 'all') return SupplierOrders.state.orders;
    
    const statusMap = {
      'pending': ['pending', 'paid', 'processing', 'confirmed'],
      'shipped': ['shipped', 'in_transit'],
      'delivered': ['delivered', 'completed'],
      'cancelled': ['cancelled', 'refunded', 'failed']
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
        icon: 'fa-clock'
      },
      'paid': { 
        label: 'Payée', 
        class: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        gradient: 'from-blue-500 to-cyan-500',
        icon: 'fa-credit-card'
      },
      'processing': { 
        label: 'En traitement', 
        class: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        gradient: 'from-purple-500 to-pink-500',
        icon: 'fa-cog fa-spin'
      },
      'confirmed': { 
        label: 'Confirmée', 
        class: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        gradient: 'from-indigo-500 to-purple-500',
        icon: 'fa-check'
      },
      'shipped': { 
        label: 'Expédiée', 
        class: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        gradient: 'from-indigo-500 to-purple-500',
        icon: 'fa-shipping-fast'
      },
      'in_transit': { 
        label: 'En transit', 
        class: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        gradient: 'from-blue-500 to-indigo-500',
        icon: 'fa-truck'
      },
      'delivered': { 
        label: 'Livrée', 
        class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        gradient: 'from-emerald-500 to-teal-500',
        icon: 'fa-check-circle'
      },
      'completed': { 
        label: 'Terminée', 
        class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        gradient: 'from-emerald-500 to-teal-500',
        icon: 'fa-check-double'
      },
      'cancelled': { 
        label: 'Annulée', 
        class: 'bg-red-500/20 text-red-400 border-red-500/30',
        gradient: 'from-red-500 to-pink-500',
        icon: 'fa-times-circle'
      },
      'refunded': { 
        label: 'Remboursée', 
        class: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        gradient: 'from-slate-500 to-gray-500',
        icon: 'fa-undo'
      }
    };
    return configs[status] || configs['pending'];
  },

  renderEmptyState: () => `
    <div class="text-center py-16">
      <div class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
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
    // Utiliser le loading global du dashboard
    if (window.showLoading) {
      showLoading(show);
    }
  },

  showToast: (message, type = 'success') => {
    if (window.showToast) {
      showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
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
      SupplierOrders.showToast('Erreur: ' + error.message, 'error');
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

    const items = order.items || [];
    const statusConfig = SupplierOrders.getStatusConfig(order.status);
    const canShip = ['pending', 'paid', 'processing', 'confirmed'].includes(order.status);
    const canDeliver = order.status === 'shipped' || order.status === 'in_transit';

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
            <span class="text-white font-semibold">${SupplierOrders.formatPrice(item.total_price || (item.quantity * item.unit_price))}</span>
          </div>
        </div>
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        
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
              ${order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : '-'}
            </p>
          </div>
          <button onclick="document.getElementById('order-detail-modal').classList.add('hidden')" 
                  class="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          
          <div class="space-y-3">
            <h4 class="text-white font-semibold flex items-center gap-2">
              <i class="fas fa-shopping-bag text-indigo-400"></i>
              Articles (${items.length})
            </h4>
            <div class="space-y-3">
              ${itemsHtml || '<p class="text-slate-500">Aucun article</p>'}
            </div>
          </div>

          <div class="bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-700">
            <div class="flex justify-between text-slate-400">
              <span>Sous-total</span>
              <span>${SupplierOrders.formatPrice(order.subtotal || order.total_amount)}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Livraison</span>
              <span>${order.shipping_cost > 0 ? SupplierOrders.formatPrice(order.shipping_cost) : 'Gratuit'}</span>
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
              <p class="text-white">${order.shipping_address?.street || order.shipping_address || ''}</p>
              <p class="text-slate-400 text-sm">${order.shipping_address?.postal_code || order.shipping_postal_code || ''} ${order.shipping_address?.city || order.shipping_city || ''}</p>
              <p class="text-slate-400 text-sm">${order.shipping_address?.country || order.shipping_country_code || ''}</p>
            </div>
          </div>
        </div>

        <div class="p-6 border-t border-slate-700 bg-slate-800/30 flex gap-3">
          ${canShip ? `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped'); document.getElementById('order-detail-modal').classList.add('hidden')" 
                    class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
              <i class="fas fa-shipping-fast"></i>
              Marquer comme expédiée
            </button>
          ` : ''}
          ${canDeliver ? `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered'); document.getElementById('order-detail-modal').classList.add('hidden')" 
                    class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
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
    
    modal.classList.remove('hidden');
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      SupplierOrders.showLoading(true);

      const response = await window.BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      SupplierOrders.showToast(`Statut mis à jour: ${newStatus}`, 'success');
      await SupplierOrders.loadOrders();
      
    } catch (error) {
      console.error('[SupplierOrders] Update status error:', error);
      SupplierOrders.showToast('Erreur: ' + error.message, 'error');
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

console.log('[SupplierOrders] Module v3.5 chargé - JSON Parsing corrigé');

// Exposer globalement
window.filterOrders = (filter) => SupplierOrders.setFilter(filter);