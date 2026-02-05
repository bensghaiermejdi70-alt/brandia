// ============================================
// SUPPLIER ORDERS MODULE - CORRIGÉ V2.2
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    currentFilter: 'all',
    selectedOrder: null
  },

  init: async () => {
    console.log('[Orders] Init called');
    await SupplierOrders.loadOrders();
  },

  loadOrders: async () => {
    try {
      DashboardApp.showLoading(true);
      console.log('[Orders] Chargement avec filtre:', SupplierOrders.state.currentFilter);
      
      // 🔧 CORRECTION : Ne pas envoyer 'all' au backend
      const statusFilter = SupplierOrders.state.currentFilter === 'all' 
        ? null 
        : SupplierOrders.state.currentFilter;
      
      console.log('[Orders] Appel API avec statusFilter:', statusFilter);
      
      const response = await BrandiaAPI.Supplier.getOrders(statusFilter);
      console.log('[Orders] Réponse API:', response);

      // Gestion robuste de la structure de réponse
      let orders = [];
      let counts = { all: 0, pending: 0, paid: 0, shipped: 0, delivered: 0 };

      if (response.success && response.data) {
        if (response.data.orders && Array.isArray(response.data.orders)) {
          orders = response.data.orders;
          counts = response.data.counts || counts;
        } else if (Array.isArray(response.data)) {
          orders = response.data;
        }
      }

      console.log('[Orders] Commandes reçues:', orders.length);
      console.log('[Orders] Counts:', counts);
      
      SupplierOrders.state.orders = orders;
      SupplierOrders.render();
      SupplierOrders.updateCounts(counts);
      
    } catch (error) {
      console.error('[Orders] Erreur chargement:', error);
      SupplierOrders.state.orders = [];
      SupplierOrders.render();
      SupplierOrders.updateCounts({ all: 0, pending: 0, paid: 0, shipped: 0, delivered: 0 });
      DashboardApp.showToast('Erreur de chargement des commandes', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  render: () => {
    const container = document.getElementById('orders-list');
    if (!container) {
      console.error('[Orders] Container #orders-list non trouvé');
      return;
    }

    const orders = SupplierOrders.state.orders || [];

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

    container.innerHTML = orders.map(order => {
      const status = order.status || 'pending';
      const orderNumber = order.order_number || order.id;
      
      return `
        <div class="card rounded-xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center hover:shadow-lg transition-shadow border border-slate-800">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="font-mono text-indigo-400 font-bold">#${orderNumber}</span>
              <span class="badge badge-${status} capitalize">${SupplierOrders.translateStatus(status)}</span>
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
          
          <div class="flex flex-col md:items-end gap-2 w-full md:w-auto">
            <p class="text-2xl font-bold text-white">${DashboardApp.formatPrice(order.total_amount)}</p>
            <div class="flex gap-2 flex-wrap">
              <button onclick="SupplierOrders.viewDetail(${order.id})" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors border border-slate-700">
                <i class="fas fa-eye mr-1"></i> Détails
              </button>
              ${status === 'paid' ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors">
                  <i class="fas fa-truck mr-1"></i> Expédier
                </button>
              ` : ''}
              ${status === 'shipped' ? `
                <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors">
                  <i class="fas fa-check mr-1"></i> Livrer
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // 🔧 AJOUT : Méthode translateStatus locale
  translateStatus: (status) => {
    const map = {
      pending: 'En attente',
      paid: 'Payée',
      processing: 'En préparation',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return map[status] || status;
  },

  updateCounts: (counts) => {
    const map = {
      all: parseInt(counts?.all) || 0,
      pending: parseInt(counts?.pending) || 0,
      paid: parseInt(counts?.paid) || 0,
      shipped: parseInt(counts?.shipped) || 0,
      delivered: parseInt(counts?.delivered) || 0
    };

    console.log('[Orders] Mise à jour des compteurs:', map);

    Object.keys(map).forEach(key => {
      const el = document.getElementById(`count-${key}`);
      if (el) {
        el.textContent = map[key];
        console.log(`[Orders] Compteur ${key} mis à jour:`, map[key]);
      } else {
        console.warn(`[Orders] Élément #count-${key} non trouvé`);
      }
    });

    // Badge sidebar
    const badge = document.getElementById('order-badge');
    if (badge) {
      badge.textContent = map.pending;
      badge.classList.toggle('hidden', map.pending === 0);
    }
  },

  // 🔧 CORRECTION CRITIQUE : Méthode filter avec logs de debug
  filter: (status) => {
    console.log('[Orders] Filter appelé avec status:', status);
    
    SupplierOrders.state.currentFilter = status;
    
    // Update UI tabs
    const tabs = document.querySelectorAll('.order-tab');
    console.log('[Orders] Nombre de tabs trouvés:', tabs.length);
    
    tabs.forEach((tab, index) => {
      console.log(`[Orders] Tab ${index}:`, tab.dataset.filter);
      
      tab.classList.remove('active', 'bg-indigo-600', 'text-white');
      tab.classList.add('text-slate-400');
      
      if (tab.dataset.filter === status) {
        tab.classList.add('active', 'bg-indigo-600', 'text-white');
        tab.classList.remove('text-slate-400');
        console.log('[Orders] Tab activé:', status);
      }
    });

    // Recharger les données depuis l'API
    console.log('[Orders] Rechargement des données avec filtre:', status);
    SupplierOrders.loadOrders();
  },

  viewDetail: async (orderId) => {
    try {
      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.getOrderById(orderId);
      
      if (!response.success || !response.data) {
        throw new Error('Commande non trouvée');
      }

      const order = response.data;
      SupplierOrders.state.selectedOrder = order;
      
      const status = order.status || 'pending';

      const detailNumber = document.getElementById('order-detail-number');
      if (detailNumber) {
        detailNumber.textContent = '#' + (order.order_number || order.id);
      }
      
      const content = document.getElementById('order-detail-content');
      if (!content) {
        console.error('[Orders] Container #order-detail-content non trouvé');
        return;
      }

      const items = order.items || [];
      
      content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p class="text-slate-400 text-xs mb-1 uppercase tracking-wider">Date de commande</p>
            <p class="text-white font-medium">${DashboardApp.formatDate(order.created_at)}</p>
          </div>
          <div class="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p class="text-slate-400 text-xs mb-1 uppercase tracking-wider">Statut</p>
            <span class="badge badge-${status}">${SupplierOrders.translateStatus(status)}</span>
          </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-lg mb-6 border border-slate-700">
          <h4 class="font-semibold mb-3 text-white flex items-center gap-2">
            <i class="fas fa-box text-indigo-400"></i>
            Articles commandés (${items.length})
          </h4>
          <div class="space-y-3">
            ${items.length > 0 ? items.map(item => `
              <div class="flex justify-between items-center py-3 border-b border-slate-700 last:border-0">
                <div class="flex items-center gap-3">
                  <img src="${item.main_image_url || item.image || 'https://via.placeholder.com/48?text=Produit'}" 
                       class="w-12 h-12 rounded object-cover bg-slate-700"
                       onerror="this.src='https://via.placeholder.com/48?text=Produit'">
                  <div>
                    <p class="text-white font-medium">${item.product_name || item.name || 'Produit'}</p>
                    <p class="text-xs text-slate-400">Qté: ${item.quantity || 1} × ${DashboardApp.formatPrice(item.price || 0)}</p>
                  </div>
                </div>
                <p class="text-indigo-400 font-medium">${DashboardApp.formatPrice((item.price || 0) * (item.quantity || 1))}</p>
              </div>
            `).join('') : '<p class="text-slate-500 text-center py-4">Aucun détail d\'article disponible</p>'}
          </div>
          <div class="flex justify-between items-center pt-4 mt-4 border-t border-slate-700 font-bold text-lg">
            <span class="text-white">Total</span>
            <span class="text-emerald-400">${DashboardApp.formatPrice(order.total_amount)}</span>
          </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <h4 class="font-semibold mb-2 text-white flex items-center gap-2">
            <i class="fas fa-map-marker-alt text-indigo-400"></i>
            Adresse de livraison
          </h4>
          <p class="text-slate-300 text-sm whitespace-pre-line">${order.shipping_address || 'Non spécifiée'}</p>
        </div>
      `;

      const actions = document.getElementById('order-actions');
      if (actions) {
        actions.innerHTML = '';
        
        if (status === 'paid') {
          actions.innerHTML = `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" class="btn-primary px-6 py-2.5 rounded-lg">
              <i class="fas fa-truck mr-2"></i>Marquer comme expédiée
            </button>
          `;
        } else if (status === 'shipped') {
          actions.innerHTML = `
            <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" class="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-lg text-white transition-colors">
              <i class="fas fa-check mr-2"></i>Marquer comme livrée
            </button>
          `;
        } else {
          actions.innerHTML = `<p class="text-slate-500 text-sm">Aucune action disponible pour ce statut</p>`;
        }
      }

      DashboardApp.openModal('order-modal');
    } catch (error) {
      console.error('[Orders] Erreur détail:', error);
      DashboardApp.showToast('Erreur chargement détails: ' + error.message, 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      await BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      DashboardApp.showToast(`Statut mis à jour: ${SupplierOrders.translateStatus(newStatus)}`, 'success');
      DashboardApp.closeModal('order-modal');
      SupplierOrders.loadOrders();
    } catch (error) {
      console.error('[Orders] Erreur update status:', error);
      DashboardApp.showToast('Erreur mise à jour statut: ' + error.message, 'error');
    }
  }
};

// 🔧 CORRECTION : Exposer globalement avec vérification
window.filterOrders = (status) => {
  console.log('[Global] filterOrders appelé avec:', status);
  if (window.SupplierOrders) {
    window.SupplierOrders.filter(status);
  } else {
    console.error('[Global] SupplierOrders non disponible');
  }
};

window.showOrderDetail = (id) => {
  if (window.SupplierOrders) {
    window.SupplierOrders.viewDetail(id);
  }
};

window.updateOrderStatus = (id, status) => {
  if (window.SupplierOrders) {
    window.SupplierOrders.updateStatus(id, status);
  }
};

console.log('[SupplierOrders] Module chargé v2.2');