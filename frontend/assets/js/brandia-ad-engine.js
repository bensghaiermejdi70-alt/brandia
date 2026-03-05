// ============================================
// BRANDIA AD ENGINE v6.1 - ROUND ROBIN SYSTEM
// Système de publicité avec rotation équitable
// ============================================

const BrandiaAdEngine = {
    // Configuration
    API_URL: 'https://brandia-1.onrender.com/api',
    AD_DURATION: 15, // secondes
    SKIP_DELAY: 5,   // secondes avant pouvoir passer
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes en ms
    
    // État
    state: {
        isPlaying: false,
        currentCampaign: null,
        campaigns: [],
        sessionId: null,
        lastAdTime: null,
        rotationIndex: 0,
        viewCounted: false
    },

    // ============================================
    // INITIALISATION
    // ============================================
    init: function() {
        console.log('[AdEngine] Initializing v6.1...');
        this.initSession();
        this.loadCampaigns();
        
        // Écouter les messages de la vidéo
        this.attachVideoListeners();
    },

    initSession: function() {
        const now = Date.now();
        const sessionData = JSON.parse(sessionStorage.getItem('brandia_ad_session') || '{}');
        
        // Vérifier si la session est encore valide (30 min)
        if (sessionData.id && sessionData.timestamp && (now - sessionData.timestamp < this.SESSION_DURATION)) {
            this.state.sessionId = sessionData.id;
            this.state.rotationIndex = sessionData.rotationIndex || 0;
            this.state.lastAdTime = sessionData.lastAdTime;
            console.log('[AdEngine] Session restored:', this.state.sessionId, 'Rotation:', this.state.rotationIndex);
        } else {
            // Nouvelle session
            this.state.sessionId = 'session_' + now + '_' + Math.random().toString(36).substr(2, 9);
            this.state.rotationIndex = 0;
            this.state.lastAdTime = null;
            this.saveSession();
            console.log('[AdEngine] New session:', this.state.sessionId);
        }
    },

    saveSession: function() {
        sessionStorage.setItem('brandia_ad_session', JSON.stringify({
            id: this.state.sessionId,
            timestamp: Date.now(),
            rotationIndex: this.state.rotationIndex,
            lastAdTime: this.state.lastAdTime
        }));
    },

    // ============================================
    // CHARGEMENT DES CAMPAGNES
    // ============================================
    loadCampaigns: async function() {
        try {
            // Récupérer toutes les campagnes actives
            const response = await fetch(`${this.API_URL}/supplier/public/campaigns`);
            
            if (!response.ok) {
                console.log('[AdEngine] No public campaigns endpoint, using fallback');
                return;
            }
            
            const data = await response.json();
            if (data.success && data.data) {
                this.state.campaigns = data.data.filter(c => c.status === 'active');
                console.log('[AdEngine] Loaded', this.state.campaigns.length, 'active campaigns');
            }
        } catch (error) {
            console.log('[AdEngine] Could not load campaigns:', error.message);
        }
    },

    // ============================================
    // VÉRIFICATION & DÉCLENCHEMENT
    // ============================================
    checkAndTrigger: async function(productData) {
        console.log('[AdEngine] Checking ad for product:', productData);
        
        // Vérifier si déjà une pub en cours
        if (this.state.isPlaying) {
            console.log('[AdEngine] Ad already playing');
            return false;
        }

        // Vérifier limite de session (1 pub par session)
        if (this.state.lastAdTime) {
            const timeSinceLastAd = Date.now() - this.state.lastAdTime;
            if (timeSinceLastAd < this.SESSION_DURATION) {
                console.log('[AdEngine] Ad already shown in this session');
                return false;
            }
        }

        // Vérifier si le produit a un fournisseur
        if (!productData.supplier_id) {
            console.log('[AdEngine] No supplier_id for this product');
            return false;
        }

        try {
            // 🔥 Vérifier si une campagne active existe pour ce fournisseur ET ce produit
            const campaign = await this.getCampaignForProduct(productData.supplier_id, productData.id);
            
            if (!campaign) {
                console.log('[AdEngine] No active campaign for this supplier/product');
                return false;
            }

            // Vérifier si c'est au tour de cette campagne (round-robin)
            if (this.state.campaigns.length > 0) {
                const expectedCampaign = this.state.campaigns[this.state.rotationIndex % this.state.campaigns.length];
                if (expectedCampaign.id !== campaign.id) {
                    console.log('[AdEngine] Not this campaign\'s turn (round-robin)');
                    // Mettre à jour l'index pour la prochaine fois
                    this.state.rotationIndex = this.findCampaignIndex(campaign.id);
                }
            }

            // 🎬 Lancer la publicité
            this.playAd(campaign, productData);
            return true;

        } catch (error) {
            console.error('[AdEngine] Error checking campaign:', error);
            return false;
        }
    },

    getCampaignForProduct: async function(supplierId, productId) {
        try {
            // Appel API pour vérifier si une campagne existe
            const response = await fetch(
                `${this.API_URL}/supplier/public/campaigns/active?supplier=${supplierId}&product=${productId}`
            );
            
            if (!response.ok) return null;
            
            const data = await response.json();
            if (data.success && data.data) {
                return data.data;
            }
            
            // Fallback: chercher dans les campagnes chargées
            return this.state.campaigns.find(c => 
                c.supplier_id === supplierId && 
                (c.product_id === productId || 
                 (c.targeting?.products && c.targeting.products.includes(productId)))
            );
        } catch (error) {
            console.log('[AdEngine] API check failed, using local data');
            return this.state.campaigns.find(c => 
                c.supplier_id === supplierId && c.product_id === productId
            );
        }
    },

    findCampaignIndex: function(campaignId) {
        const index = this.state.campaigns.findIndex(c => c.id === campaignId);
        return index >= 0 ? index : 0;
    },

    // ============================================
    // LECTURE DE LA PUBLICITÉ
    // ============================================
    playAd: function(campaign, productData) {
        console.log('[AdEngine] Playing ad:', campaign.name);
        this.state.isPlaying = true;
        this.state.currentCampaign = campaign;
        this.state.viewCounted = false;

        const overlay = document.getElementById('brandia-ad-overlay');
        const video = document.getElementById('brandia-ad-video');
        const loading = document.getElementById('brandia-ad-loading');
        
        // Afficher l'overlay
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Afficher le loading
        loading.classList.remove('hidden');
        
        // Configurer le contenu
        this.setupAdContent(campaign);
        
        // Configurer la vidéo
        if (campaign.media_url && campaign.media_type === 'video') {
            this.setupVideo(campaign.media_url);
        } else if (campaign.ad_creative?.image_url) {
            this.setupFallbackImage(campaign.ad_creative.image_url);
        } else {
            this.setupFallbackImage(null);
        }

        // Démarrer le timer
        this.startAdTimer();
        
        // Notification sponsorisée
        this.showSponsorNotification();
        
        // Tracking: vue après 3 secondes
        setTimeout(() => {
            if (this.state.isPlaying && !this.state.viewCounted) {
                this.trackView(campaign.id);
                this.state.viewCounted = true;
            }
        }, 3000);
    },

    setupAdContent: function(campaign) {
        const creative = campaign.ad_creative || {};
        
        document.getElementById('brandia-ad-title').textContent = 
            creative.headline || campaign.name || 'Offre spéciale';
        document.getElementById('brandia-ad-desc').textContent = 
            creative.description || 'Découvrez cette offre exclusive';
        
        const ctaBtn = document.getElementById('brandia-ad-cta');
        ctaBtn.innerHTML = `${creative.cta_text || "Voir l'offre"} <i class="fas fa-arrow-right" style="margin-left: 8px;"></i>`;
        ctaBtn.href = campaign.cta_link || '#';
        
        // Info rotation
        const current = (this.state.rotationIndex % Math.max(this.state.campaigns.length, 1)) + 1;
        const total = Math.max(this.state.campaigns.length, 1);
        document.getElementById('ad-rotation-info').textContent = `${current}/${total}`;
        
        // Stats
        document.getElementById('ad-views').textContent = campaign.impressions || 0;
        document.getElementById('ad-clicks').textContent = campaign.clicks || 0;
    },

    setupVideo: function(videoUrl) {
        const video = document.getElementById('brandia-ad-video');
        const fallback = document.getElementById('brandia-ad-fallback');
        const loading = document.getElementById('brandia-ad-loading');
        
        video.src = videoUrl;
        video.style.display = 'block';
        fallback.classList.remove('active');
        
        video.onloadeddata = () => {
            loading.classList.add('hidden');
            video.play().catch(e => {
                console.log('[AdEngine] Autoplay blocked, showing fallback');
                this.showVideoFallback();
            });
        };
        
        video.onerror = () => {
            console.log('[AdEngine] Video error, showing fallback');
            this.showVideoFallback();
        };
        
        // Fin de la vidéo
        video.onended = () => {
            this.completeAd();
        };
    },

    setupFallbackImage: function(imageUrl) {
        const video = document.getElementById('brandia-ad-video');
        const fallback = document.getElementById('brandia-ad-fallback');
        const loading = document.getElementById('brandia-ad-loading');
        const fallbackImg = document.getElementById('brandia-ad-fallback-img');
        
        video.style.display = 'none';
        fallback.classList.add('active');
        loading.classList.add('hidden');
        
        if (imageUrl) {
            fallbackImg.src = imageUrl;
        }
    },

    showVideoFallback: function() {
        const video = document.getElementById('brandia-ad-video');
        const fallback = document.getElementById('brandia-ad-fallback');
        const loading = document.getElementById('brandia-ad-loading');
        
        video.style.display = 'none';
        fallback.classList.add('active');
        loading.classList.add('hidden');
    },

    retryVideo: function() {
        const video = document.getElementById('brandia-ad-video');
        if (video.src) {
            video.play();
        }
    },

    // ============================================
    // TIMER & PROGRESSION
    // ============================================
    startAdTimer: function() {
        let remaining = this.AD_DURATION;
        const timerDisplay = document.getElementById('brandia-ad-timer-display');
        const timerText = document.getElementById('brandia-ad-timer-text');
        const progressBar = document.getElementById('brandia-ad-progress-bar');
        const skipBtn = document.getElementById('brandia-ad-skip');
        const skipTimer = document.getElementById('skip-timer');
        
        // Afficher le bouton skip après 5 secondes
        let skipRemaining = this.SKIP_DELAY;
        const skipInterval = setInterval(() => {
            skipRemaining--;
            if (skipTimer) skipTimer.textContent = `(${skipRemaining})`;
            
            if (skipRemaining <= 0) {
                clearInterval(skipInterval);
                skipBtn.classList.add('visible');
                skipBtn.innerHTML = 'Passer la pub <i class="fas fa-forward"></i>';
            }
        }, 1000);
        
        // Timer principal
        this.adTimer = setInterval(() => {
            remaining--;
            
            if (timerDisplay) timerDisplay.textContent = remaining;
            if (timerText) timerText.textContent = remaining;
            
            // Progress bar
            const progress = ((this.AD_DURATION - remaining) / this.AD_DURATION) * 100;
            if (progressBar) progressBar.style.width = `${progress}%`;
            
            if (remaining <= 0) {
                this.completeAd();
            }
        }, 1000);
    },

    // ============================================
    // ACTIONS UTILISATEUR
    // ============================================
    skipAd: function() {
        console.log('[AdEngine] Ad skipped by user');
        this.completeAd();
    },

    handleClick: function(event) {
        event.preventDefault();
        
        if (this.state.currentCampaign) {
            this.trackClick(this.state.currentCampaign.id);
            
            // Rediriger vers le lien CTA
            const link = event.currentTarget.href;
            if (link && link !== '#') {
                window.open(link, '_blank');
            }
        }
        
        this.completeAd();
    },

    completeAd: function() {
        if (!this.state.isPlaying) return;
        
        console.log('[AdEngine] Ad completed');
        
        // Arrêter les timers
        if (this.adTimer) clearInterval(this.adTimer);
        
        // Mettre à jour la session
        this.state.lastAdTime = Date.now();
        this.state.rotationIndex = (this.state.rotationIndex + 1) % Math.max(this.state.campaigns.length, 1);
        this.saveSession();
        
        // Cacher l'overlay
        const overlay = document.getElementById('brandia-ad-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        
        // Arrêter la vidéo
        const video = document.getElementById('brandia-ad-video');
        video.pause();
        video.src = '';
        
        // Reset state
        this.state.isPlaying = false;
        this.state.currentCampaign = null;
        
        // 🔥 Callback: ajouter au panier après la pub
        if (window.handleProductClick && typeof addToCart === 'function') {
            console.log('[AdEngine] Calling addToCart after ad');
            addToCart();
        }
    },

    // ============================================
    // TRACKING
    // ============================================
    trackView: async function(campaignId) {
        try {
            await fetch(`${this.API_URL}/supplier/public/campaigns/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_id: campaignId })
            });
            console.log('[AdEngine] View tracked for', campaignId);
        } catch (e) {
            console.log('[AdEngine] Failed to track view');
        }
    },

    trackClick: async function(campaignId) {
        try {
            await fetch(`${this.API_URL}/supplier/public/campaigns/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_id: campaignId })
            });
            console.log('[AdEngine] Click tracked for', campaignId);
        } catch (e) {
            console.log('[AdEngine] Failed to track click');
        }
    },

    // ============================================
    // UI HELPERS
    // ============================================
    showSponsorNotification: function() {
        const notif = document.getElementById('brandia-ad-sponsor-notif');
        notif.classList.add('show');
        setTimeout(() => {
            notif.classList.remove('show');
        }, 3000);
    },

    attachVideoListeners: function() {
        // Gestion des erreurs vidéo globales
        const video = document.getElementById('brandia-ad-video');
        if (video) {
            video.addEventListener('error', () => {
                console.log('[AdEngine] Video error detected');
                this.showVideoFallback();
            });
        }
    }
};

// Exposer globalement
window.BrandiaAdEngine = BrandiaAdEngine;

// Auto-init si DOM prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BrandiaAdEngine.init());
} else {
    BrandiaAdEngine.init();
}

console.log('[BrandiaAdEngine] v6.1 loaded');