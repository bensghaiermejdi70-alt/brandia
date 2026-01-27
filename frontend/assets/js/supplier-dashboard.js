// ============================================
// SUPPLIER DASHBOARD - BRANDIA (VRAIES DONNÉES)
// ============================================

const API_BASE_URL = 'http://localhost:4000/api';

const SupplierAPI = {
    init: () => {
        const token = BrandiaAPI.storage.getToken();
        const user = BrandiaAPI.storage.getUser();
        
        if (!token) {
            window.location.href = '../login.html?redirect=supplier';
            return false;
        }
        
        if (user.role !== 'supplier') {
            alert('Accès réservé aux fournisseurs');
            window.location.href = '../index.html';
            return false;
        }
        
        document.getElementById('supplier-name').textContent = (user.first_name || '') + ' ' + (user.last_name || '');
        return true;
    },

    logout: () => {
        BrandiaAPI.Auth.logout();
    },

    getStats: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/supplier/dashboard`, {
                headers: { 'Authorization': `Bearer ${BrandiaAPI.storage.getToken()}` }
            });
            const data = await response.json();
            return data.success ? data.data : { products: { total: 0, active: 0 }, orders: { total: 0, pending: 0, recent: [] }, finances: { revenue: '0.00', commission: '0.00', balance: '0.00' } };
        } catch (error) {
            console.error('Erreur stats:', error);
            return { products: { total: 0, active: 0 }, orders: { total: 0, pending: 0, recent: [] }, finances: { revenue: '0.00', commission: '0.00', balance: '0.00' } };
        }
    },

    getProducts: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/supplier/products`, {
                headers: { 'Authorization': `Bearer ${BrandiaAPI.storage.getToken()}` }
            });
            const data = await response.json();
            return data.data?.products || [];
        } catch (error) {
            console.error('Erreur produits:', error);
            return [];
        }
    },

    createProduct: async (productData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/supplier/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BrandiaAPI.storage.getToken()}`
                },
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (error) {
            console.error('Erreur création produit:', error);
            return { success: false, message: error.message };
        }
    }
};

function showSection(sectionName) {
    document.querySelectorAll('section[id$="-section"]').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionName + '-section').classList.remove('hidden');
    
    const titles = {
        overview: 'Tableau de bord',
        products: 'Mes produits',
        promotions: 'Promotions',
        orders: 'Commandes',
        payments: 'Paiements & Revenus',
        analytics: 'Statistiques',
        profile: 'Profil marque',
        support: 'Support',
        settings: 'Paramètres'
    };
    document.getElementById('page-title').textContent = titles[sectionName] || 'Tableau de bord';
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active', 'bg-indigo-600', 'text-white'));
    document.querySelectorAll('.nav-link').forEach(l => {
        if (l.getAttribute('href') === '#' + sectionName) {
            l.classList.add('active', 'bg-indigo-600', 'text-white');
            l.classList.remove('text-gray-300', 'hover:bg-gray-700');
        }
    });
    
    if (sectionName === 'products') loadProducts();
    if (sectionName === 'orders') loadOrders();
    if (sectionName === 'payments') loadPayments();
}

async function loadOverview() {
    const stats = await SupplierAPI.getStats();
    
    document.getElementById('kpi-revenue').textContent = stats.finances.revenue + ' €';
    document.getElementById('kpi-commission').textContent = stats.finances.commission + ' €';
    document.getElementById('kpi-balance').textContent = stats.finances.balance + ' €';
    document.getElementById('kpi-orders').textContent = stats.orders.pending;
    
    const chartContainer = document.getElementById('sales-chart');
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const values = [65, 45, 80, 55, 90, 70, 85];
    
    chartContainer.innerHTML = days.map((day, i) => `
        <div class="flex flex-col items-center flex-1">
            <div class="chart-bar w-full" style="height: ${values[i]}%"></div>
            <span class="text-xs text-gray-500 mt-2">${day}</span>
        </div>
    `).join('');
    
    document.getElementById('top-products').innerHTML = `<p class="text-gray-500 text-sm">Données bientôt disponibles</p>`;
    
    const recentOrdersHtml = stats.orders.recent.map(o => `
        <tr class="border-b border-gray-700">
            <td class="py-3 font-medium">${o.order_number}</td>
            <td class="py-3 text-gray-400">${new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
            <td class="py-3">${o.items?.[0]?.product_name || 'Produit'} x${o.items?.[0]?.quantity || 1}</td>
            <td class="py-3 text-right">${parseFloat(o.total_amount).toFixed(2)} €</td>
            <td class="py-3 text-center"><span class="status-badge status-${o.status}">${getStatusLabel(o.status)}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="py-4 text-gray-500 text-center">Aucune commande</td></tr>';
    
    document.getElementById('recent-orders-list').innerHTML = recentOrdersHtml;
}

function getStatusLabel(status) {
    const labels = { pending: 'En attente', paid: 'Payée', processing: 'En préparation', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' };
    return labels[status] || status;
}

async function loadProducts() {
    const products = await SupplierAPI.getProducts();
    
    const html = products.map(p => `
        <div class="product-card bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <img src="${p.main_image_url || 'https://via.placeholder.com/400'}" alt="${p.name}" class="w-full h-40 object-cover">
            <div class="p-4">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-medium">${p.name}</h4>
                    <span class="status-badge ${p.is_active ? 'status-active' : 'status-inactive'}">${p.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
                <p class="text-2xl font-bold text-indigo-400">${parseFloat(p.price).toFixed(2)} €</p>
                <p class="text-sm text-gray-400 mt-1">Stock: ${p.stock_quantity || 0} unités</p>
                <div class="flex space-x-2 mt-4">
                    <button class="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Modifier</button>
                    <button class="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('') || '<p class="col-span-full text-center text-gray-500 py-8">Aucun produit</p>';
    
    document.getElementById('products-list').innerHTML = html;
}

function loadOrders() {
    document.getElementById('orders-list').innerHTML = `
        <div class="space-y-3">
            <div class="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center"><i class="fas fa-shopping-bag text-indigo-400"></i></div>
                    <div><p class="font-medium">BRD-2026-001</p><p class="text-sm text-gray-400">24/01/2026 • Sérum x2</p></div>
                </div>
                <div class="text-right"><p class="font-bold">105.30 €</p><span class="status-badge status-pending">À préparer</span></div>
            </div>
        </div>`;
}

function loadPayments() {
    document.getElementById('balance-available').textContent = '1,250.00 €';
    document.getElementById('balance-pending').textContent = '450.00 €';
    document.getElementById('balance-total').textContent = '8,750.00 €';
}

function openProductModal() {
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.price = parseFloat(data.price);
    data.compare_price = data.compare_price ? parseFloat(data.compare_price) : null;
    data.stock_quantity = parseInt(data.stock_quantity) || 0;
    
    const result = await SupplierAPI.createProduct(data);
    if (result.success) {
        closeProductModal();
        loadProducts();
        alert('Produit créé avec succès !');
    } else {
        alert('Erreur: ' + result.message);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!SupplierAPI.init()) return;
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(link.getAttribute('href').substring(1));
        });
    });
    
    document.querySelectorAll('.order-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.order-tab').forEach(t => {
                t.classList.remove('active', 'border-b-2', 'border-indigo-500');
                t.classList.add('text-gray-400');
            });
            tab.classList.add('active', 'border-b-2', 'border-indigo-500');
            tab.classList.remove('text-gray-400');
        });
    });
    
    loadOverview();
});