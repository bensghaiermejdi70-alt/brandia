// ============================================
// SUPPLIER DASHBOARD - Logic
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
    document.getElementById('user-name').textContent = user?.first_name || user?.company_name || user?.email || 'Fournisseur';
    
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
      document.getElementById('page-title').textContent = t.title;
      document.getElementById('page-subtitle').textContent = t.subtitle;
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
          await DashboardApp.loadCategories();
          await DashboardApp.loadProducts();
          break;
        case 'orders':
          await DashboardApp.loadOrders();
          break;
        case 'payments':
          await DashboardApp.loadPayments();
          break;
        case 'analytics':
          await DashboardApp.loadAnalytics();
          break;
        case 'profile':
          await DashboardApp.loadProfile();
          break;
        case 'promotions':
          await DashboardApp.loadPromotions();
          break;
        case 'advertising':
          await DashboardApp.loadCampaigns();
          await DashboardApp.loadCampaignStats();
          break;
      }
    } catch (error) {
      console.error(`Erreur chargement section ${section}:`, error);
      DashboardApp.showToast('Erreur de chargement des données', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  // ============================================
  // OVERVIEW
  // ============================================
  loadOverview: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getStats();
      const data = response.data || {};
      const stats = data.stats || {};

      // KPIs
      document.getElementById('kpi-revenue').innerHTML = DashboardApp.formatPrice(stats.totalSales || 0);
      document.getElementById('kpi-orders').innerHTML = stats.totalOrders || 0;
      document.getElementById('kpi-products').innerHTML = stats.productsCount || 0;
      document.getElementById('kpi-total-products').textContent = stats.productsCount || 0;
      document.getElementById('kpi-balance').innerHTML = DashboardApp.formatPrice(stats.balance || 0);

      // Trends (mock si pas de données)
      document.getElementById('kpi-revenue-trend').innerHTML = '<i class="fas fa-arrow-up mr-1"></i>+0% ce mois';
      document.getElementById('kpi-orders-trend').innerHTML = '<i class="fas fa-arrow-up mr-1"></i>+0% ce mois';

      // Chart
      DashboardApp.renderSalesChart(data.salesChart || []);

      // Recent orders
      const orders = data.recentOrders || [];
      const ordersContainer = document.getElementById('recent-orders-list');
      
      if (orders.length === 0) {
        ordersContainer.innerHTML = `
          <tr>
            <td colspan="5" class="py-8 text-center text-slate-500">
              Aucune commande récente
            </td>
          </tr>
        `;
      } else {
        ordersContainer.innerHTML = orders.map(o => `
          <tr class="table-row border-b border-slate-800 last:border-0 cursor-pointer" onclick="DashboardApp.showOrderDetail(${o.id})">
            <td class="py-4 px-6 font-mono text-indigo-400">#${o.order_number || o.id}</td>
            <td class="py-4 px-6 text-slate-400">${DashboardApp.formatDate(o.created_at)}</td>
            <td class="py-4 px-6">${o.customer_name || 'Client'}</td>
            <td class="py-4 px-6 text-right font-medium">${DashboardApp.formatPrice(o.total_amount)}</td>
            <td class="py-4 px-6 text-center">
              <span class="badge badge-${o.status} capitalize">${DashboardApp.translateStatus(o.status)}</span>
            </td>
          </tr>
        `).join('');
      }

      // Top products (mock)
      document.getElementById('top-products-list').innerHTML = `
        <div class="text-center py-8 text-slate-500">
          <p>Données en cours de collecte...</p>
        </div>
      `;

    } catch (error) {
      console.error('Erreur overview:', error);
      DashboardApp.showToast('Impossible de charger le tableau de bord', 'error');
    }
  },

  renderSalesChart: (data) => {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    if (DashboardApp.state.charts.sales) {
      DashboardApp.state.charts.sales.destroy();
    }

    const labels = data.length ? data.map(d => d.date) : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const values = data.length ? data.map(d => d.amount) : [0, 0, 0, 0, 0, 0, 0];

    DashboardApp.state.charts.sales = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventes (€)',
          data: values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 2,
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
  },

  // ============================================
  // PRODUCTS
  // ============================================
  loadCategories: async () => {
    try {
      const response = await BrandiaAPI.Categories.getAll();
      DashboardApp.state.categories = response.data || [];
      
      const select = document.getElementById('product-category-filter');
      if (select) {
        select.innerHTML = '<option value="">Toutes les catégories</option>' +
          DashboardApp.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    } catch (error) {
      console.error('Erreur catégories:', error);
    }
  },

  loadProducts: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getProducts();
      DashboardApp.state.products = response.data?.products || response.data || [];
      
      DashboardApp.renderProducts();
      DashboardApp.updateProductCount();
    } catch (error) {
      console.error('Erreur produits:', error);
      document.getElementById('products-grid').innerHTML = 
        '<div class="col-span-full text-center text-red-400">Erreur de chargement des produits</div>';
    }
  },

  renderProducts: () => {
    const grid = document.getElementById('products-grid');
    const filterText = document.getElementById('product-search')?.value?.toLowerCase() || '';
    const filterStatus = document.getElementById('product-status-filter')?.value || '';
    const filterCategory = document.getElementById('product-category-filter')?.value || '';

    let filtered = DashboardApp.state.products.filter(p => {
      const matchText = !filterText || p.name?.toLowerCase().includes(filterText);
      const matchStatus = !filterStatus || p.status === filterStatus || (p.is_active && filterStatus === 'published');
      const matchCat = !filterCategory || p.category_id == filterCategory;
      return matchText && matchStatus && matchCat;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-500">
          <i class="fas fa-box-open text-4xl mb-4"></i>
          <p>Aucun produit trouvé</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => `
      <div class="card rounded-xl overflow-hidden group">
        <div class="relative h-48 bg-slate-800 overflow-hidden">
          <img src="${p.main_image_url || p.image || 'https://via.placeholder.com/400'}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${p.name}">
          <div class="absolute top-2 right-2">
            <span class="badge badge-${p.is_active ? 'published' : 'draft'} text-xs">${p.is_active ? 'Actif' : 'Brouillon'}</span>
          </div>
        </div>
        <div class="p-4">
          <h4 class="font-semibold text-white truncate mb-1">${p.name}</h4>
          <p class="text-indigo-400 font-bold mb-3">${DashboardApp.formatPrice(p.price)}</p>
          <div class="flex gap-2">
            <button onclick="DashboardApp.editProduct(${p.id})" class="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-xs font-medium transition-colors">
              Modifier
            </button>
            <button onclick="DashboardApp.deleteProduct(${p.id})" class="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  filterProducts: () => {
    DashboardApp.renderProducts();
  },

  updateProductCount: () => {
    const count = DashboardApp.state.products.length;
    document.getElementById('product-count').textContent = count;
    document.getElementById('product-count').classList.toggle('hidden', count === 0);
  },

  openProductModal: (productId = null) => {
    DashboardApp.showToast(productId ? 'Modification produit (à implémenter)' : 'Ajout produit (à implémenter)', 'info');
  },

  importProducts: () => {
    DashboardApp.showToast('Import en cours de développement', 'info');
  },

  editProduct: (id) => {
    DashboardApp.openProductModal(id);
  },

  deleteProduct: async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await BrandiaAPI.Supplier.deleteProduct(id);
      DashboardApp.showToast('Produit supprimé', 'success');
      DashboardApp.loadProducts();
    } catch (error) {
      DashboardApp.showToast('Erreur suppression', 'error');
    }
  },

  // ============================================
  // ORDERS
  // ============================================
  loadOrders: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getOrders();
      DashboardApp.state.orders = response.data?.orders || response.data || [];
      
      DashboardApp.renderOrders();
      DashboardApp.updateOrderCounts();
    } catch (error) {
      console.error('Erreur commandes:', error);
    }
  },

  renderOrders: () => {
    const container = document.getElementById('orders-list');
    const filter = DashboardApp.state.currentOrderFilter;

    let filtered = DashboardApp.state.orders;
    if (filter !== 'all') {
      filtered = filtered.filter(o => o.status === filter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <i class="fas fa-shopping-bag text-4xl mb-4 opacity-50"></i>
          <p>Aucune commande ${filter !== 'all' ? 'avec ce statut' : ''}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(o => `
      <div class="card rounded-xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span class="font-mono text-indigo-400">#${o.order_number || o.id}</span>
            <span class="badge badge-${o.status} text-xs capitalize">${DashboardApp.translateStatus(o.status)}</span>
          </div>
          <p class="text-sm text-slate-400 mb-1">${DashboardApp.formatDate(o.created_at)}</p>
          <p class="text-white font-medium">${o.customer_name || 'Client'}</p>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold text-white mb-2">${DashboardApp.formatPrice(o.total_amount)}</p>
          <button onclick="DashboardApp.showOrderDetail(${o.id})" class="text-indigo-400 hover:text-indigo-300 text-sm">
            Voir détails <i class="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
      </div>
    `).join('');
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

    DashboardApp.renderOrders();
  },

  updateOrderCounts: () => {
    const counts = {
      all: DashboardApp.state.orders.length,
      pending: DashboardApp.state.orders.filter(o => o.status === 'pending').length,
      paid: DashboardApp.state.orders.filter(o => o.status === 'paid').length,
      shipped: DashboardApp.state.orders.filter(o => o.status === 'shipped').length,
      delivered: DashboardApp.state.orders.filter(o => o.status === 'delivered').length
    };

    Object.keys(counts).forEach(key => {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = counts[key];
    });

    // Badge sidebar
    const pending = counts.pending;
    const badge = document.getElementById('order-badge');
    if (badge) {
      badge.textContent = pending;
      badge.classList.toggle('hidden', pending === 0);
    }
  },

  showOrderDetail: (orderId) => {
    const order = DashboardApp.state.orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('order-detail-number').textContent = '#' + (order.order_number || order.id);
    
    const content = `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="bg-slate-800 p-3 rounded-lg">
            <p class="text-slate-400 mb-1">Date</p>
            <p class="text-white">${DashboardApp.formatDate(order.created_at)}</p>
          </div>
          <div class="bg-slate-800 p-3 rounded-lg">
            <p class="text-slate-400 mb-1">Statut</p>
            <span class="badge badge-${order.status}">${DashboardApp.translateStatus(order.status)}</span>
          </div>
        </div>
        <div class="bg-slate-800 p-4 rounded-lg">
          <p class="text-slate-400 text-sm mb-2">Articles</p>
          ${(order.items || []).map(item => `
            <div class="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
              <span class="text-white">${item.name} x${item.quantity}</span>
              <span class="text-indigo-400">${DashboardApp.formatPrice(item.price * item.quantity)}</span>
            </div>
          `).join('')}
          <div class="flex justify-between items-center pt-3 font-bold text-lg">
            <span class="text-white">Total</span>
            <span class="text-emerald-400">${DashboardApp.formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('order-detail-content').innerHTML = content;
    
    // Actions selon statut
    const actions = document.getElementById('order-actions');
    if (order.status === 'paid') {
      actions.innerHTML = `
        <button onclick="DashboardApp.updateOrderStatus(${order.id}, 'shipped')" class="btn-primary px-6 py-2.5 rounded-lg">
          <i class="fas fa-truck mr-2"></i>Marquer comme expédiée
        </button>
      `;
    } else {
      actions.innerHTML = '';
    }
    
    DashboardApp.openModal('order-modal');
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      await BrandiaAPI.Supplier.updateOrderStatus(orderId, status);
      DashboardApp.showToast('Statut mis à jour', 'success');
      DashboardApp.closeModal('order-modal');
      DashboardApp.loadOrders();
    } catch (error) {
      DashboardApp.showToast('Erreur mise à jour', 'error');
    }
  },

  // ============================================
  // PAYMENTS
  // ============================================
  loadPayments: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getPayments();
      const data = response.data || {};
      
      document.getElementById('balance-available').textContent = DashboardApp.formatPrice(data.available || 0);
      document.getElementById('balance-pending').textContent = DashboardApp.formatPrice(data.pending || 0);
      document.getElementById('balance-total').textContent = DashboardApp.formatPrice(data.total || 0);

      // Transactions
      const transactions = data.transactions || [];
      const container = document.getElementById('transactions-list');
      
      if (transactions.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="4" class="py-8 text-center text-slate-500">Aucune transaction</td>
          </tr>
        `;
      } else {
        container.innerHTML = transactions.map(t => `
          <tr class="border-b border-slate-800 last:border-0">
            <td class="py-4 px-6 text-slate-400">${DashboardApp.formatDate(t.created_at)}</td>
            <td class="py-4 px-6">${t.description}</td>
            <td class="py-4 px-6 text-right ${t.amount > 0 ? 'text-emerald-400' : 'text-white'}">
              ${t.amount > 0 ? '+' : ''}${DashboardApp.formatPrice(t.amount)}
            </td>
            <td class="py-4 px-6 text-center">
              <span class="badge badge-${t.status} text-xs capitalize">${t.status}</span>
            </td>
          </tr>
        `).join('');
      }
    } catch (error) {
      console.error('Erreur paiements:', error);
    }
  },

  requestPayout: async () => {
    const amount = prompt('Montant à retirer (€):');
    if (!amount || isNaN(amount)) return;
    
    try {
      await BrandiaAPI.Supplier.requestPayout(parseFloat(amount));
      DashboardApp.showToast('Demande de virement envoyée', 'success');
      DashboardApp.loadPayments();
    } catch (error) {
      DashboardApp.showToast('Erreur lors de la demande', 'error');
    }
  },

  exportTransactions: () => {
    DashboardApp.showToast('Export en cours...', 'info');
  },

  // ============================================
  // ANALYTICS
  // ============================================
  loadAnalytics: async () => {
    // Mock pour l'instant
    DashboardApp.renderAnalyticsChart();
  },

  renderAnalyticsChart: () => {
    const ctx = document.getElementById('analyticsSalesChart');
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [{
          label: 'Ventes',
          data: [65, 59, 80, 81, 56, 55, 40],
          backgroundColor: '#6366f1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
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
  },

  updateAnalyticsPeriod: (period) => {
    document.querySelectorAll('.analytics-period').forEach(btn => {
      btn.classList.remove('bg-indigo-600', 'text-white');
      btn.classList.add('bg-slate-800', 'text-slate-300');
    });
    event.target.classList.remove('bg-slate-800', 'text-slate-300');
    event.target.classList.add('bg-indigo-600', 'text-white');
    
    DashboardApp.loadAnalytics();
  },

  // ============================================
  // PROFILE
  // ============================================
  loadProfile: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getProfile();
      const profile = response.data || {};
      
      document.getElementById('brand-name').textContent = profile.company_name || profile.name || 'Votre Marque';
      document.getElementById('brand-category').textContent = profile.category || 'Catégorie non définie';
    } catch (error) {
      console.error('Erreur profil:', error);
    }
  },

  editBrand: () => {
    DashboardApp.showToast('Édition du profil (à implémenter)', 'info');
  },

  viewPublicProfile: () => {
    window.open('../brand.html', '_blank');
  },

  handleLogoUpload: (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('brand-logo-img').src = e.target.result;
      document.getElementById('brand-logo-img').classList.remove('hidden');
      document.getElementById('brand-logo-icon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  },

  // ============================================
  // PROMOTIONS
  // ============================================
  loadPromotions: async () => {
    const container = document.getElementById('active-promotions');
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500">
        <i class="fas fa-percent text-4xl mb-4 opacity-50"></i>
        <p>Système de promotions en développement</p>
      </div>
    `;
  },

  openPromotionModal: () => {
    DashboardApp.showToast('Création de promotion (à implémenter)', 'info');
  },

  // ============================================
  // ADVERTISING
  // ============================================
  loadCampaigns: async () => {
    try {
      const response = await BrandiaAPI.Supplier.getCampaigns();
      const campaigns = response.data || [];
      DashboardApp.state.campaigns = campaigns;
      
      const container = document.getElementById('campaigns-list');
      
      if (campaigns.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center text-slate-500">
            <i class="fas fa-bullhorn text-4xl mb-4 opacity-50"></i>
            <p class="text-lg mb-2">Aucune campagne active</p>
            <button onclick="DashboardApp.openCampaignModal()" class="btn-primary px-6 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-pink-500 to-rose-500 mt-4">
              <i class="fas fa-plus mr-2"></i>Créer une campagne
            </button>
          </div>
        `;
        return;
      }
      
      container.innerHTML = campaigns.map(c => `
        <div class="p-6 flex items-center gap-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0">
          <div class="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
            ${c.media_type === 'video' 
              ? `<div class="absolute inset-0 flex items-center justify-center bg-black/50"><i class="fas fa-video text-white text-2xl"></i></div>`
              : `<img src="${c.media_url}" class="w-full h-full object-cover">`
            }
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-semibold text-white">${c.name}</h4>
              <span class="badge badge-active text-xs">Active</span>
            </div>
            <p class="text-sm text-slate-400 mb-2">${c.headline}</p>
            <div class="flex items-center gap-4 text-xs text-slate-500">
              <span><i class="fas fa-eye mr-1"></i>${c.views_count || 0} vues</span>
              <span><i class="fas fa-mouse-pointer mr-1"></i>${c.clicks_count || 0} clics</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="DashboardApp.openCampaignModal(${c.id})" class="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Erreur campagnes:', error);
    }
  },

  loadCampaignStats: async () => {
    // Mock data
    document.getElementById('ad-views').textContent = '0';
    document.getElementById('ad-clicks').textContent = '0';
    document.getElementById('ad-ctr').textContent = '0%';
    document.getElementById('ad-conversions').textContent = '0';
  },

  openCampaignModal: (id = null) => {
    DashboardApp.showToast(id ? 'Édition campagne' : 'Nouvelle campagne (à finaliser)', 'info');
  },

  // ============================================
  // UTILITIES
  // ============================================
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
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
  },

  openModal: (id) => {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal: (id) => {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
  },

  showToast: (message, type = 'info') => {
    const container = document.getElementById('toast-container');
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
    DashboardApp.openProductModal();
  },

  updateSalesChart: () => {
    DashboardApp.loadOverview();
  }
};

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  DashboardApp.init();
});

// Exposer fonctions globales pour les onclick inline
window.navigate = (section) => DashboardApp.navigate(section);
window.loadSectionData = (section) => DashboardApp.loadSectionData(section);
window.filterProducts = () => DashboardApp.filterProducts();
window.changeProductPage = (delta) => {
  DashboardApp.state.currentProductPage += delta;
  DashboardApp.renderProducts();
};
window.openProductModal = (id) => DashboardApp.openProductModal(id);
window.importProducts = () => DashboardApp.importProducts();
window.editProduct = (id) => DashboardApp.editProduct(id);
window.deleteProduct = (id) => DashboardApp.deleteProduct(id);
window.filterOrders = (status) => DashboardApp.filterOrders(status);
window.showOrderDetail = (id) => DashboardApp.showOrderDetail(id);
window.updateOrderStatus = (id, status) => DashboardApp.updateOrderStatus(id, status);
window.requestPayout = () => DashboardApp.requestPayout();
window.exportTransactions = () => DashboardApp.exportTransactions();
window.loadAnalytics = () => DashboardApp.loadAnalytics();
window.updateAnalyticsPeriod = (p) => DashboardApp.updateAnalyticsPeriod(p);
window.editBrand = () => DashboardApp.editBrand();
window.viewPublicProfile = () => DashboardApp.viewPublicProfile();
window.handleLogoUpload = (e) => DashboardApp.handleLogoUpload(e);
window.openPromotionModal = () => DashboardApp.openPromotionModal();
window.openCampaignModal = (id) => DashboardApp.openCampaignModal(id);
window.closeModal = (id) => DashboardApp.closeModal(id);
window.logout = () => DashboardApp.logout();window.showNotifications = () => DashboardApp.showNotifications();
window.quickAction = () => DashboardApp.quickAction();
window.updateSalesChart = () => DashboardApp.updateSalesChart();

// ============================================
// CAMPAGNES PUBLICITAIRES (Complément)
// ============================================

window.toggleCampaignStatus = async (campaignId, newStatus) => {
  try {
    // Simulation - à remplacer par vrai appel API quand prêt
    DashboardApp.showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
    setTimeout(() => DashboardApp.loadCampaigns(), 500);
  } catch (error) {
    DashboardApp.showToast('Erreur lors de la mise à jour', 'error');
  }
};

window.deleteCampaign = async (campaignId) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
  
  try {
    DashboardApp.showToast('Campagne supprimée', 'success');
    setTimeout(() => DashboardApp.loadCampaigns(), 500);
  } catch (error) {
    DashboardApp.showToast('Erreur lors de la suppression', 'error');
  }
};

window.saveCampaign = async () => {
  const form = document.getElementById('campaign-form');
  
  // Validation basique
  const name = form.querySelector('[name="name"]').value;
  if (!name) {
    DashboardApp.showToast('Veuillez donner un nom à la campagne', 'error');
    return;
  }
  
  DashboardApp.showLoading(true);
  try {
    // Simulation de sauvegarde
    await new Promise(r => setTimeout(r, 1000));
    DashboardApp.showToast('Campagne créée avec succès !', 'success');
    DashboardApp.closeModal('campaign-modal');
    DashboardApp.loadCampaigns();
  } catch (error) {
    DashboardApp.showToast('Erreur lors de la création', 'error');
  } finally {
    DashboardApp.showLoading(false);
  }
};

window.toggleMediaType = (type) => {
  const input = document.getElementById('campaign-media');
  if (input) {
    input.accept = type === 'video' ? 'video/mp4' : 'image/*';
  }
};

window.handleCampaignMedia = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    DashboardApp.showToast('Le fichier ne doit pas dépasser 5MB', 'error');
    return;
  }
  
  const url = URL.createObjectURL(file);
  const preview = document.getElementById('campaign-media-preview');
  const placeholder = document.getElementById('campaign-media-placeholder');
  
  if (preview) {
    preview.src = url;
    preview.classList.remove('hidden');
  }
  if (placeholder) {
    placeholder.classList.add('hidden');
  }
  
  // Mettre à jour l'aperçu
  window.updateAdPreview();
};

window.updateAdPreview = () => {
  const headline = document.querySelector('[name="headline"]')?.value || 'Votre titre';
  const desc = document.querySelector('[name="description"]')?.value || 'Description';
  const cta = document.querySelector('[name="cta_text"]')?.value || 'Voir l\'offre';
  
  const previewHeadline = document.getElementById('ad-preview-headline');
  const previewDesc = document.getElementById('ad-preview-desc');
  const previewCta = document.getElementById('ad-preview-cta');
  
  if (previewHeadline) previewHeadline.textContent = headline;
  if (previewDesc) previewDesc.textContent = desc;
  if (previewCta) previewCta.textContent = cta;
};

window.handleCtaType = (type) => {
  const productSelect = document.getElementById('cta-product-select');
  const externalUrl = document.getElementById('cta-external-url');
  
  if (type === 'external') {
    if (productSelect) productSelect.classList.add('hidden');
    if (externalUrl) externalUrl.classList.remove('hidden');
  } else {
    if (productSelect) productSelect.classList.remove('hidden');
    if (externalUrl) externalUrl.classList.add('hidden');
  }
};

window.loadTargetProducts = async () => {
  // Charger les produits pour le ciblage
  try {
    const response = await BrandiaAPI.Supplier.getProducts();
    const products = response.data?.products || response.data || [];
    
    const container = document.getElementById('target-products-list');
    const select = document.getElementById('cta-product-select');
    
    if (container) {
      if (products.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500">Aucun produit disponible</div>';
      } else {
        container.innerHTML = products.map(p => `
          <label class="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer">
            <input type="checkbox" name="target_products[]" value="${p.id}" class="w-4 h-4 rounded border-slate-600 text-indigo-600 bg-slate-700">
            <div class="w-10 h-10 bg-slate-700 rounded overflow-hidden">
              <img src="${p.main_image_url || '/assets/images/placeholder.png'}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white truncate">${p.name}</p>
              <p class="text-xs text-slate-400">${DashboardApp.formatPrice(p.price)}</p>
            </div>
          </label>
        `).join('');
      }
    }
    
    if (select) {
      select.innerHTML = '<option value="">Choisir un produit...</option>' + 
        products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  } catch (error) {
    console.error('Erreur chargement produits cibles:', error);
  }
};

// Initialiser les previews quand le modal s'ouvre
document.addEventListener('DOMContentLoaded', () => {
  // Listen pour les inputs du formulaire campagne pour update preview
  const form = document.getElementById('campaign-form');
  if (form) {
    form.addEventListener('input', window.updateAdPreview);
  }
});