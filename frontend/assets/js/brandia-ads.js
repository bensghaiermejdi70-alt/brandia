// ============================================
// BRANDIA ADS SYSTEM - v3.1 CORRIGÉ
// Fix: Dépendances, déclenchement, et gestion d'erreurs
// ============================================

(function() {
  'use strict';
  
  // Éviter double chargement
  if (window.BrandiaAds && window.BrandiaAds.version === '3.1') return;

  // Attendre que BrandiaAPI soit disponible
  function waitForAPI(callback, maxAttempts = 50) {
    let attempts = 0;
    const check = () => {
      attempts++;
      if (window.BrandiaAPI && window.BrandiaAPI.Supplier) {
        console.log('[BrandiaAds] BrandiaAPI found after', attempts, 'attempts');
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 100);
      } else {
        console.error('[BrandiaAds] BrandiaAPI not available after', maxAttempts, 'attempts');
        // Fallback mode - afficher quand même si possible
        callback(true); // true = fallback mode
      }
    };
    check();
  }

  const CONFIG = {
    overlayDuration: 15000,
    initDelay: 2000,
    fallbackAPI: 'https://brandia-1.onrender.com/api'
  };

  // Session storage
  const AdsStorage = {
    getSeenCampaigns: () => {
      try {
        return JSON.parse(sessionStorage.getItem('brandia_seen_campaigns_v3') || '[]');
      } catch { return []; }
    },
    markCampaignSeen: (campaignId) => {
      const seen = AdsStorage.getSeenCampaigns();
      if (!seen.includes(campaignId)) {
        seen.push(campaignId);
        sessionStorage.setItem('brandia_seen_campaigns_v3', JSON.stringify(seen));
      }
    },
    hasSeenCampaign: (campaignId) => AdsStorage.getSeenCampaigns().includes(campaignId),
    reset: () => sessionStorage.removeItem('brandia_seen_campaigns_v3')
  };

  const BrandiaAds = {
    version: '3.1',
    state: {
      currentCampaign: null,
      currentSupplierId: null,
      isPlaying: false,
      timer: null,
      countdown: 15,
      apiAvailable: false
    },

    init: function(fallbackMode = false) {
      console.log('[BrandiaAds] Initializing v3.1...', fallbackMode ? '(fallback mode)' : '');
      
      this.state.apiAvailable = !fallbackMode && !!window.BrandiaAPI;
      
      // Récupérer IDs depuis l'URL
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');
      
      if (!productId) {
        console.log('[BrandiaAds] No product ID, skipping');
        return;
      }

      console.log('[BrandiaAds] Product ID:', productId);

      // Mode fallback ou API disponible
      if (fallbackMode) {
        this.initFallback(productId);
      } else {
        this.initWithAPI(productId);
      }
    },

    initFallback: function(productId) {
      // En mode fallback, on essaie quand même avec fetch direct
      console.log('[BrandiaAds] Attempting direct API call...');
      
      const apiBase = CONFIG.fallbackAPI;
      
      // Récupérer le produit d'abord
      fetch(`${apiBase}/products/${productId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success || !data.data) {
            console.log('[BrandiaAds] Product not found in fallback');
            return;
          }
          
          const product = data.data.product || data.data;
          const supplierId = product.supplier_id;
          
          if (!supplierId) {
            console.log('[BrandiaAds] No supplier_id');
            return;
          }

          console.log('[BrandiaAds] Fallback - Supplier:', supplierId);
          
          // Puis la campagne
          return fetch(`${apiBase}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`);
        })
        .then(r => r ? r.json() : null)
        .then(campaignData => {
          if (campaignData && campaignData.success && campaignData.data) {
            this.showAd(campaignData.data, null); // null = pas de supplierId connu
          }
        })
        .catch(err => console.error('[BrandiaAds] Fallback error:', err));
    },

    initWithAPI: async function(productId) {
      try {
        // 1. Récupérer les infos du produit
        const productResponse = await BrandiaAPI.Products.getById(productId);
        
        if (!productResponse.success || !productResponse.data) {
          console.log('[BrandiaAds] Product not found');
          return;
        }
        
        const product = productResponse.data.product || productResponse.data;
        const supplierId = product.supplier_id;
        
        if (!supplierId) {
          console.log('[BrandiaAds] No supplier for this product');
          return;
        }

        this.state.currentSupplierId = supplierId;
        console.log(`[BrandiaAds] Product: ${productId} | Supplier: ${supplierId}`);

        // 2. Vérifier si déjà vu cette session
        const sessionKey = `ad_seen_supplier_${supplierId}`;
        if (sessionStorage.getItem(sessionKey)) {
          console.log('[BrandiaAds] Already seen for this supplier this session');
          return;
        }

        // 3. Récupérer la campagne
        const campaignResponse = await BrandiaAPI.Supplier.getPublicCampaign(supplierId, productId);
        
        if (!campaignResponse.success || !campaignResponse.data) {
          console.log('[BrandiaAds] No active campaign');
          return;
        }

        const campaign = campaignResponse.data;
        
        // 4. Vérifier si cette campagne déjà vue
        if (AdsStorage.hasSeenCampaign(campaign.id)) {
          console.log('[BrandiaAds] Campaign already seen');
          return;
        }

        // 5. Vérifier dates
        const now = new Date();
        const startDate = new Date(campaign.start_date);
        const endDate = new Date(campaign.end_date);
        
        if (now < startDate || now > endDate) {
          console.log('[BrandiaAds] Campaign not active (dates)');
          return;
        }

        console.log(`[BrandiaAds] Campaign found: ${campaign.id}`);

        // 6. Afficher après délai UX
        setTimeout(() => {
          this.showAd(campaign, supplierId);
        }, CONFIG.initDelay);

      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
        // Tentative fallback
        this.initFallback(productId);
      }
    },

    showAd: function(campaign, supplierId) {
      if (!campaign || AdsStorage.hasSeenCampaign(campaign.id)) return;
      
      console.log(`[BrandiaAds] Showing ad: ${campaign.id}`);
      
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
        : `<img src="${campaign.media_url}" class="w-full h-full object-cover" alt="${campaign.headline}" onerror="this.src='https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'">`;

      overlay.innerHTML = `
        <div class="ad-container w-full max-w-lg bg-slate-900 rounded-t-2xl overflow-hidden shadow-2xl transform translate-y-full transition-transform duration-300" style="max-height: 50vh; border-top: 3px solid #6366f1;">
          <div class="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
            <span class="text-xs text-indigo-400 font-medium flex items-center">
              <i class="fas fa-ad mr-1.5"></i> Contenu proposé par la marque
            </span>
            <button id="ad-close-btn" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="relative aspect-video bg-slate-800 max-h-[200px]">
            ${mediaHtml}
            ${isVideo ? `
              <div class="absolute bottom-3 right-3 px-2.5 py-1 bg-black/80 rounded-lg text-xs text-white font-mono">
                <i class="fas fa-clock mr-1"></i><span id="ad-timer">15</span>s
              </div>
            ` : ''}
          </div>
          
          <div class="p-4 space-y-3">
            <div>
              <h3 class="text-lg font-bold text-white mb-1 leading-tight">${campaign.headline || 'Offre spéciale'}</h3>
              <p class="text-sm text-slate-400 line-clamp-2">${campaign.description || 'Découvrez cette offre exclusive'}</p>
            </div>
            
            <a href="${campaign.cta_link || '#'}" 
               id="ad-cta-btn"
               class="block w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-center rounded-xl font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25">
              ${campaign.cta_text || 'Voir l\'offre'}
              <i class="fas fa-arrow-right ml-2 text-sm"></i>
            </a>
          </div>
          
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
        this.closeAd('dismissed', supplierId);
      });

      ctaBtn.addEventListener('click', () => {
        this.trackClick(campaign.id);
        this.closeAd('clicked', supplierId);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeAd('dismissed', supplierId);
        }
      });

      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeAd('dismissed', supplierId);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      // Timer
      if (isVideo) {
        const video = document.getElementById('ad-video');
        if (video) {
          video.play().catch(() => {});
          this.startTimer(video);
          video.onended = () => setTimeout(() => this.closeAd('completed', supplierId), 500);
        }
      } else {
        this.startTimer(null);
        setTimeout(() => this.closeAd('completed', supplierId), CONFIG.overlayDuration);
      }

      // Tracking
      AdsStorage.markCampaignSeen(campaign.id);
      if (supplierId) {
        sessionStorage.setItem(`ad_seen_supplier_${supplierId}`, 'true');
      }
      this.trackView(campaign.id);
    },

    startTimer: function(video) {
      this.state.countdown = 15;
      const timerEl = document.getElementById('ad-timer');
      
      this.state.timer = setInterval(() => {
        this.state.countdown--;
        if (timerEl) timerEl.textContent = this.state.countdown;
        
        if (this.state.countdown <= 0) {
          clearInterval(this.state.timer);
        }
      }, 1000);
    },

    closeAd: function(reason, supplierId) {
      console.log(`[BrandiaAds] Closing ad: ${reason}`);
      
      if (this.state.timer) {
        clearInterval(this.state.timer);
        this.state.timer = null;
      }

      const overlay = document.getElementById('brandia-ad-overlay');
      if (overlay) {
        overlay.style.opacity = '0';
        const container = overlay.querySelector('.ad-container');
        if (container) container.style.transform = 'translateY(100%)';
        
        setTimeout(() => {
          overlay.remove();
          this.state.currentCampaign = null;
        }, 300);
      }
    },

    trackView: async function(campaignId) {
      if (!window.BrandiaAPI) return;
      try {
        await BrandiaAPI.Supplier.trackCampaignView(campaignId);
      } catch (e) {}
    },

    trackClick: async function(campaignId) {
      if (!window.BrandiaAPI) return;
      try {
        await BrandiaAPI.Supplier.trackCampaignClick(campaignId);
      } catch (e) {}
    },

    debug: function() {
      return {
        state: this.state,
        storage: AdsStorage.getSeenCampaigns()
      };
    },

    reset: function() {
      AdsStorage.reset();
      console.log('[BrandiaAds] Reset complete');
    }
  };

  // Exposer globalement
  window.BrandiaAds = BrandiaAds;
  
  // Démarrage avec attente de l'API
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForAPI((fallback) => BrandiaAds.init(fallback));
    });
  } else {
    waitForAPI((fallback) => BrandiaAds.init(fallback));
  }

  console.log('[BrandiaAds] Loader v3.1 ready - waiting for BrandiaAPI...');
})();