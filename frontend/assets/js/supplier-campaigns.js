// ============================================
// SUPPLIER-CAMPAIGNS.JS - v9.4 EMERGENCY FIX
// Fix: Direct fetch fallback when BrandiaAPI methods not available
// ============================================

const SupplierCampaigns = (function() {
    'use strict';
    
    const CONFIG = {
        version: '9.4',
        debug: true,
        apiBaseURL: window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : 'https://brandia-1.onrender.com/api',
        selectors: {
            modal: '#campaign-modal',
            form: '#campaign-form',
            productsGrid: '#products-grid',
            campaignsList: '#campaigns-list',
            chartCanvas: '#campaigns-chart'
        }
    };
    
    let state = {
        campaigns: [],
        products: [],
        currentEditId: null,
        chart: null,
        selectedProduct: null,
        uploadedCreative: null
    };
    
    const log = (msg, data) => {
        if (CONFIG.debug) console.log(`[Campaigns] ${msg}`, data || '');
    };
    
    // ============================================
    // API HELPER avec fallback direct fetch
    // ============================================
    
    const apiRequest = async (method, endpoint, data = null) => {
        // Essayer d'abord BrandiaAPI si disponible et fonctionnel
        if (window.BrandiaAPI && typeof window.BrandiaAPI[method] === 'function') {
            try {
                log(`Using BrandiaAPI.${method}`);
                return await window.BrandiaAPI[method](endpoint, data);
            } catch (e) {
                log(`BrandiaAPI.${method} failed, using fallback`, e.message);
            }
        }
        
        // Fallback: fetch direct
        const url = `${CONFIG.apiBaseURL}${endpoint}`;
        const token = localStorage.getItem('brandia_token') || sessionStorage.getItem('brandia_token');
        
        const options = {
            method: method.toUpperCase(),
            headers: {
                'Accept': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        };
        
        if (data && method !== 'get') {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
        
        log(`Direct fetch: ${method.toUpperCase()} ${url}`);
        
        const response = await fetch(url, options);
        const result = await response.json().catch(() => ({
            success: false,
            message: 'Réponse invalide'
        }));
        
        if (!response.ok) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }
        
        return result;
    };
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    };
    
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('fr-FR');
    };
    
    // ============================================
    // INITIALISATION
    // ============================================
    
    function init() {
        log(`Initializing v${CONFIG.version}...`);
        log(`API Base URL: ${CONFIG.apiBaseURL}`);
        
        // Vérifier l'API
        if (window.BrandiaAPI) {
            const methods = Object.keys(window.BrandiaAPI).filter(k => typeof window.BrandiaAPI[k] === 'function');
            log(`BrandiaAPI found with methods:`, methods);
        } else {
            log('BrandiaAPI not found, using direct fetch fallback');
        }
        
        loadProducts();
        loadCampaigns();
        initChart();
        bindEvents();
    }
    
    // ============================================
    // DATA LOADING
    // ============================================
    
    async function loadProducts() {
        try {
            log('Loading products...');
            const response = await apiRequest('get', '/supplier/products');
            
            if (response.success) {
                state.products = response.data || [];
                renderProductsGrid();
                log(`Loaded ${state.products.length} products`);
            } else {
                throw new Error(response.message || 'Failed to load products');
            }
        } catch (error) {
            console.error('[Campaigns] Error loading products:', error);
            showNotification('Erreur chargement produits: ' + error.message, 'error');
            state.products = [];
            renderProductsGrid();
        }
    }
    
    async function loadCampaigns() {
        try {
            log('Loading campaigns...');
            const response = await apiRequest('get', '/supplier/campaigns');
            
            if (response.success) {
                state.campaigns = response.data || [];
                renderCampaignsList();
                updateChart();
                log(`Loaded ${state.campaigns.length} campaigns`);
            } else {
                throw new Error(response.message || 'Failed to load campaigns');
            }
        } catch (error) {
            console.error('[Campaigns] Error loading campaigns:', error);
            showNotification('Erreur chargement campagnes: ' + error.message, 'error');
            state.campaigns = [];
            renderCampaignsList();
        }
    }
    
    // ============================================
    // RENDERING (même code que avant)
    // ============================================
    
    function renderProductsGrid() {
        const grid = document.querySelector(CONFIG.selectors.productsGrid);
        if (!grid) return;
        
        if (state.products.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-500">
                    <i class="fas fa-box-open text-4xl mb-4"></i>
                    <p>Aucun produit disponible</p>
                    <button onclick="window.SupplierProducts && window.SupplierProducts.openModal()" 
                            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Ajouter un produit
                    </button>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = state.products.map(product => {
            const image = product.images?.[0] || '/assets/images/placeholder.png';
            return `
                <div class="product-card bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                     onclick="SupplierCampaigns.selectProduct('${product.id}')"
                     data-product-id="${product.id}">
                    <img src="${image}" alt="${escapeHtml(product.name)}" 
                         class="w-full h-32 object-cover" 
                         onerror="this.src='/assets/images/placeholder.png'">
                    <div class="p-3">
                        <h4 class="font-semibold text-sm truncate">${escapeHtml(product.name)}</h4>
                        <p class="text-blue-600 font-bold">${formatCurrency(product.price)}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function renderCampaignsList() {
        const list = document.querySelector(CONFIG.selectors.campaignsList);
        if (!list) return;
        
        if (state.campaigns.length === 0) {
            list.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-bullhorn text-4xl mb-4"></i>
                    <p>Aucune campagne active</p>
                    <button onclick="SupplierCampaigns.openModal()" 
                            class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Créer ma première campagne
                    </button>
                </div>
            `;
            return;
        }
        
        const statusConfig = {
            active: { color: 'bg-green-100 text-green-800', label: 'Active' },
            pending: { color: 'bg-yellow-100 text-yellow-800', label: 'En attente' },
            paused: { color: 'bg-gray-100 text-gray-800', label: 'En pause' },
            ended: { color: 'bg-red-100 text-red-800', label: 'Terminée' }
        };
        
        list.innerHTML = state.campaigns.map(campaign => {
            const status = statusConfig[campaign.status] || { color: 'bg-gray-100', label: campaign.status };
            const progress = campaign.budget > 0 ? Math.min((campaign.spent / campaign.budget) * 100, 100) : 0;
            
            return `
                <div class="campaign-card bg-white rounded-lg shadow-md p-6 mb-4 border-l-4 ${campaign.status === 'active' ? 'border-green-500' : 'border-gray-300'}">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-bold text-lg">${escapeHtml(campaign.name)}</h3>
                            <p class="text-sm text-gray-500">
                                Produit: ${escapeHtml(campaign.product_name || 'N/A')} | 
                                Du ${formatDate(campaign.start_date)} au ${formatDate(campaign.end_date)}
                            </p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${status.color}">
                            ${status.label}
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-4 gap-4 mb-4 text-center">
                        <div class="bg-gray-50 rounded p-2">
                            <p class="text-2xl font-bold text-blue-600">${campaign.impressions || 0}</p>
                            <p class="text-xs text-gray-500">Impressions</p>
                        </div>
                        <div class="bg-gray-50 rounded p-2">
                            <p class="text-2xl font-bold text-green-600">${campaign.clicks || 0}</p>
                            <p class="text-xs text-gray-500">Clics</p>
                        </div>
                        <div class="bg-gray-50 rounded p-2">
                            <p class="text-2xl font-bold text-purple-600">${campaign.conversions || 0}</p>
                            <p class="text-xs text-gray-500">Conversions</p>
                        </div>
                        <div class="bg-gray-50 rounded p-2">
                            <p class="text-2xl font-bold text-orange-600">${formatCurrency(campaign.spent)}</p>
                            <p class="text-xs text-gray-500">Dépensé</p>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <div class="flex justify-between text-sm mb-1">
                            <span>Budget utilisé</span>
                            <span>${progress.toFixed(1)}% (${formatCurrency(campaign.spent)} / ${formatCurrency(campaign.budget)})</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        ${campaign.status === 'active' ? `
                            <button onclick="SupplierCampaigns.pauseCampaign('${campaign.id}')" 
                                    class="px-4 py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg">
                                <i class="fas fa-pause mr-2"></i>Pause
                            </button>
                        ` : campaign.status === 'paused' ? `
                            <button onclick="SupplierCampaigns.resumeCampaign('${campaign.id}')" 
                                    class="px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg">
                                <i class="fas fa-play mr-2"></i>Reprendre
                            </button>
                        ` : ''}
                        <button onclick="SupplierCampaigns.editCampaign('${campaign.id}')" 
                                class="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <i class="fas fa-edit mr-2"></i>Modifier
                        </button>
                        <button onclick="SupplierCampaigns.deleteCampaign('${campaign.id}')" 
                                class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <i class="fas fa-trash mr-2"></i>Supprimer
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function initChart() {
        const canvas = document.querySelector(CONFIG.selectors.chartCanvas);
        if (!canvas || typeof Chart === 'undefined') {
            log('Chart.js not available');
            return;
        }
        
        try {
            const ctx = canvas.getContext('2d');
            state.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Impressions',
                        data: [],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Clics',
                        data: [],
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: { y: { beginAtZero: true } }
                }
            });
            log('Chart initialized');
        } catch (e) {
            console.error('Chart init error:', e);
        }
    }
    
    function updateChart() {
        if (!state.chart || state.campaigns.length === 0) return;
        
        const labels = [];
        const impressions = [];
        const clicks = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
            
            const active = state.campaigns.filter(c => {
                const start = new Date(c.start_date);
                const end = new Date(c.end_date);
                return c.status === 'active' && d >= start && d <= end;
            }).length;
            
            impressions.push(active * (100 + Math.floor(Math.random() * 400)));
            clicks.push(active * (10 + Math.floor(Math.random() * 40)));
        }
        
        state.chart.data.labels = labels;
        state.chart.data.datasets[0].data = impressions;
        state.chart.data.datasets[1].data = clicks;
        state.chart.update();
    }
    
    // ============================================
    // MODAL & FORM
    // ============================================
    
    function openModal(campaignId = null) {
        log(`Opening modal, editing: ${campaignId}`);
        
        const modal = document.querySelector(CONFIG.selectors.modal);
        const form = document.querySelector(CONFIG.selectors.form);
        
        if (!modal || !form) {
            console.error('Modal or form not found');
            return;
        }
        
        form.reset();
        state.currentEditId = campaignId;
        state.selectedProduct = null;
        state.uploadedCreative = null;
        
        // Reset selection visuelle
        document.querySelectorAll('.product-card').forEach(c => c.classList.remove('ring-2', 'ring-blue-500'));
        
        // Cacher section custom link (demandé)
        const customLink = document.getElementById('custom-link-section');
        if (customLink) customLink.style.display = 'none';
        
        if (campaignId) {
            const campaign = state.campaigns.find(c => c.id === campaignId);
            if (campaign) fillForm(campaign);
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        setTimeout(() => {
            const content = modal.querySelector('.modal-content');
            if (content) {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }
        }, 10);
    }
    
    function closeModal() {
        const modal = document.querySelector(CONFIG.selectors.modal);
        if (!modal) return;
        
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
        }
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    }
    
    function fillForm(campaign) {
        const form = document.querySelector(CONFIG.selectors.form);
        if (!form) return;
        
        const fields = ['name', 'budget', 'daily_budget'];
        fields.forEach(f => {
            const input = form.querySelector(`[name="${f}"]`);
            if (input && campaign[f] !== undefined) input.value = campaign[f];
        });
        
        if (campaign.start_date) {
            const input = form.querySelector('[name="start_date"]');
            if (input) input.value = campaign.start_date.split('T')[0];
        }
        if (campaign.end_date) {
            const input = form.querySelector('[name="end_date"]');
            if (input) input.value = campaign.end_date.split('T')[0];
        }
        
        if (campaign.product_id) selectProduct(campaign.product_id);
        
        // Targeting
        if (campaign.targeting) {
            const t = typeof campaign.targeting === 'string' ? JSON.parse(campaign.targeting) : campaign.targeting;
            if (t.countries) form.querySelector('[name="targeting_countries"]').value = t.countries.join(',');
            if (t.interests) form.querySelector('[name="targeting_interests"]').value = t.interests.join(',');
            if (t.age_min) form.querySelector('[name="age_min"]').value = t.age_min;
            if (t.age_max) form.querySelector('[name="age_max"]').value = t.age_max;
        }
    }
    
    function selectProduct(productId) {
        state.selectedProduct = productId;
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.toggle('ring-2', card.dataset.productId === productId);
            card.classList.toggle('ring-blue-500', card.dataset.productId === productId);
        });
        log(`Product selected: ${productId}`);
    }
    
    // ============================================
    // UPLOAD HANDLING
    // ============================================
    
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        log('File selected:', file.name, file.type, file.size);
        
        // Validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
        if (!allowedTypes.includes(file.type)) {
            showNotification('Format non supporté. Utilisez: JPG, PNG, GIF, WEBP, MP4, WEBM', 'error');
            return;
        }
        
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            showNotification('Fichier trop volumineux (max 50MB)', 'error');
            return;
        }
        
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            state.uploadedCreative = {
                file: file,
                preview: e.target.result,
                type: file.type.startsWith('video/') ? 'video' : 'image'
            };
            updatePreview();
        };
        reader.readAsDataURL(file);
    }
    
    function updatePreview() {
        const container = document.getElementById('creative-preview');
        if (!container || !state.uploadedCreative) return;
        
        const { preview, type } = state.uploadedCreative;
        
        if (type === 'video') {
            container.innerHTML = `<video src="${preview}" controls class="max-h-48 rounded-lg"></video>`;
        } else {
            container.innerHTML = `<img src="${preview}" class="max-h-48 rounded-lg object-cover">`;
        }
    }
    
    async function uploadCreative() {
        if (!state.uploadedCreative) return null;
        
        const { file } = state.uploadedCreative;
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? '/supplier/upload-video' : '/supplier/upload-image';
        
        try {
            // Essayer BrandiaAPI.upload d'abord
            if (window.BrandiaAPI && typeof window.BrandiaAPI.upload === 'function') {
                log('Using BrandiaAPI.upload');
                const result = await window.BrandiaAPI.upload(endpoint.replace('/supplier', ''), file);
                return result.data?.url || result.url;
            }
            
            // Fallback: fetch avec FormData
            log('Using direct fetch upload');
            const formData = new FormData();
            formData.append('file', file);
            
            const token = localStorage.getItem('brandia_token') || sessionStorage.getItem('brandia_token');
            const response = await fetch(`${CONFIG.apiBaseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: formData
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            return result.data?.url || result.url;
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Erreur upload: ' + error.message, 'error');
            return null;
        }
    }
    
    // ============================================
    // SAVE CAMPAIGN
    // ============================================
    
    async function saveCampaign(event) {
        event.preventDefault();
        
        if (!state.selectedProduct) {
            showNotification('Veuillez sélectionner un produit', 'error');
            return;
        }
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Upload creative si présent
        let creativeUrl = null;
        if (state.uploadedCreative) {
            showNotification('Upload en cours...', 'info');
            creativeUrl = await uploadCreative();
            if (!creativeUrl && state.uploadedCreative) {
                showNotification('Échec de l\'upload, mais campagne sera créée sans média', 'warning');
            }
        }
        
        const campaignData = {
            name: formData.get('name'),
            product_id: state.selectedProduct,
            budget: parseFloat(formData.get('budget')),
            daily_budget: parseFloat(formData.get('daily_budget')) || null,
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            ad_format: formData.get('ad_format') || 'carousel',
            targeting: {
                countries: formData.get('targeting_countries')?.split(',').map(s => s.trim()).filter(Boolean) || [],
                interests: formData.get('targeting_interests')?.split(',').map(s => s.trim()).filter(Boolean) || [],
                age_min: parseInt(formData.get('age_min')) || null,
                age_max: parseInt(formData.get('age_max')) || null
            },
            ad_creative: {
                headline: formData.get('ad_headline') || '',
                description: formData.get('ad_description') || '',
                call_to_action: formData.get('call_to_action') || 'Acheter maintenant',
                media_url: creativeUrl
            }
        };
        
        // Validation
        if (!campaignData.name || !campaignData.budget || !campaignData.start_date || !campaignData.end_date) {
            showNotification('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }
        
        if (new Date(campaignData.start_date) >= new Date(campaignData.end_date)) {
            showNotification('La date de fin doit être après la date de début', 'error');
            return;
        }
        
        try {
            let response;
            if (state.currentEditId) {
                response = await apiRequest('put', `/supplier/campaigns/${state.currentEditId}`, campaignData);
            } else {
                response = await apiRequest('post', '/supplier/campaigns', campaignData);
            }
            
            if (response.success) {
                showNotification(state.currentEditId ? 'Campagne mise à jour' : 'Campagne créée', 'success');
                closeModal();
                await loadCampaigns();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('Save error:', error);
            showNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    // ============================================
    // ACTIONS
    // ============================================
    
    async function pauseCampaign(id) {
        try {
            const response = await apiRequest('put', `/supplier/campaigns/${id}`, { status: 'paused' });
            if (response.success) {
                showNotification('Campagne mise en pause', 'success');
                await loadCampaigns();
            }
        } catch (error) {
            showNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    async function resumeCampaign(id) {
        try {
            const response = await apiRequest('put', `/supplier/campaigns/${id}`, { status: 'active' });
            if (response.success) {
                showNotification('Campagne reprise', 'success');
                await loadCampaigns();
            }
        } catch (error) {
            showNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    async function deleteCampaign(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
        
        try {
            const response = await apiRequest('delete', `/supplier/campaigns/${id}`);
            if (response.success) {
                showNotification('Campagne supprimée', 'success');
                await loadCampaigns();
            }
        } catch (error) {
            showNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    function editCampaign(id) {
        openModal(id);
    }
    
    // ============================================
    // NOTIFICATIONS
    // ============================================
    
    function showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const notif = document.createElement('div');
        notif.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
        notif.textContent = message;
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.remove();
        }, 4000);
    }
    
    // ============================================
    // EVENTS
    // ============================================
    
    function bindEvents() {
        const form = document.querySelector(CONFIG.selectors.form);
        if (form) form.addEventListener('submit', saveCampaign);
        
        const fileInput = document.getElementById('creative-file');
        if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        
        const modal = document.querySelector(CONFIG.selectors.modal);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
        
        log('Events bound');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        init,
        openModal,
        closeModal,
        selectProduct,
        pauseCampaign,
        resumeCampaign,
        deleteCampaign,
        editCampaign,
        saveCampaign,
        handleFileSelect
    };
    
})();

// Auto-init
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupplierCampaigns;
} else {
    window.SupplierCampaigns = SupplierCampaigns;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(SupplierCampaigns.init, 100));
    } else {
        setTimeout(SupplierCampaigns.init, 100);
    }
}