// ============================================
// BRANDIA ADS SYSTEM - v3.0 QUOTA VARIABLE
// Gestion du quota personnalisé par marque (défini par Brandia)
// ============================================

(function() {
  'use strict';
  
  // Éviter double chargement
  if (window.BrandiaAds && window.BrandiaAds.version === '3.0') return;

  const API_BASE = 'https://brandia-1.onrender.com/api';
  
  // Configuration
  const CONFIG = {
    overlayDuration: 15000, // 15 secondes
    initDelay: 2000,        // Délai avant affichage (2s)
    apiEndpoints: {
      product: `${API_BASE}/products/`,
      campaign: `${API_BASE}/public/campaigns`,
      adSettings: `${API_BASE}/supplier/public/ad-settings`, // 🔥 NOUVEAU : quota par marque
      trackView: `${API_BASE}/public/campaigns/view`,
      trackClick: `${API_BASE}/public/campaigns/click`
    }
  };

  // État par marque (pour gérer les quotas différents)
  const BrandQuotaManager = {
    // Structure: { supplierId: { shownCount: 0, maxAllowed: 1, dismissed: false } }
    quotas: {},

    async getQuotaForBrand(supplierId) {
      // Si déjà en mémoire, retourner
      if (this.quotas[supplierId]) {
        return this.quotas[supplierId];
      }

      try {
        // 🔥 Récupérer le quota défini par Brandia pour cette marque
        const response = await fetch(`${CONFIG.apiEndpoints.adSettings}?supplier=${supplierId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          this.quotas[supplierId] = {
            shownCount: 0,
            maxAllowed: data.data.max_ads_per_session || 1, // 🔥 QUOTA VARIABLE
            priority: data.data.priority || 5,
            dismissed: false,
            isDefault: data.data.is_default || false
          };
        } else {
          // Fallback : 1 par défaut
          this.quotas[supplierId] = {
            shownCount: 0,
            maxAllowed: 1,
            priority: 5,
            dismissed: false,
            isDefault: true
          };
        }
        
        console.log(`[BrandiaAds] Quota for supplier ${supplierId}: ${this.quotas[supplierId].maxAllowed} ads/session`);
        return this.quotas[supplierId];
        
      } catch (err) {
        console.error('[BrandiaAds] Error fetching ad settings:', err);
        // Fallback sécurisé
        this.quotas[supplierId] = { shownCount: 0, maxAllowed: 1, priority: 5, dismissed: false, isDefault: true };
        return this.quotas[supplierId];
      }
    },

    canShowAd(supplierId) {
      const quota = this.quotas[supplierId];
      if (!quota) return false;
      
      // Vérifier si quota atteint
      if (quota.shownCount >= quota.maxAllowed) {
        console.log(`[BrandiaAds] Quota reached for supplier ${supplierId}: ${quota.shownCount}/${quota.maxAllowed}`);
        return false;
      }
      
      // Vérifier si utilisateur a fermé manuellement
      if (quota.dismissed) {
        console.log(`[BrandiaAds] User dismissed ads for supplier ${supplierId} this session`);
        return false;
      }
      
      return true;
    },

    incrementShown(supplierId) {
      if (this.quotas[supplierId]) {
        this.quotas[supplierId].shownCount++;
      }
    },

    markDismissed(supplierId) {
      if (this.quotas[supplierId]) {
        this.quotas[supplierId].dismissed = true;
      }
    },

    reset() {
      this.quotas = {};
    }
  };

  // Session storage legacy (pour compatibilité)
  const AdsStorage = {
    getSeenCampaigns: () => {
      try {
        return JSON.parse(sessionStorage.getItem('brandia_seen_campaigns_v3') || '[]');
      } catch {
        return [];
      }
    },
    markCampaignSeen: (campaignId) => {
      const seen = AdsStorage.getSeenCampaigns();
      if (!seen.includes(campaignId)) {
        seen.push(campaignId);
        sessionStorage.setItem('brandia_seen_campaigns_v3', JSON.stringify(seen));
      }
    },
    hasSeenCampaign: (campaignId) => {
      return AdsStorage.getSeenCampaigns().includes(campaignId);
    }
  };

  const BrandiaAds = {
    version: '3.0',
    state: {
      currentCampaign: null,
      currentSupplierId: null,
      isPlaying: false,
      timer: null,
      countdown: 15
    },

    // 🔥 POINT CLÉ : Récupérer supplier_id depuis le produit + quota Brandia
    init: async function() {
      console.log('[BrandiaAds] Initializing v3.0 (Quota Variable)...');
      
      // Récupérer IDs depuis l'URL
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');
      
      if (!productId) {
        console.log('[BrandiaAds] No product ID, skipping');
        return;
      }

      try {
        // 1. Récupérer les infos du produit pour avoir le supplier_id
        const productResponse = await fetch(`${CONFIG.apiEndpoints.product}${productId}`);
        const productData = await productResponse.json();
        
        if (!productData.success || !productData.data) {
          console.log('[BrandiaAds] Product not found');
          return;
        }
        
        const product = productData.data.product || productData.data;
        const supplierId = product.supplier_id;
        
        if (!supplierId) {
          console.log('[BrandiaAds] No supplier for this product');
          return;
        }

        this.state.currentSupplierId = supplierId;
        console.log(`[BrandiaAds] Product: ${productId} | Supplier: ${supplierId}`);

        // 2. 🔥 Récupérer le QUOTA défini par Brandia pour cette marque
        await BrandQuotaManager.getQuotaForBrand(supplierId);
        
        // 3. Vérifier si on peut encore montrer une pub pour cette marque
        if (!BrandQuotaManager.canShowAd(supplierId)) {
          return; // Quota atteint ou utilisateur a fermé
        }

        // 4. Récupérer la campagne active
        const campaignResponse = await fetch(
          `${CONFIG.apiEndpoints.campaign}?supplier=${supplierId}&product=${productId}`
        );
        const campaignData = await campaignResponse.json();

        if (!campaignData.success || !campaignData.data) {
          console.log('[BrandiaAds] No active campaign');
          return;
        }

        const campaign = campaignData.data;
        
        // 5. Vérifier si cette campagne spécifique déjà vue
        if (AdsStorage.hasSeenCampaign(campaign.id)) {
          console.log('[BrandiaAds] Campaign already seen this session');
          return;
        }

        // 6. Vérifier dates de validité
        const now = new Date();
        const startDate = new Date(campaign.start_date);
        const endDate = new Date(campaign.end_date);
        
        if (now < startDate || now > endDate) {
          console.log('[BrandiaAds] Campaign not active (dates)');
          return;
        }

        console.log(`[BrandiaAds] Campaign found: ${campaign.id} | Quota: ${BrandQuotaManager.quotas[supplierId].shownCount + 1}/${BrandQuotaManager.quotas[supplierId].maxAllowed}`);
        
        this.state.currentCampaign = campaign;
        
        // 7. Afficher après délai UX
        setTimeout(() => {
          this.showAd(campaign, supplierId);
        }, CONFIG.initDelay);

      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
      }
    },

    showAd: function(campaign, supplierId) {
      if (!campaign || AdsStorage.hasSeenCampaign(campaign.id)) return;
      
      // Double vérification quota
      if (!BrandQuotaManager.canShowAd(supplierId)) {
        console.log('[BrandiaAds] Quota exceeded during show attempt');
        return;
      }
      
      console.log(`[BrandiaAds] Showing ad: ${campaign.id} for supplier ${supplierId}`);
      
      // Créer l'overlay
      const overlay = document.createElement('div');
      overlay.id = 'brandia-ad-overlay';
      overlay.className = 'fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      const isVideo = campaign.media_type === 'video';
      const mediaHtml = isVideo 
        ? `<video src="${campaign.media_url}" muted playsinline class="w-full h-full object-cover" id="ad-video"></video>`
        : `<img src="${campaign.media_url}" class="w-full h-full object-cover" alt="${campaign.headline}">`;

      // 🔥 Indicateur de quota si > 1
      const quota = BrandQuotaManager.quotas[supplierId];
      const quotaIndicator = quota.maxAllowed > 1 
        ? `<span class="text-xs text-slate-500 ml-2">(${quota.shownCount + 1}/${quota.maxAllowed})</span>` 
        : '';

      overlay.innerHTML = `
        <div class="ad-container w-full max-w-lg bg-slate-900 rounded-t-2xl overflow-hidden shadow-2xl transform translate-y-full transition-transform duration-300" style="max-height: 50vh; border-top: 3px solid #6366f1;">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
            <div class="flex items-center">
              <span class="text-xs text-indigo-400 font-medium flex items-center">
                <i class="fas fa-ad mr-1.5"></i> Contenu proposé par la marque
              </span>
              ${quotaIndicator}
            </div>
            <button id="ad-close-btn" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Media -->
          <div class="relative aspect-video bg-slate-800 max-h-[200px]">
            ${mediaHtml}
            ${isVideo ? `
              <div class="absolute bottom-3 right-3 px-2.5 py-1 bg-black/80 rounded-lg text-xs text-white font-mono">
                <i class="fas fa-clock mr-1"></i><span id="ad-timer">15</span>s
              </div>
            ` : ''}
          </div>
          
          <!-- Content -->
          <div class="p-4 space-y-3">
            <div>
              <h3 class="text-lg font-bold text-white mb-1 leading-tight">${campaign.headline}</h3>
              <p class="text-sm text-slate-400 line-clamp-2">${campaign.description || 'Découvrez cette offre exclusive'}</p>
            </div>
            
            <a href="${campaign.cta_link || '#'}" 
               id="ad-cta-btn"
               class="block w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-center rounded-xl font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25">
              ${campaign.cta_text || 'Voir l\'offre'}
              <i class="fas fa-arrow-right ml-2 text-sm"></i>
            </a>
            
            ${quota.maxAllowed > 1 ? `
              <p class="text-xs text-center text-slate-500">
                ${quota.shownCount + 1} sur ${quota.maxAllowed} messages de cette marque
              </p>
            ` : ''}
          </div>
          
          <!-- Progress bar -->
          <div class="h-1 bg-slate-800">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-violet-500" id="ad-progress" style="width: 100%; transition: width ${CONFIG.overlayDuration}ms linear;"></div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      
      // Animation d'entrée
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        const container = overlay.querySelector('.ad-container');
        if (container) container.style.transform = 'translateY(0)';
        
        // Démarrer la barre de progression
        setTimeout(() => {
          const progress = document.getElementById('ad-progress');
          if (progress) progress.style.width = '0%';
        }, 50);
      });

      // Event listeners
      const closeBtn = document.getElementById('ad-close-btn');
      const ctaBtn = document.getElementById('ad-cta-btn');

      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeAd('dismissed');
      });

      ctaBtn.addEventListener('click', (e) => {
        // Laisser le lien fonctionner mais tracker
        this.trackClick();
        this.closeAd('clicked');
      });

      // Fermer sur clic backdrop
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeAd('dismissed');
        }
      });

      // Touche Echap
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeAd('dismissed');
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      // Pour les vidéos
      if (isVideo) {
        const video = document.getElementById('ad-video');
        if (video) {
          video.play().catch(() => {});
          this.startTimer(video);
        }
      } else {
        // Timer pour images aussi (15s auto-close)
        this.startTimer(null);
      }

      // 🔥 Mettre à jour les compteurs
      AdsStorage.markCampaignSeen(campaign.id);
      BrandQuotaManager.incrementShown(supplierId);
      this.trackView(campaign.id);
    },

    startTimer: function(video) {
      this.state.countdown = 15;
      const timerEl = document.getElementById('ad-timer');
      
      this.state.timer = setInterval(() => {
        this.state.countdown--;
        if (timerEl) timerEl.textContent = this.state.countdown;
        
        if (this.state.countdown <= 0) {
          this.closeAd('completed');
        }
      }, 1000);

      // Fermer si vidéo finie avant les 15s
      if (video) {
        video.onended = () => {
          setTimeout(() => this.closeAd('completed'), 500);
        };
      }
    },

    closeAd: function(reason = 'unknown') {
      console.log(`[BrandiaAds] Closing ad: ${reason}`);
      
      if (this.state.timer) {
        clearInterval(this.state.timer);
        this.state.timer = null;
      }

      // Si fermé manuellement, marquer toute la marque comme "dismissed"
      if (reason === 'dismissed' && this.state.currentSupplierId) {
        BrandQuotaManager.markDismissed(this.state.currentSupplierId);
      }

      const overlay = document.getElementById('brandia-ad-overlay');
      if (overlay) {
        overlay.style.opacity = '0';
        const container = overlay.querySelector('.ad-container');
        if (container) {
          container.style.transform = 'translateY(100%)';
        }
        
        setTimeout(() => {
          overlay.remove();
          this.state.currentCampaign = null;
        }, 300);
      }
    },

    trackView: async function(campaignId) {
      try {
        await fetch(CONFIG.apiEndpoints.trackView, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId })
        });
      } catch (e) {
        console.error('[BrandiaAds] Track view error:', e);
      }
    },

    trackClick: async function() {
      if (!this.state.currentCampaign) return;
      
      try {
        await fetch(CONFIG.apiEndpoints.trackClick, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: this.state.currentCampaign.id })
        });
      } catch (e) {
        console.error('[BrandiaAds] Track click error:', e);
      }
    },

    // 🔥 API publique pour debug
    debug: function() {
      return {
        state: this.state,
        quotas: BrandQuotaManager.quotas,
        canShowFor: (supplierId) => BrandQuotaManager.canShowAd(supplierId)
      };
    },

    reset: function() {
      BrandQuotaManager.reset();
      AdsStorage.reset && AdsStorage.reset();
      console.log('[BrandiaAds] Reset complete');
    }
  };

  // Exposer globalement
  window.BrandiaAds = BrandiaAds;
  
  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BrandiaAds.init());
  } else {
    BrandiaAds.init();
  }

  console.log('[BrandiaAds] Loaded v3.0 - Quota Variable System');
})();