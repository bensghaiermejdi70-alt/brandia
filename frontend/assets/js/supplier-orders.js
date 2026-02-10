// ============================================
// SUPPLIER ORDERS MODULE - Gestion des commandes
// Version 3.0 - Corrigé pour Brandia API
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
      delivered: 0,
      cancelled: 0
    },
    currentPage: 1,
    itemsPerPage: 10,
    selectedOrder: null
  },

  // Mapping des statuts DB -> Affichage
  STATUS_MAP: {
    pending: { label: 'À préparer', class: 'badge-pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    paid: { label: 'Payée', class: 'badge-paid', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    processing: { label: 'En préparation', class: 'badge-processing', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    shipped: { label: 'Expédiée', class: 'badge-shipped', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    delivered: { label: 'Livrée', class: 'badge-delivered', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    cancelled: { label: 'Annulée', class: 'badge-cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    refunded: { label: 'Remboursée', class: 'badge-refunded', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
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
        if (filter) {
          SupplierOrders.setFilter(filter);
        }
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
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }
      
      console.log('[Orders] Chargement avec filtre:', SupplierOrders.state.currentFilter);
      
      const statusFilter = SupplierOrders.state.currentFilter === 'all' ? null : SupplierOrders.state.currentFilter;
      console.log('[Orders] Appel API avec statusFilter:', statusFilter);
      
      // 🔥 CORRECTION : Vérifier que BrandiaAPI existe
      if (!window.BrandiaAPI || !window.BrandiaAPI.Supplier) {
        throw new Error('API non disponible');
      }
      
      const response = await window.BrandiaAPI.Supplier.getOrders(statusFilter);
      console.log('[Orders] Réponse API brute:', response);
      
      if (!response.success) {
        throw new Error(response.message || 'Erreur de chargement');
      }

      // 🔥 CORRECTION : Gérer les deux formats de réponse possibles
      let orders = [];
      let counts = {};
      
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.orders)) {
          // Format structuré attendu
          orders = response.data.orders;
          counts = response.data.counts || {};
        } else if (Array.isArray(response.data)) {
          // Ancien format (tableau direct)
          orders = response.data;
          counts = SupplierOrders.calculateCounts(orders);
        }
      }
      
      console.log('[Orders] Orders parsed:', orders.length);
      console.log('[Orders] Counts parsed:', counts);

      SupplierOrders.state.orders = orders;
      SupplierOrders.state.counts = {
        all: parseInt(counts.all) || parseInt(counts.all_count) || orders.length,
        pending: parseInt(counts.pending) || parseInt(counts.pending_count) || 0,
        shipped: parseInt(counts.shipped) || parseInt(counts.shipped_count) || 0,
        delivered: parseInt(counts.delivered) || parseInt(counts.delivered_count) || 0,
        cancelled: parseInt(counts.cancelled) || parseInt(counts.cancelled_count) || 0
      };

      console.log('[Orders] State counts:', SupplierOrders.state.counts);

      SupplierOrders.state.filteredOrders = [...orders];
      SupplierOrders.renderOrders();
      SupplierOrders.updateCounts();
      
    } catch (error) {
      console.error('[Orders] Error loading orders:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur de chargement des commandes: ' + error.message, 'error');
      }
      SupplierOrders.renderEmpty('Erreur de chargement: ' + error.message);
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  },

  calculateCounts: (orders) => {
    return {
      all: orders.length,
      pending: orders.filter(o => o.status === 'pending' || o.status === 'paid' || !o.status).length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
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
      tab.classList.remove('active', 'bg-indigo-600', 'text-white', 'ring-2', 'ring-indigo-500');
      tab.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
      
      if (tabFilter === filter) {
        tab.classList.add('active', 'bg-indigo-600', 'text-white', 'ring-2', 'ring-indigo-500');
        tab.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
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
        order => {
          if (filter === 'pending') {
            return order.status === 'pending' || order.status === 'paid' || !order.status;
          }
          return order.status === filter;
        }
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
        (order.customer_email && order.customer_email.toLowerCase().includes(lowerQuery)) ||
        (order.id && order.id.toString().includes(lowerQuery))
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
    updateBadge('count-cancelled', counts.cancelled);
  },

  translateStatus: (status) => {
    return SupplierOrders.STATUS_MAP[status]?.label || status || 'Inconnu';
  },

  getStatusBadge: (status) => {
    const config = SupplierOrders.STATUS_MAP[status] || { 
      label: status || 'Inconnu', 
      color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' 
    };
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} backdrop-blur-sm">
      ${config.label}
    </span>`;
  },

  // ============================================
  // RENDU EN CARDS
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
          <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
            <i class="fas fa-shopping-bag text-3xl text-slate-600"></i>
          </div>
          <p class="text-slate-400 mb-2 text-lg">Aucune commande ${filterLabel}</p>
          <p class="text-sm text-slate-600">Les commandes apparaîtront ici lorsque des clients passeront des commandes</p>
        </div>
      `;
      return;
    }

    // Pagination
    const start = (SupplierOrders.state.currentPage - 1) * SupplierOrders.state.itemsPerPage;
    const end = start + SupplierOrders.state.itemsPerPage;
    const paginatedOrders = orders.slice(start, end);

    // Rendu en cards
    container.innerHTML = paginatedOrders.map(order => {
      const status = order.status || 'pending';
      const orderNumber = order.order_number || `#${order.id}`;
      const statusBadge = SupplierOrders.getStatusBadge(status);
      
      // Calculer le nombre d'articles
      const itemsCount = order.items ? order.items.length : 0;
      const totalItems = order.items ? order.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0) : 0;
      
      // Déterminer les boutons d'action selon le statut
      let actionButtons = '';
      
      if (status === 'pending' || status === 'paid') {
        actionButtons = `
          <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" 
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-all text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40">
            <i class="fas fa-truck mr-2"></i>Expédier
          </button>
        `;
      } else if (status === 'shipped') {
        actionButtons = `
          <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" 
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-all text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40">
            <i class="fas fa-check mr-2"></i>Marquer livrée
          </button>
        `;
      }

      // Formater la date
      const orderDate = order.created_at 
        ? new Date(order.created_at).toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Date inconnue';

      return `
        <div class="card rounded-xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center hover:shadow-xl transition-all duration-300 border border-slate-800 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-700 mb-4 group">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-3 flex-wrap">
              <span class="font-mono text-indigo-400 font-bold text-lg tracking-tight">${orderNumber}</span>
              ${statusBadge}
              ${status === 'pending' ? '<span class="animate-pulse w-2 h-2 bg-amber-500 rounded-full" title="Nouvelle commande"></span>' : ''}
            </div>
            <div class="flex items-center gap-4 text-sm text-slate-400 mb-2 flex-wrap">
              <span class="flex items-center gap-1.5">
                <i class="far fa-calendar text-slate-500"></i>
                ${orderDate}
              </span>
              <span class="flex items-center gap-1.5">
                <i class="fas fa-box text-slate-500"></i>
                ${totalItems} article${totalItems > 1 ? 's' : ''}
              </span>
            </div>
            <p class="text-white font-medium flex items-center gap-2 flex-wrap">
              <i class="far fa-user text-slate-500"></i>
              <span class="truncate">${order.customer_name || order.customer_first_name + ' ' + order.customer_last_name || 'Client'}</span>
              ${order.customer_email ? `<span class="text-slate-500 text-xs hidden sm:inline">(${order.customer_email})</span>` : ''}
            </p>
          </div>
          
          <div class="flex flex-col md:items-end gap-3 w-full md:w-auto">
            <p class="text-2xl font-bold text-white tracking-tight">${SupplierOrders.formatPrice(order.total_amount)}</p>
            <div class="flex gap-2 flex-wrap">
              <button onclick="SupplierOrders.viewOrder(${order.id})" 
                      class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-all border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600">
                <i class="fas fa-eye mr-2"></i>Détails
              </button>
              ${actionButtons}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  formatPrice: (amount) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  },

  renderEmpty: (message) => {
    const container = document.getElementById('orders-list');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
            <i class="fas fa-exclamation-triangle text-3xl text-amber-500/50"></i>
          </div>
          <p class="text-lg text-slate-400 mb-2">${message}</p>
          <button onclick="SupplierOrders.loadOrders()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
            <i class="fas fa-sync-alt mr-2"></i>Réessayer
          </button>
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
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' 
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
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }
      
      const response = await window.BrandiaAPI.Supplier.getOrderById(orderId);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      SupplierOrders.showOrderModal(response.data);
      
    } catch (error) {
      console.error('[Orders] Error viewing order:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur de chargement du détail', 'error');
      }
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  },

  showOrderModal: (order) => {
    let modal = document.getElementById('order-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'order-detail-modal';
      modal.className = 'fixed inset-0 z-50 hidden';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="SupplierOrders.closeModal('order-detail-modal')"></div>
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
        <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped'); SupplierOrders.closeModal('order-detail-modal');" 
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/25">
          <i class="fas fa-truck mr-2"></i>Marquer comme expédiée
        </button>
      `;
    } else if (status === 'shipped') {
      modalActions = `
        <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered'); SupplierOrders.closeModal('order-detail-modal');" 
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-lg shadow-emerald-500/25">
          <i class="fas fa-check mr-2"></i>Marquer comme livrée
        </button>
      `;
    }
    
    const items = order.items || [];
    const orderDate = order.created_at 
      ? new Date(order.created_at).toLocaleDateString('fr-FR', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Date inconnue';
    
    content.innerHTML = `
      <div class="p-6">
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-2xl font-bold text-white mb-1">Commande ${order.order_number || '#' + order.id}</h3>
            <p class="text-slate-400 flex items-center gap-2">
              <i class="far fa-calendar"></i>
              ${orderDate}
            </p>
          </div>
          ${statusBadge}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h4 class="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <i class="far fa-user"></i>Client
            </h4>
            <p class="text-white font-medium">${order.customer_name || order.customer_first_name + ' ' + order.customer_last_name || 'N/A'}</p>
            <p class="text-slate-400 text-sm">${order.customer_email || ''}</p>
            ${order.customer_phone ? `<p class="text-slate-400 text-sm mt-1"><i class="fas fa-phone mr-1"></i>${order.customer_phone}</p>` : ''}
          </div>
          <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h4 class="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <i class="fas fa-euro-sign"></i>Total
            </h4>
            <p class="text-3xl font-bold text-white">${SupplierOrders.formatPrice(order.total_amount)}</p>
            <div class="mt-2 text-sm text-slate-400">
              ${order.subtotal ? `<div>Sous-total: ${SupplierOrders.formatPrice(order.subtotal)}</div>` : ''}
              ${order.shipping_cost ? `<div>Livraison: ${SupplierOrders.formatPrice(order.shipping_cost)}</div>` : ''}
              ${order.vat_amount ? `<div>TVA: ${SupplierOrders.formatPrice(order.vat_amount)}</div>` : ''}
            </div>
          </div>
        </div>

        ${order.shipping_address ? `
          <div class="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
            <h4 class="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <i class="fas fa-map-marker-alt"></i>Adresse de livraison
            </h4>
            <p class="text-white whitespace-pre-line leading-relaxed">${order.shipping_address}</p>
            ${order.shipping_city ? `<p class="text-slate-400 mt-1">${order.shipping_city} ${order.shipping_postal_code || ''}</p>` : ''}
          </div>
        ` : ''}

        ${items.length > 0 ? `
          <div class="mb-6">
            <h4 class="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <i class="fas fa-box-open"></i>Articles (${items.length})
            </h4>
            <div class="space-y-3">
              ${items.map(item => `
                <div class="flex items-center gap-4 bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                  <img src="${item.product_image_url || item.image || 'https://via.placeholder.com/60?text=Produit'}" 
                       alt="${item.product_name || item.name || 'Produit'}" 
                       class="w-16 h-16 object-cover rounded-lg bg-slate-700"
                       onerror="this.src='https://via.placeholder.com/60?text=Produit'">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-white truncate">${item.product_name || item.name || 'Produit'}</p>
                    <p class="text-sm text-slate-400">
                      Qté: ${item.quantity || 1} × ${SupplierOrders.formatPrice(item.unit_price || item.price || 0)}
                    </p>
                    ${item.supplier_amount ? `<p class="text-xs text-emerald-400 mt-0.5">Votre part: ${SupplierOrders.formatPrice(item.supplier_amount)}</p>` : ''}
                  </div>
                  <p class="font-medium text-white">${SupplierOrders.formatPrice((item.unit_price || item.price || 0) * (item.quantity || 1))}</p>
                </div>
              `).join('')}
            </div>
            <div class="flex justify-between items-center pt-4 mt-4 border-t border-slate-700">
              <span class="text-slate-400">Total</span>
              <span class="text-xl font-bold text-emerald-400">${SupplierOrders.formatPrice(order.total_amount)}</span>
            </div>
          </div>
        ` : ''}

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
          ${modalActions}
          <button onclick="SupplierOrders.closeModal('order-detail-modal')" 
                  class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
            Fermer
          </button>
        </div>
      </div>
    `;

    SupplierOrders.openModal('order-detail-modal');
  },

  openModal: (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal: (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      const statusLabel = SupplierOrders.translateStatus(newStatus);
      
      if (!confirm(`Confirmer le changement de statut vers "${statusLabel}" ?`)) {
        return;
      }

      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }
      
      const response = await window.BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      
      if (!response.success) {
        throw new Error(response.message);
      }

      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Statut mis à jour avec succès', 'success');
      }
      
      // Recharger les commandes pour refléter le changement
      await SupplierOrders.loadOrders();
      
    } catch (error) {
      console.error('[Orders] Error updating status:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur de mise à jour du statut: ' + error.message, 'error');
      }
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  }
};

console.log('[SupplierOrders] Module chargé v3.0 - Corrigé pour Brandia API');

// Exposer globalement pour les onclick inline
window.setOrderFilter = (filter) => SupplierOrders.setFilter(filter);
window.filterOrders = (filter) => SupplierOrders.setFilter(filter);