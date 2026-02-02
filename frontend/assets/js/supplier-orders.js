// ============================================
// SUPPLIER ORDERS MODULE
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    currentFilter: 'all',
    selectedOrder: null
  },

  init: async () => {
    await SupplierOrders.loadOrders();
  },

  loadOrders: async () => {
    try {
      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.getOrders(SupplierOrders.state.currentFilter);
      SupplierOrders.state.orders = response.data?.orders || [];
      SupplierOrders.render();
      SupplierOrders.updateCounts(response.data?.counts || {});
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      DashboardApp.showToast('Erreur de chargement des commandes', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  render: () => {
    const container = document.getElementById('orders-list');
    if (!container) return;

    let filtered = SupplierOrders.state.orders;
    
    if (SupplierOrders.state.currentFilter !== 'all') {
      filtered = filtered.filter(o => o.status === SupplierOrders.state.currentFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <i class="fas fa-shopping-bag text-4xl mb-4 opacity-50"></i>
          <p>Aucune commande ${SupplierOrders.state.currentFilter !== 'all' ? 'avec ce statut' : ''}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => `
      <div class="card rounded-xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center hover:shadow-lg transition-shadow">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span class="font-mono text-indigo-400 font-bold">#${order.order_number || order.id}</span>
            <span class="badge badge-${order.status} capitalize">${DashboardApp.translateStatus(order.status)}</span>
            ${order.status === 'pending' ? '<span class="animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>' : ''}
          </div>
          <p class="text-sm text-slate-400 mb-1">
            <i class="far fa-calendar mr-1"></i> ${DashboardApp.formatDate(order.created_at)}
          </p>
          <p class="text-white font-medium flex items-center gap-2">
            <i class="far fa-user text-slate-500"></i> ${order.customer_name || 'Client'}
            <span class="text-slate-500 text-xs">(${order.customer_email || 'email non disponible'})</span>
          </p>
        </div>
        
        <div class="flex flex-col md:items-end gap-2">
          <p class="text-2xl font-bold text-white">${DashboardApp.formatPrice(order.total_amount)}</p>
          <div class="flex gap-2">
            <button onclick="SupplierOrders.viewDetail(${order.id})" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors">
              Détails
            </button>
            ${order.status === 'paid' ? `
              <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors">
                <i class="fas fa-truck mr-1"></i> Expédier
              </button>
            ` : ''}
            ${order.status === 'shipped' ? `
              <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors">
                <i class="fas fa-check mr-1"></i> Livrer
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  },

  updateCounts: (counts) => {
    const map = {
      all: counts.all || 0,
      pending: counts.pending || 0,
      paid: counts.paid || 0,
      shipped: counts.shipped || 0,
      delivered: counts.delivered || 0
    };

    Object.keys(map).forEach(key => {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = map[key];
    });

    // Badge sidebar
    const badge = document.getElementById('order-badge');
    if (badge) {
      badge.textContent = map.pending;
      badge.classList.toggle('hidden', map.pending === 0);
    }
  },

  filter: (status) => {
    SupplierOrders.state.currentFilter = status;
    
    // Update UI tabs
    document.querySelectorAll('.order-tab').forEach(tab => {
      tab.classList.remove('active', 'bg-indigo-600', 'text-white');
      tab.classList.add('text-slate-400');
      if (tab.dataset.filter === status) {
        tab.classList.add('active', 'bg-indigo-600', 'text-white');
        tab.classList.remove('text-slate-400');
      }
    });

    SupplierOrders.render();
  },

  viewDetail: async (orderId) => {
    try {
      const response = await BrandiaAPI.Supplier.getOrderById(orderId);
      const order = response.data;
      SupplierOrders.state.selectedOrder = order;

      document.getElementById('order-detail-number').textContent = '#' + (order.order_number || order.id);
      
      const content = document.getElementById('order-detail-content');
      content.innerHTML = `
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-slate-800 p-4 rounded-lg">
            <p class="text-slate-400 text-xs mb-1">Date de commande</p>
            <p class="text-white font-medium">${DashboardApp.formatDate(order.created_at)}</p>
          </div>
          <div class="bg-slate-800 p-4 rounded-lg">
            <p class="text-slate-400 text-xs mb-1">Statut</p>
            <span class="badge badge-${order.status}">${DashboardApp.translateStatus(order.status)}</span>
          </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-lg mb-6">
          <h4 class="font-semibold mb-3">Articles commandés</h4>
          <div class="space-y-3">
            ${(order.items || []).map(item => `
              <div class="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                <div class="flex items-center gap-3">
                  <img src="${item.main_image_url || 'placeholder.jpg'}" class="w-12 h-12 rounded object-cover bg-slate-700">
                  <div>
                    <p class="text-white font-medium">${item.product_name}</p>
                    <p class="text-xs text-slate-400">Qté: ${item.quantity}</p>
                  </div>
                </div>
                <p class="text-indigo-400 font-medium">${DashboardApp.formatPrice(item.price * item.quantity)}</p>
              </div>
            `).join('')}
          </div>
          <div class="flex justify-between items-center pt-4 mt-4 border-t border-slate-700 font-bold text-lg">
            <span class="text-white">Total</span>
            <span class="text-emerald-400">${DashboardApp.formatPrice(order.total_amount)}</span>
          </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-lg">
          <h4 class="font-semibold mb-2">Adresse de livraison</h4>
          <p class="text-slate-300 text-sm whitespace-pre-line">${order.shipping_address || 'Non spécifiée'}</p>
        </div>
      `;

      // Actions selon statut
      const actions = document.getElementById('order-actions');
      actions.innerHTML = '';
      
      if (order.status === 'paid') {
        actions.innerHTML = `
          <button onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')" class="btn-primary px-6 py-2.5 rounded-lg">
            <i class="fas fa-truck mr-2"></i>Marquer comme expédiée
          </button>
        `;
      } else if (order.status === 'shipped') {
        actions.innerHTML = `
          <button onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')" class="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-lg text-white">
            <i class="fas fa-check mr-2"></i>Marquer comme livrée
          </button>
        `;
      }

      DashboardApp.openModal('order-modal');
    } catch (error) {
      DashboardApp.showToast('Erreur chargement détails', 'error');
    }
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      await BrandiaAPI.Supplier.updateOrderStatus(orderId, newStatus);
      DashboardApp.showToast(`Statut mis à jour: ${DashboardApp.translateStatus(newStatus)}`, 'success');
      DashboardApp.closeModal('order-modal');
      SupplierOrders.loadOrders();
    } catch (error) {
      DashboardApp.showToast('Erreur mise à jour statut', 'error');
    }
  }
};

window.filterOrders = (status) => SupplierOrders.filter(status);
window.showOrderDetail = (id) => SupplierOrders.viewDetail(id);
window.updateOrderStatus = (id, status) => SupplierOrders.updateStatus(id, status);