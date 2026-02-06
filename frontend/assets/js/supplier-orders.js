// ============================================
// SUPPLIER ORDERS MODULE - FIX FINAL V2.4
// ============================================

window.SupplierOrders = {
  state: {
    orders: [],
    currentFilter: 'all',
    selectedOrder: null
  },

  init: async () => {
    console.log('[Orders] Init');
    await SupplierOrders.loadOrders();
  },

  // ============================================
  // LOAD
  // ============================================
  loadOrders: async () => {
    try {
      DashboardApp.showLoading(true);

      const filter = SupplierOrders.state.currentFilter;
      console.log('[Orders] Loading with filter:', filter);

      const response = await BrandiaAPI.Supplier.getOrders(
        filter === 'all' ? null : filter
      );

      SupplierOrders.state.orders = response?.data?.orders || [];
      SupplierOrders.render();
      SupplierOrders.updateCounts(response?.data?.counts || {});

    } catch (error) {
      console.error('[Orders] Load error:', error);
      SupplierOrders.state.orders = [];
      SupplierOrders.render();
      SupplierOrders.updateCounts({});
      DashboardApp.showToast('Erreur chargement commandes', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  // ============================================
  // RENDER LIST
  // ============================================
  render: () => {
    const container = document.getElementById('orders-list');
    if (!container) return;

    const orders = SupplierOrders.state.orders;

    if (!orders.length) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <i class="fas fa-box-open text-4xl mb-4 opacity-50"></i>
          <p>Aucune commande</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const status = order.status;
      const number = order.order_number || order.id;

      return `
        <div class="card p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row gap-4">
          
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="font-mono text-indigo-400 font-bold">#${number}</span>
              <span class="badge badge-${status}">
                ${SupplierOrders.translateStatus(status)}
              </span>
            </div>

            <p class="text-sm text-slate-400">
              ${DashboardApp.formatDate(order.created_at)}
            </p>

            <p class="text-white font-medium">
              ${order.customer_name || 'Client'}
              <span class="text-slate-500 text-xs">
                (${order.customer_email || ''})
              </span>
            </p>
          </div>

          <div class="flex flex-col items-end gap-2">
            <p class="text-xl font-bold">
              ${DashboardApp.formatPrice(order.total_amount)}
            </p>

            <div class="flex gap-2 flex-wrap">
              <button
                onclick="SupplierOrders.viewDetail(${order.id})"
                class="btn-secondary">
                <i class="fas fa-eye"></i> Détails
              </button>

              ${status === 'pending' ? `
                <button
                  onclick="SupplierOrders.updateStatus(${order.id}, 'shipped')"
                  class="btn-primary">
                  <i class="fas fa-truck"></i> Expédier
                </button>
              ` : ''}

              ${status === 'shipped' ? `
                <button
                  onclick="SupplierOrders.updateStatus(${order.id}, 'delivered')"
                  class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-white">
                  <i class="fas fa-check"></i> Livrer
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ============================================
  // FILTER
  // ============================================
  filter: (status) => {
    SupplierOrders.state.currentFilter = status;

    document.querySelectorAll('.order-tab').forEach(tab => {
      tab.classList.toggle(
        'active',
        tab.dataset.filter === status
      );
    });

    SupplierOrders.loadOrders();
  },

  // ============================================
  // COUNTS
  // ============================================
  updateCounts: (counts) => {
    ['all', 'pending', 'shipped', 'delivered'].forEach(k => {
      const el = document.getElementById(`count-${k}`);
      if (el) el.textContent = counts[k] || 0;
    });
  },

  // ============================================
  // DETAIL
  // ============================================
  viewDetail: async (orderId) => {
    try {
      DashboardApp.showLoading(true);
      const res = await BrandiaAPI.Supplier.getOrderById(orderId);
      SupplierOrders.state.selectedOrder = res.data;
      DashboardApp.openModal('order-modal');
    } catch (e) {
      DashboardApp.showToast('Erreur détail commande', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  // ============================================
  // UPDATE STATUS
  // ============================================
  updateStatus: async (orderId, status) => {
    try {
      await BrandiaAPI.Supplier.updateOrderStatus(orderId, status);
      DashboardApp.showToast(
        `Commande ${SupplierOrders.translateStatus(status)}`,
        'success'
      );
      DashboardApp.closeModal('order-modal');
      SupplierOrders.loadOrders();
    } catch (e) {
      DashboardApp.showToast('Erreur mise à jour', 'error');
    }
  },

  // ============================================
  // UTILS
  // ============================================
  translateStatus: (status) => ({
    pending: 'En attente',
    shipped: 'Expédiée',
    delivered: 'Livrée'
  }[status] || status)
};

// ============================================
// GLOBAL
// ============================================
window.filterOrders = status => SupplierOrders.filter(status);

console.log('[SupplierOrders] Loaded v2.4');
