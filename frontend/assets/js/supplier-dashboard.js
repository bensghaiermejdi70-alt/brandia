// ============================================
// SUPPLIER DASHBOARD - Logic Principal
// ============================================

const DashboardApp = {
  state: {
    products: [],
    orders: [],
    campaigns: [],
    categories: [],
    currentProductPage: 1,
    currentOrderFilter: 'all',
    charts: {}
  },

  init: async () => {
    // Vérifier auth
    if (!BrandiaAPI.Supplier.init()) return;
    
    const user = BrandiaAPI.Auth.getUser();
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
      userNameEl.textContent = user?.first_name || user?.company_name || user?.email || 'Fournisseur';
    }
    
    // Charger section par défaut
    DashboardApp.navigate('overview');
  },

  navigate: (section) => {
    // Update UI sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(section);
    if (target) target.classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.remove('active');
      l.classList.add('text-slate-400');
      l.classList.remove('text-white');
    });
    
    const activeNav = document.getElementById('nav-' + section);
    if (activeNav) {
      activeNav.classList.add('active');
      activeNav.classList.remove('text-slate-400');
    }

    DashboardApp.updateHeader(section);
    DashboardApp.loadSectionData(section);
    window.scrollTo(0, 0);
  },

  updateHeader: (section) => {
    const titles = {
      overview: { title: 'Tableau de bord', subtitle: 'Vue d\'ensemble de votre activité' },
      products: { title: 'Mes produits', subtitle: 'Gérez votre catalogue produits' },
      promotions: { title: 'Promotions', subtitle: 'Créez des offres pour booster vos ventes' },
      advertising: { title: 'Publicité Contextuelle', subtitle: 'Promouvez vos produits au bon moment' },
      orders: { title: 'Commandes', subtitle: 'Suivez et gérez vos commandes clients' },
      payments: { title: 'Paiements & Revenus', subtitle: 'Suivez vos revenus et demandez des virements' },
      analytics: { title: 'Statistiques', subtitle: 'Analysez votre performance commerciale' },
      profile: { title: 'Profil de la marque', subtitle: 'Gérez votre identité publique' },
      support: { title: 'Support & Aide', subtitle: 'Nous sommes là pour vous aider' },
      settings: { title: 'Paramètres', subtitle: 'Gérez vos préférences et sécurité' }
    };

    const t = titles[section];
    if (t) {
      const pageTitle = document.getElementById('page-title');
      const pageSubtitle = document.getElementById('page-subtitle');
      if (pageTitle) pageTitle.textContent = t.title;
      if (pageSubtitle) pageSubtitle.textContent = t.subtitle;
    }
  },

  loadSectionData: async (section) => {
    DashboardApp.showLoading(true);
    try {
      switch(section) {
        case 'overview':
          await DashboardApp.loadOverview();
          break;
        case 'products':
          if (window.SupplierProducts) await SupplierProducts.init();
          break;
        case 'orders':
          if (window.SupplierOrders) await SupplierOrders.init();
          break;
        case 'payments':
          if (window.SupplierPayments) await SupplierPayments.init();
          break;
        case 'promotions':
          if (window.SupplierPromotions) await SupplierPromotions.init();
          break;
        case 'advertising':
          if (window.SupplierCampaigns) await SupplierCampaigns.init();
          break;
        case 'analytics':
          await DashboardApp.loadAnalytics();
          break;
        case 'profile':
          await DashboardApp.loadProfile();
          break;
      }
    } catch (error) {
      console.error(`Erreur chargement section ${section}:`, error);
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  // ============================================
  // OVERVIEW
  // ============================================
  loadOverview: async () => {
    try {
      console.log('[Dashboard] Chargement overview...');
      const response = await BrandiaAPI.Supplier.getStats();
      
      if (!response.success) {
        throw new Error(response.message || 'Erreur données');
      }
      
      const data = response.data || {};
      const stats = data.stats || {};

      // KPIs avec animation
      DashboardApp.animateValue('kpi-revenue', stats.totalSales || 0, '€');
      DashboardApp.animateValue('kpi-orders', stats.totalOrders || 0, '');
      DashboardApp.animateValue('kpi-products', stats.productsCount || 0, '');
      
      const totalProductsEl = document.getElementById('kpi-total-products');
      if (totalProductsEl) totalProductsEl.textContent = stats.totalProducts || 0;
      
      DashboardApp.animateValue('kpi-balance', stats.balance || 0, '€');

      // Trends
      const revenueTrendEl = document.getElementById('kpi-revenue-trend');
      const ordersTrendEl = document.getElementById('kpi-orders-trend');
      if (revenueTrendEl) {
        revenueTrendEl.innerHTML = '<i class="fas fa-arrow-up mr-1 text-emerald-400"></i><span class="text-emerald-400">+12% ce mois</span>';
      }
      if (ordersTrendEl) {
        ordersTrendEl.innerHTML = '<i class="fas fa-arrow-up mr-1 text-blue-400"></i><span class="text-blue-400">+5% ce mois</span>';
      }

      // Chart
      DashboardApp.renderSalesChart(data.salesChart || []);

      // Recent orders
      const orders = data.recentOrders || [];
      const ordersContainer = document.getElementById('recent-orders-list');
      
      if (ordersContainer) {
        if (orders.length === 0) {
          ordersContainer.innerHTML = `
            <tr>
              <td colspan="5" class="py-8 text-center text-slate-500">
                <i class="fas fa-inbox text-3xl mb-3 opacity-50"></i>
                <p>Aucune commande récente</p>
              </td>
            </tr>
          `;
        } else {
          ordersContainer.innerHTML = orders.map(o => `
            <tr class="table-row border-b border-slate-800 last:border-0 cursor-pointer hover:bg-slate-800/30 transition-colors" onclick="DashboardApp.showOrderDetail(${o.id})">
              <td class="py-4 px-6 font-mono text-indigo-400">#${o.order_number || o.id}</td>
              <td class="py-4 px-6 text-slate-400">${DashboardApp.formatDate(o.created_at)}</td>
              <td class="py-4 px-6">${o.customer_name || 'Client'}</td>
              <td class="py-4 px-6 text-right font-medium">${DashboardApp.formatPrice(o.total_amount)}</td>
              <td class="py-4 px-6 text-center">
                <span class="badge badge-${o.status || 'pending'} capitalize">${DashboardApp.translateStatus(o.status)}</span>
              </td>
            </tr>
          `).join('');
        }
      }

      // Top products (mock pour l'instant)
      const topProductsList = document.getElementById('top-products-list');
      if (topProductsList) {
        topProductsList.innerHTML = `
          <div class="space-y-4">
            <div class="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
              <div class="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">1</div>
              <div class="flex-1">
                <p class="text-sm font-medium">Produit phare</p>
                <p class="text-xs text-slate-400">124 ventes</p>
              </div>
              <span class="text-emerald-400 text-sm">+24%</span>
            </div>
            <div class="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
              <div class="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">2</div>
              <div class="flex-1">
                <p class="text-sm font-medium">Second produit</p>
                <p class="text-xs text-slate-400">98 ventes</p>
              </div>
              <span class="text-emerald-400 text-sm">+12%</span>
            </div>
          </div>
        `;
      }

    } catch (error) {
      console.error('Erreur overview:', error);
      // Afficher données vides plutôt que toast d'erreur pour ne pas spammer
      const kpiRevenue = document.getElementById('kpi-revenue');
      const kpiOrders = document.getElementById('kpi-orders');
      const recentOrders = document.getElementById('recent-orders-list');
      
      if (kpiRevenue) kpiRevenue.textContent = '0,00 €';
      if (kpiOrders) kpiOrders.textContent = '0';
      if (recentOrders) {
        recentOrders.innerHTML = `
          <tr><td colspan="5" class="py-8 text-center text-slate-500">Aucune donnée disponible</td></tr>
        `;
      }
    }
  },

  renderSalesChart: (data = []) => {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    // Données par défaut si vide
    const chartData = data.length > 0 ? data : [
      { date: 'Lun', amount: 120 },
      { date: 'Mar', amount: 190 },
      { date: 'Mer', amount: 300 },
      { date: 'Jeu', amount: 250 },
      { date: 'Ven', amount: 200 },
      { date: 'Sam', amount: 150 },
      { date: 'Dim', amount: 180 }
    ];

    if (DashboardApp.state.charts.sales) {
      DashboardApp.state.charts.sales.destroy();
    }

    try {
      DashboardApp.state.charts.sales = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.map(d => d.date),
          datasets: [{
            label: 'Ventes (€)',
            data: chartData.map(d => d.amount),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              grid: { color: 'rgba(148, 163, 184, 0.1)' },
              ticks: { color: '#94a3b8' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    } catch (e) {
      console.error('[Chart] Error:', e);
    }
  },

  // ============================================
  // UTILITAIRES
  // ============================================
  animateValue: (id, value, suffix = '') => {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (suffix === '€') {
      el.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
    } else {
      el.textContent = value.toLocaleString('fr-FR') + (suffix ? ' ' + suffix : '');
    }
  },

  formatPrice: (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  },

  formatDate: (dateString) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

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

  showLoading: (show) => {
    const el = document.getElementById('loading-overlay');
    if (!el) return;
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
  },

  openModal: (id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal: (id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  },

  showToast: (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg transform translate-x-full transition-all duration-300 ${
      type === 'success' ? 'bg-emerald-500' :
      type === 'error' ? 'bg-red-500' :
      'bg-indigo-500'
    } text-white`;
    
    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-full'), 100);
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  logout: () => {
    BrandiaAPI.Auth.logout();
  },

  showNotifications: () => {
    DashboardApp.showToast('Pas de nouvelles notifications', 'info');
  },

  quickAction: () => {
    DashboardApp.openModal('product-modal');
  },

  updateSalesChart: () => {
    DashboardApp.loadOverview();
  },

  // ============================================
  // PLACEHOLDERS (à implémenter avec les modules séparés)
  // ============================================
  loadAnalytics: async () => {
    console.log('[Dashboard] Analytics not implemented yet');
  },

  loadProfile: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getProfile?.();
      const profile = response?.data || {};
      
      const brandName = document.getElementById('brand-name');
      const brandCategory = document.getElementById('brand-category');
      
      if (brandName) brandName.textContent = profile.company_name || profile.name || 'Votre Marque';
      if (brandCategory) brandCategory.textContent = profile.category || 'Catégorie non définie';
    } catch (error) {
      console.error('Erreur profil:', error);
    }
  },

  showOrderDetail: (orderId) => {
    DashboardApp.showToast(`Détail commande ${orderId} (à implémenter)`, 'info');
  },

  filterOrders: (status) => {
    DashboardApp.state.currentOrderFilter = status;
    
    // Update UI tabs
    document.querySelectorAll('.order-tab').forEach(tab => {
      tab.classList.remove('active', 'bg-indigo-600', 'text-white');
      tab.classList.add('text-slate-400');
      if (tab.dataset.filter === status) {
        tab.classList.add('active', 'bg-indigo-600', 'text-white');
        tab.classList.remove('text-slate-400');
      }
    });

    if (window.SupplierOrders) {
      SupplierOrders.renderOrders?.();
    }
  }
};

// ============================================
// INITIALISATION UNIQUE
// ============================================
if (!window.DashboardAppInitialized) {
  window.DashboardAppInitialized = true;
  
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dashboard] Initializing...');
    if (typeof BrandiaAPI !== 'undefined') {
      DashboardApp.init();
    } else {
      console.error('[Dashboard] BrandiaAPI not loaded');
    }
  });
}

// Exposer globalement
window.DashboardApp = DashboardApp;

// Fonctions globales pour onclick inline
window.navigate = (section) => DashboardApp.navigate(section);
window.closeModal = (id) => DashboardApp.closeModal(id);
window.logout = () => DashboardApp.logout();
window.showNotifications = () => DashboardApp.showNotifications();
window.quickAction = () => DashboardApp.quickAction();
window.updateSalesChart = () => DashboardApp.updateSalesChart();
window.filterOrders = (status) => DashboardApp.filterOrders(status);
window.showOrderDetail = (id) => DashboardApp.showOrderDetail(id);

console.log('[Dashboard] Module loaded');