// ============================================
// SUPPLIER-CAMPAIGNS.JS - v9.2 FIXED
// Correction: BrandiaAPI global check, Modal, round-robin, suppression custom link
// ============================================

const SupplierCampaigns = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    
    const CONFIG = {
        version: '9.2',
        debug: true,
        selectors: {
            container: '#campaigns-section',
            modal: '#campaign-modal',
            form: '#campaign-form',
            productsGrid: '#products-grid',
            campaignsList: '#campaigns-list',
            chartCanvas: '#campaigns-chart'
        },
        roundRobin: {
            currentIndex: 0,
            adsPerSession: 1
        }
    };
    
    // ============================================
    // ÉTAT
    // ============================================
    
    let state = {
        campaigns: [],
        products: [],
        currentEditId: null,
        chart: null,
        selectedProduct: null,
        uploadedCreative: null
    };
    
    // ============================================
    // UTILITAIRES
    // ============================================
    
    const log = (msg, data) => {
        if (CONFIG.debug) {
            console.log(`[Campaigns] ${msg}`, data || '');
        }
    };
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    };
    
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('fr-FR');
    };
    
    // Helper pour appeler l'API avec vérification
    const apiCall = async (method, endpoint, data = null) => {
        // Attendre que BrandiaAPI soit disponible (max 5 secondes)
        let attempts = 0;
        const maxAttempts = 50;
        
        while (typeof window.BrandiaAPI === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof window.BrandiaAPI === 'undefined') {
            throw new Error('BrandiaAPI non disponible');
        }
        
        if (!window.BrandiaAPI[method]) {
            throw new Error(`BrandiaAPI.${method} n'existe pas`);
        }
        
        return await window.BrandiaAPI[method](endpoint, data);
    };
    
    // ============================================
    // INITIALISATION
    // ============================================
    
    function init() {
        log(`Initializing v${CONFIG.version}...`);
        
        // Vérifier que BrandiaAPI existe avant de continuer
        if (typeof window.BrandiaAPI === 'undefined') {
            log('BrandiaAPI not loaded yet, waiting...');
            setTimeout(init, 500);
            return;
        }
        
        loadProducts();
        loadCampaigns();
        initChart();
        bindEvents();
        
        // Round-robin: afficher une seule pub par session
        initRoundRobin();
    }
    
    function initRoundRobin() {
        const sessionKey = 'brandia_ads_session';
        const sessionData = sessionStorage.getItem(sessionKey);
        
        if (!sessionData) {
            sessionStorage.setItem(sessionKey, JSON.stringify({
                shownAds: [],
                timestamp: Date.now()
            }));
        }
        
        // Rotation des annonces visibles
        rotateVisibleAds();
    }
    
    function rotateVisibleAds() {
        const ads = document.querySelectorAll('.ad-slot');
        if (ads.length === 0) return;
        
        // Masquer toutes les pubs
        ads.forEach(ad => ad.style.display = 'none');
        
        // Afficher seulement celle de l'index courant
        const sessionKey = 'brandia_ads_session';
        const sessionData = JSON.parse(sessionStorage.getItem(sessionKey) || '{}');
        const shownAds = sessionData.shownAds || [];
        
        // Trouver la prochaine pub non montrée
        let nextIndex = CONFIG.roundRobin.currentIndex;
        let attempts = 0;
        
        while (shownAds.includes(nextIndex) && attempts < ads.length) {
            nextIndex = (nextIndex + 1) % ads.length;
            attempts++;
        }
        
        if (ads[nextIndex]) {
            ads[nextIndex].style.display = 'block';
            shownAds.push(nextIndex);
            sessionStorage.setItem(sessionKey, JSON.stringify({
                ...sessionData,
                shownAds: shownAds
            }));
        }
        
        CONFIG.roundRobin.currentIndex = (nextIndex + 1) % ads.length;
    }
    
    // ============================================
    // CHARGEMENT DES DONNÉES
    // ============================================
    
    async function loadProducts() {
        try {
            log('Loading products...');
            const response = await apiCall('get', '/supplier/products');
            
            if (response.success) {
                state.products = response.data || [];
                renderProductsGrid();
                log(`Loaded: ${state.products.length} products`);
            }
        } catch (error) {
            console.error('[Campaigns] Error loading products:', error);
            showNotification('Erreur lors du chargement des produits', 'error');
        }
    }
    
    async function loadCampaigns() {
        try {
            log('Loading campaigns...');
            const response = await apiCall('get', '/supplier/campaigns');
            
            if (response.success) {
                state.campaigns = response.data || [];
                renderCampaignsList();
                updateChart();
                log(`Loaded: ${state.campaigns.length} campaigns`);
            }
        } catch (error) {
            console.error('[Campaigns] Error loading campaigns:', error);
            showNotification('Erreur lors du chargement des campagnes', 'error');
        }
    }
    
    // ============================================
    // RENDU
    // ============================================
    
    function renderProductsGrid() {
        const grid = document.querySelector(CONFIG.selectors.productsGrid);
        if (!grid) return;
        
        if (state.products.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-500">
                    <i class="fas fa-box-open text-4xl mb-4"></i>
                    <p>Aucun produit disponible</p>
                    <button onclick="SupplierProducts.openModal()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Ajouter un produit
                    </button>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = state.products.map(product => {
            const image = product.images && product.images[0] ? product.images[0] : '/assets/images/placeholder.png';
            return `
                <div class="product-card bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                     onclick="SupplierCampaigns.selectProduct('${product.id}')"
                     data-product-id="${product.id}">
                    <img src="${image}" alt="${product.name}" class="w-full h-32 object-cover">
                    <div class="p-3">
                        <h4 class="font-semibold text-sm truncate">${product.name}</h4>
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
                    <button onclick="SupplierCampaigns.openModal()" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Créer ma première campagne
                    </button>
                </div>
            `;
            return;
        }
        
        list.innerHTML = state.campaigns.map(campaign => {
            const statusColors = {
                'active': 'bg-green-100 text-green-800',
                'pending': 'bg-yellow-100 text-yellow-800',
                'paused': 'bg-gray-100 text-gray-800',
                'ended': 'bg-red-100 text-red-800'
            };
            
            const statusLabels = {
                'active': 'Active',
                'pending': 'En attente',
                'paused': 'En pause',
                'ended': 'Terminée'
            };
            
            const progress = campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0;
            
            return `
                <div class="campaign-card bg-white rounded-lg shadow-md p-6 mb-4 border-l-4 ${campaign.status === 'active' ? 'border-green-500' : 'border-gray-300'}">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-bold text-lg">${campaign.name}</h3>
                            <p class="text-sm text-gray-500">
                                Produit: ${campaign.product_name || 'N/A'} | 
                                Du ${formatDate(campaign.start_date)} au ${formatDate(campaign.end_date)}
                            </p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColors[campaign.status] || 'bg-gray-100'}">
                            ${statusLabels[campaign.status] || campaign.status}
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
                            <p class="text-2xl font-bold text-orange-600">${formatCurrency(campaign.spent || 0)}</p>
                            <p class="text-xs text-gray-500">Dépensé</p>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <div class="flex justify-between text-sm mb-1">
                            <span>Budget utilisé</span>
                            <span>${progress.toFixed(1)}% (${formatCurrency(campaign.spent)} / ${formatCurrency(campaign.budget)})</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${Math.min(progress, 100)}%"></div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        ${campaign.status === 'active' ? `
                            <button onclick="SupplierCampaigns.pauseCampaign('${campaign.id}')" class="px-4 py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                                <i class="fas fa-pause mr-2"></i>Pause
                            </button>
                        ` : campaign.status === 'paused' ? `
                            <button onclick="SupplierCampaigns.resumeCampaign('${campaign.id}')" class="px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                <i class="fas fa-play mr-2"></i>Reprendre
                            </button>
                        ` : ''}
                        <button onclick="SupplierCampaigns.editCampaign('${campaign.id}')" class="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <i class="fas fa-edit mr-2"></i>Modifier
                        </button>
                        <button onclick="SupplierCampaigns.deleteCampaign('${campaign.id}')" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <i class="fas fa-trash mr-2"></i>Supprimer
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function initChart() {
        const canvas = document.querySelector(CONFIG.selectors.chartCanvas);
        if (!canvas || typeof Chart === 'undefined') return;
        
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
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        log('Chart initialized');
    }
    
    function updateChart() {
        if (!state.chart) return;
        
        // Générer les données des 7 derniers jours
        const labels = [];
        const impressionsData = [];
        const clicksData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('fr-FR', { weekday: 'short' }));
            
            // Données simulées ou réelles si disponibles
            const dayData = calculateDailyStats(date);
            impressionsData.push(dayData.impressions);
            clicksData.push(dayData.clicks);
        }
        
        state.chart.data.labels = labels;
        state.chart.data.datasets[0].data = impressionsData;
        state.chart.data.datasets[1].data = clicksData;
        state.chart.update();
    }
    
    function calculateDailyStats(date) {
        // Simulation - à remplacer par des données réelles
        const campaignsActive = state.campaigns.filter(c => {
            const start = new Date(c.start_date);
            const end = new Date(c.end_date);
            return c.status === 'active' && date >= start && date <= end;
        }).length;
        
        return {
            impressions: campaignsActive * Math.floor(Math.random() * 500 + 100),
            clicks: campaignsActive * Math.floor(Math.random() * 50 + 10)
        };
    }
    
    // ============================================
    // GESTION DU MODAL
    // ============================================
    
    function openModal(campaignId = null) {
        log(`Opening modal, editing: ${campaignId}`);
        
        const modal = document.querySelector(CONFIG.selectors.modal);
        const form = document.querySelector(CONFIG.selectors.form);
        
        if (!modal || !form) {
            console.error('[Campaigns] Modal or form not found');
            return;
        }
        
        // Reset form
        form.reset();
        state.currentEditId = campaignId;
        state.selectedProduct = null;
        state.uploadedCreative = null;
        
        // Reset UI
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('ring-2', 'ring-blue-500');
        });
        
        // Hide custom link section (SUPPRIMÉ selon demande)
        const customLinkSection = document.getElementById('custom-link-section');
        if (customLinkSection) {
            customLinkSection.style.display = 'none';
        }
        
        if (campaignId) {
            // Mode édition
            const campaign = state.campaigns.find(c => c.id === campaignId);
            if (campaign) {
                fillFormWithCampaign(campaign);
            }
        }
        
        // Afficher le modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Animation
        setTimeout(() => {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.classList.remove('scale-95', 'opacity-0');
                modalContent.classList.add('scale-100', 'opacity-100');
            }
        }, 10);
    }
    
    function closeModal() {
        const modal = document.querySelector(CONFIG.selectors.modal);
        if (!modal) return;
        
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.remove('scale-100', 'opacity-100');
            modalContent.classList.add('scale-95', 'opacity-0');
        }
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    }
    
    function fillFormWithCampaign(campaign) {
        const form = document.querySelector(CONFIG.selectors.form);
        if (!form) return;
        
        form.querySelector('[name="name"]').value = campaign.name || '';
        form.querySelector('[name="budget"]').value = campaign.budget || '';
        form.querySelector('[name="daily_budget"]').value = campaign.daily_budget || '';
        form.querySelector('[name="start_date"]').value = campaign.start_date ? campaign.start_date.split('T')[0] : '';
        form.querySelector('[name="end_date"]').value = campaign.end_date ? campaign.end_date.split('T')[0] : '';
        
        // Sélectionner le produit
        if (campaign.product_id) {
            selectProduct(campaign.product_id);
        }
        
        // Targeting
        if (campaign.targeting) {
            const targeting = typeof campaign.targeting === 'string' 
                ? JSON.parse(campaign.targeting) 
                : campaign.targeting;
            
            if (targeting.countries) {
                form.querySelector('[name="targeting_countries"]').value = targeting.countries.join(',');
            }
            if (targeting.interests) {
                form.querySelector('[name="targeting_interests"]').value = targeting.interests.join(',');
            }
            if (targeting.age_min) {
                form.querySelector('[name="age_min"]').value = targeting.age_min;
            }
            if (targeting.age_max) {
                form.querySelector('[name="age_max"]').value = targeting.age_max;
            }
        }
    }
    
    function selectProduct(productId) {
        state.selectedProduct = productId;
        
        // UI feedback
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('ring-2', 'ring-blue-500');
            if (card.dataset.productId === productId) {
                card.classList.add('ring-2', 'ring-blue-500');
            }
        });
        
        log(`Product selected: ${productId}`);
    }
    
    // ============================================
    // SAUVEGARDE - CORRECTION PRINCIPALE
    // ============================================
    
    async function saveCampaign(event) {
        event.preventDefault();
        
        log('========== SAVE STARTED ==========');
        
        if (!state.selectedProduct) {
            showNotification('Veuillez sélectionner un produit', 'error');
            return;
        }
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Construction des données
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
                call_to_action: formData.get('call_to_action') || 'Acheter maintenant'
            }
        };
        
        // Validation
        if (!campaignData.name || !campaignData.budget || !campaignData.start_date || !campaignData.end_date) {
            showNotification('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }
        
        // Vérifier les dates
        if (new Date(campaignData.start_date) >= new Date(campaignData.end_date)) {
            showNotification('La date de fin doit être après la date de début', 'error');
            return;
        }
        
        log('Saving:', campaignData);
        
        try {
            let response;
            
            if (state.currentEditId) {
                // Update
                response = await apiCall('put', `/supplier/campaigns/${state.currentEditId}`, campaignData);
            } else {
                // Create
                response = await apiCall('post', '/supplier/campaigns', campaignData);
            }
            
            log('API Response:', response);
            
            if (response.success) {
                showNotification(
                    state.currentEditId ? 'Campagne mise à jour avec succès' : 'Campagne créée avec succès',
                    'success'
                );
                closeModal();
                await loadCampaigns();
            } else {
                showNotification(response.message || 'Erreur lors de la sauvegarde', 'error');
            }
        } catch (error) {
            console.error('[Campaigns] Save error:', error);
            showNotification('Erreur lors de la sauvegarde de la campagne', 'error');
        }
    }
    
    // ============================================
    // ACTIONS SUR LES CAMPAGNES
    // ============================================
    
    async function pauseCampaign(id) {
        try {
            const response = await apiCall('put', `/supplier/campaigns/${id}`, { status: 'paused' });
            if (response.success) {
                showNotification('Campagne mise en pause', 'success');
                await loadCampaigns();
            }
        } catch (error) {
            showNotification('Erreur lors de la mise en pause', 'error');
        }
    }
    
    async function resumeCampaign(id) {
        try {
            const response = await apiCall('put', `/supplier/campaigns/${id}`, { status: 'active' });
            if (response.success) {
                showNotification('Campagne reprise', 'success');
                await loadCampaigns();
            }
        } catch (error) {
            showNotification('Erreur lors de la reprise', 'error');
        }
    }
    
    async function deleteCampaign(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;
        
        try {
            const response = await apiCall('delete', `/supplier/campaigns/${id}`);
            if (response.success) {
                showNotification('Campagne supprimée avec succès', 'success');
                await loadCampaigns();
            }
        } catch (error) {
            showNotification('Erreur lors de la suppression', 'error');
        }
    }
    
    function editCampaign(id) {
        openModal(id);
    }
    
    // ============================================
    // GESTION DES FICHIERS
    // ============================================
    
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        log('File selected:', file.name);
        
        // Validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
        if (!allowedTypes.includes(file.type)) {
            showNotification('Format de fichier non supporté', 'error');
            return;
        }
        
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showNotification('Fichier trop volumineux (max 10MB)', 'error');
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
            
            updateCreativePreview();
        };
        reader.readAsDataURL(file);
    }
    
    function updateCreativePreview() {
        const previewContainer = document.getElementById('creative-preview');
        if (!previewContainer || !state.uploadedCreative) return;
        
        const { preview, type } = state.uploadedCreative;
        
        if (type === 'video') {
            previewContainer.innerHTML = `<video src="${preview}" controls class="max-h-48 rounded-lg"></video>`;
        } else {
            previewContainer.innerHTML = `<img src="${preview}" class="max-h-48 rounded-lg object-cover">`;
        }
    }
    
    // ============================================
    // NOTIFICATIONS
    // ============================================
    
    function showNotification(message, type = 'info') {
        // Utiliser la fonction globale si disponible
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 ${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-y-0`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // ============================================
    // EVENT BINDING
    // ============================================
    
    function bindEvents() {
        // Form submit
        const form = document.querySelector(CONFIG.selectors.form);
        if (form) {
            form.addEventListener('submit', saveCampaign);
        }
        
        // File input
        const fileInput = document.getElementById('creative-file');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
        }
        
        // Close modal on backdrop click
        const modal = document.querySelector(CONFIG.selectors.modal);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
        
        log('Events bound');
    }
    
    // ============================================
    // API EXPOSED
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
        saveCampaign, // Exposé pour le form onsubmit
        handleFileSelect
    };
    
})();

// ============================================
// AUTO-INIT
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupplierCampaigns;
} else {
    window.SupplierCampaigns = SupplierCampaigns;
    
    // Auto-initialize si le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay to ensure BrandiaAPI is loaded
            setTimeout(SupplierCampaigns.init, 100);
        });
    } else {
        // Delay to ensure BrandiaAPI is loaded
        setTimeout(SupplierCampaigns.init, 100);
    }
}