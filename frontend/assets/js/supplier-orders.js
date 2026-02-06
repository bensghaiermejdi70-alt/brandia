// ============================================
// SUPPLIER ORDERS MODULE - Gestion des commandes
// Version 2.6 - Design Cards + Filtrage robuste
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    filteredOrders: [],
    currentFilter: 'all',
    counts: {
      all: 0,
      pending: 0,
      shipped: 0,
      delivered: 0
    },
    currentPage: 1,
    itemsPerPage: 10,
    selectedOrder: null
  },

  // Mapping des statuts DB -> Affichage
  STATUS_MAP: {
    pending: { label: 'En attente', class: 'badge-pending' },
    paid: { label: 'Payée', class: 'badge-paid' },
    processing: { label: 'En préparation', class: 'badge-processing' },
    shipped: { label: 'Expédiée', class: 'badge-shipped' },
    delivered: { label: 'Livrée', class: 'badge-delivered' },
    cancelled: { label: 'Annulée', class: 'badge-cancelled' }
  },

  init: async () => {
    console.log('[Orders] Init called');
    await SupplierOrders.loadOrders();
    SupplierOrders.setupEventListeners();
  },

  setupEventListeners: () => {
    console.log('[Orders] Setup listeners');
    
    // Filtres par onglet
    document.querySelectorAll('.order-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const filter = e.currentTarget.dataset.filter;
        console.log('[Orders] Tab clicked:', filter);
        SupplierOrders.setFilter(filter);
      });
    });

    // Recherche
    const searchInput = document.getElementById('order-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        SupplierOrders.searchOrders(e.target.value);
      });
    }
  },

  loadOrders: async () => {
    try {
      DashboardApp.showLoading(true);
      console.log('[Orders] Chargement avec filtre:', SupplierOrders.state.currentFilter);
      
      const statusFilter = SupplierOrders.state.currentFilter === 'all' ? null : SupplierOrders.state.currentFilter;
      console.log('[Orders] Appel API avec statusFilter:', statusFilter);
      
      const response = await BrandiaAPI.Supplier.getOrders(statusFilter);
      console.log('[Orders] Réponse API:', response);
      
      if (!response.success) {
        throw new Error(response.message || 'Erreur de chargement');
      }

      const responseData = response.data || {};
      SupplierOrders.state.orders = responseData.orders || [];
      
      if (responseData.counts) {
        SupplierOrders.state.counts = responseData.counts;
      } else {
        SupplierOrders.state.counts = SupplierOrders.calculateCounts();
      }

      console.log('[Orders] Commandes reçues:', SupplierOrders.state.orders.length);
      console.log('[Orders] Counts:', SupplierOrders.state.counts);

      SupplierOrders.state.filteredOrders = [...SupplierOrders.state.orders];
      SupplierOrders.renderOrders();
      SupplierOrders.updateCounts();
      
    } catch (error) {
      console.error('[Orders] Error loading orders:', error);
      DashboardApp.showToast('Erreur de chargement des commandes', 'error');
      SupplierOrders.renderEmpty('Erreur de chargement');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  calculateCounts: () => {
    const orders = SupplierOrders.state.orders;
    return {
      all: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length
    };
  },

  setFilter: (filter) => {
    console.log('[Orders] setFilter called:', filter);
    
    if (!filter) {
      console.error('[Orders] Filter is undefined!');
      return;
    }

    SupplierOrders.state.currentFilter = filter;
    SupplierOrders.state.currentPage = 1;
    
    // Update UI tabs
    document.querySelectorAll('.order-tab').forEach(tab => {
      const tabFilter = tab.dataset.filter;
      tab.classList.remove('active', 'bg-indigo-600', 'text-white');
      tab.classList.add('text-slate-400');
      
      if (tabFilter === filter) {
        tab.classList.add('active', 'bg-indigo-600', 'text-white');
        tab.classList.remove('text-slate-400');
      }
    });

    SupplierOrders.applyFilter();
  },

  applyFilter: () => {
    const filter = SupplierOrders.state.currentFilter;
    console.log('[Orders] Applying filter:', filter);
    
    if (filter === 'all') {
      SupplierOrders.state.filteredOrders = [...SupplierOrders.state.orders];
    } else {
      SupplierOrders.state.filteredOrders = SupplierOrders.state.orders.filter(
        order => order.status === filter
      );
    }
    
    console.log('[Orders] Filtered orders:', SupplierOrders.state.filteredOrders.length);
    SupplierOrders.renderOrders();
    SupplierOrders.renderPagination();
  },

  searchOrders: (query) => {
    if (!query) {
      SupplierOrders.applyFilter();
      return;
    }

    const lowerQuery = query.toLowerCase();
    SupplierOrders.state.filteredOrders = SupplierOrders.state.orders.filter(order => {
      return (
        (order.order_number && order.order_number.toLowerCase().includes(lowerQuery)) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(lowerQuery)) ||
        (order.customer_email && order.customer_email.toLowerCase().includes(lowerQuery))
      );
    });
    
    SupplierOrders.state.currentPage = 1;
    SupplierOrders.renderOrders();
    SupplierOrders.renderPagination();
  },

  updateCounts: () => {
    const counts = SupplierOrders.state.counts;
    
    const updateBadge = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || 0;
    };

    updateBadge('count-all', counts.all);
    updateBadge('count-pending', counts.pending);
    updateBadge('count-shipped', counts.shipped);
    updateBadge('count-delivered', counts.delivered);
  },

  translateStatus: (status) => {
    return SupplierOrders.STATUS_MAP[status]?.label || status || 'Inconnu';
  },

  getStatusBadge: (status) => {
    const config = SupplierOrders.STATUS_MAP[status] || { label: status || 'Inconnu', class: 'badge-pending' };
    return `<span class="badge ${config.class} capitalize">${config.label}</span>`;
  },

  // ============================================
  // RENDU EN CARDS (Design de l'ancien fichier)
  // ============================================
  renderOrders: () => {
    const container = document.getElementById('orders-list');
    if (!container) {
      console.error('[Orders] Container #orders-list not found');
      return;
    }

    const orders = SupplierOrders.state.filteredOrders;
    
    if (orders.length === 0) {
      const filterLabel = SupplierOrders.state.currentFilter !== 'all' 
        ? `avec statut "${SupplierOrders.translateStatus(SupplierOrders.state.currentFilter)}"` 
        : '';
      
      container.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <i class="fas fa-shopping-bag text-4xl mb-4 opacity-50"></i>
          <p class="text-slate-400 mb-2">Aucune commande ${filterLabel}</p>
          <p class="text-sm text-slate-600">Les commandes apparaîtront ici</p>
        </div>
      `;
      return;
    }

    // Pagination
    const start = (SupplierOrders.state.currentPage - 1) * SupplierOrders.state.itemsPerPage;
    const end = start + SupplierOrders.state.itemsPerPage;
    const paginatedOrders = orders.slice(start, end);

    // Rendu en cards (style ancien fichier)
    container.innerHTML = paginatedOrders.map(order => {
      const status = order.status || 'pending';
      const orderNumber = order.order_number || order.id;
      const statusBadge = SupplierOrders.getStatusBadge(status);
      
      // Déterminer les boutons d'action selon le statut
      let actionButtons = '';
      
      if (status === 'pending' || status === 'paid') {
        actionButtons = `
          <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" 
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors text-white">
            <i class="fas fa-truck mr-1"></i> Expédier
          </button>
        `;
      } else if (status === 'shipped') {
        actionButtons = `
          <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" 
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors text-white">
            <i class="fas fa-check mr-1"></i> Marquer livrée
          </button>
        `;
      }

      return `
        <div class="card rounded-xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center hover:shadow-lg transition-shadow border border-slate-800 bg-slate-900/50 mb-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="font-mono text-indigo-400 font-bold text-lg">#${orderNumber}</span>
              ${statusBadge}
              ${status === 'pending' ? '<span class="animate-pulse w-2 h-2 bg-red-500 rounded-full" title="Nouvelle commande"></span>' : ''}
            </div>
            <p class="text-sm text-slate-400 mb-1">
              <i class="far fa-calendar mr-1"></i> ${DashboardApp.formatDate(order.created_at)}
            </p>
            <p class="text-white font-medium flex items-center gap-2 flex-wrap">
              <i class="far fa-user text-slate-500"></i> ${order.customer_name || 'Client'}
              ${order.customer_email ? `<span class="text-slate-500 text-xs">(${order.customer_email})</span>` : ''}
            </p>
          </div>
          
          <div class="flex flex-col md:items-end gap-3 w-full md:w-auto">
            <p class="text-2xl font-bold text-white">${DashboardApp.formatPrice(order.total_amount)}</p>
            <div class="flex gap-2 flex-wrap">
              <button onclick="SupplierOrders.viewOrder(${order.id})" 
                      class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors border border-slate-700 text-slate-300">
                <i class="fas fa-eye mr-1"></i> Détails
              </button>
              ${actionButtons}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderEmpty: (message) => {
    const container = document.getElementById('orders-list');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <i class="fas fa-inbox text-4xl mb-4 opacity-50"></i>
          <p class="text-lg text-slate-400 mb-2">${message}</p>
          <p class="text-sm text-slate-600">Les commandes apparaîtront ici</p>
        </div>
      `;
    }
  },

  renderPagination: () => {
    const container = document.getElementById('orders-pagination');
    if (!container) return;

    const totalItems = SupplierOrders.state.filteredOrders.length;
    const totalPages = Math.ceil(totalItems / SupplierOrders.state.itemsPerPage);
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= SupplierOrders.state.currentPage - 1 && i <= SupplierOrders.state.currentPage + 1)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    container.innerHTML = `
      <div class="flex items-center justify-center gap-2 mt-6">
        <button onclick="SupplierOrders.changePage(-1)" 
                class="px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors ${SupplierOrders.state.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                ${SupplierOrders.state.currentPage === 1 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left"></i>
        </button>
        
        ${pages.map(page => {
          if (page === '...') {
            return `<span class="px-3 py-2 text-slate-500">...</span>`;
          }
          return `
            <button onclick="SupplierOrders.goToPage(${page})" 
                    class="px-3 py-2 rounded-lg transition-colors ${page === SupplierOrders.state.currentPage 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}">
              ${page}
            </button>
          `;
        }).join('')}
        
        <button onclick="SupplierOrders.changePage(1)" 
                class="px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors ${SupplierOrders.state.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                ${SupplierOrders.state.currentPage === totalPages ? 'disabled' : ''}>
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;
  },

  changePage: (delta) => {
    const newPage = SupplierOrders.state.currentPage + delta;
    const totalPages = Math.ceil(SupplierOrders.state.filteredOrders.length / SupplierOrders.state.itemsPerPage);
    
    if (newPage >= 1 && newPage <= totalPages) {
      SupplierOrders.state.currentPage = newPage;
      SupplierOrders.renderOrders();
      SupplierOrders.renderPagination();
    }
  },

  goToPage: (page) => {
    SupplierOrders.state.currentPage = page;
    SupplierOrders.renderOrders();
    SupplierOrders.renderPagination();
  },

  viewOrder: async (orderId) => {
    try {
      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.getOrderById(orderId);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      SupplierOrders.showOrderModal(response.data);
      
    } catch (error) {
      console.error('[Orders] Error viewing order:', error);
      DashboardApp.showToast('Erreur de chargement du détail', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  showOrderModal: (order) => {
    let modal = document.getElementById('order-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'order-detail-modal';
      modal.className = 'fixed inset-0 z-50 hidden';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="DashboardApp.closeModal('order-detail-modal')"></div>
        <div class="relative min-h-screen flex items-center justify-center p-4">
          <div class="modal-content bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const status = order.status || 'pending';
    const statusBadge = SupplierOrders.getStatusBadge(status);
    const content = modal.querySelector('.modal-content');
    
    // Construction des boutons d'action du modal
    let modalActions = '';
    
    if (status === 'pending' || status === 'paid') {
      modalActions = `
        <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped'); DashboardApp.closeModal('order-detail-modal');" 
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
          <i class="fas fa-truck mr-2"></i>Marquer comme expédiée
        </button>
      `;
    } else if (status === 'shipped') {
      modalActions = `
        <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered'); DashboardApp.closeModal('order-detail-modal');" 
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
          <i class="fas fa-check mr-2"></i>Marquer comme livrée
        </button>
      `;
    }
    
    const items = order.items || [];
    
    content.innerHTML = `
      <div class="p-6">
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-2xl font-bold text-white mb-1">Commande #${order.order_number || order.id}</h3>
            <p class="text-slate-400">${DashboardApp.formatDate(order.created_at)}</p>
          </div>
          ${statusBadge}
        </div>

        <div class="grid grid-cols-2 gap-6 mb-6">
          <div class="bg-slate-800/50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-slate-400 mb-2">Client</h4>
            <p class="text-white font-medium">${order.customer_name || 'N/A'}</p>
            <p class="text-slate-400 text-sm">${order.customer_email || ''}</p>
          </div>
          <div class="bg-slate-800/50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-slate-400 mb-2">Total</h4>
            <p class="text-2xl font-bold text-white">${DashboardApp.formatPrice(order.total_amount)}</p>
          </div>
        </div>

        ${order.shipping_address ? `
          <div class="bg-slate-800/50 rounded-lg p-4 mb-6">
            <h4 class="text-sm font-medium text-slate-400 mb-2">Adresse de livraison</h4>
            <p class="text-white whitespace-pre-line">${order.shipping_address}</p>
          </div>
        ` : ''}

        ${items.length > 0 ? `
          <div class="mb-6">
            <h4 class="text-sm font-medium text-slate-400 mb-3">Articles (${items.length})</h4>
            <div class="space-y-3">
              ${items.map(item => `
                <div class="flex items-center gap-4 bg-slate-800/30 rounded-lg p-3">
                  <img src="${item.main_image_url || item.image || 'https://via.placeholder.com/60?text=Produit'}" 
                       alt="${item.product_name || item.name || 'Produit'}" 
                       class="w-16 h-16 object-cover rounded-lg"
                       onerror="this.src='https://via.placeholder.com/60?text=Produit'">
                  <div class="flex-1">
                    <p class="font-medium text-white">${item.product_name || item.name || 'Produit'}</p>
                    <p class="text-sm text-slate-400">Qté: ${item.quantity || 1} × ${DashboardApp.formatPrice(item.unit_price || item.price || 0)}</p>
                  </div>
                  <p class="font-medium text-white">${DashboardApp.formatPrice((item.unit_price || item.price || 0) * (item.quantity || 1))}</p>
                </div>
              `).join('')}
            </div>
            <div class="flex justify-between items-center pt-4 mt-4 border-t border-slate-700">
              <span class="text-slate-400">Total</span>
              <span class="text-xl font-bold text-emerald-400">${DashboardApp.formatPrice(order.total_amount)}</span>
            </div>
          </div>
        ` : ''}

        <div class="flex justify-end gap-3">
          ${modalActions}
          <button onclick="DashboardApp.closeModal('order-detail-modal')" 
                  class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
            Fermer
          </button>
        </div>
      </div>
    `;

    DashboardApp.openModal('order-detail-modal');
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      const statusLabel = SupplierOrders.translateStatus(newStatus);
      
      if (!confirm(`Confirmer le changement de statut vers "${statusLabel}" ?`)) {
        return;
      }

      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      DashboardApp.showToast('Statut mis à jour avec succès', 'success');
      
      // Recharger les commandes pour refléter le changement
      await SupplierOrders.loadOrders();
      
    } catch (error) {
      console.error('[Orders] Error updating status:', error);
      DashboardApp.showToast('Erreur de mise à jour du statut', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  }
};

console.log('[SupplierOrders] Module chargé v2.6 - Design Cards + Filtrage');

// Exposer globalement pour les onclick inline
window.setOrderFilter = (filter) => SupplierOrders.setFilter(filter);
window.filterOrders = (filter) => SupplierOrders.setFilter(filter);