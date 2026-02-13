// ============================================
// BRANDIA ADS SYSTEM - v2.0 PUBLIC (sans auth)
// S'affiche pour TOUS les visiteurs (client/fournisseur/anonyme)
// ============================================

(function() {
  'use strict';
  
  // Éviter double chargement
  if (window.BrandiaAds) return;

  const API_BASE = 'https://brandia-1.onrender.com/api';
  
  // Session storage pour respecter "1x par session"
  const AdsStorage = {
    getSeenCampaigns: () => {
      try {
        return JSON.parse(sessionStorage.getItem('brandia_seen_campaigns') || '[]');
      } catch {
        return [];
      }
    },
    markCampaignSeen: (campaignId) => {
      const seen = AdsStorage.getSeenCampaigns();
      if (!seen.includes(campaignId)) {
        seen.push(campaignId);
        sessionStorage.setItem('brandia_seen_campaigns', JSON.stringify(seen));
      }
    },
    hasSeenCampaign: (campaignId) => {
      return AdsStorage.getSeenCampaigns().includes(campaignId);
    },
    reset: () => {
      sessionStorage.removeItem('brandia_seen_campaigns');
    }
  };

  const BrandiaAds = {
    state: {
      currentCampaign: null,
      isPlaying: false,
      timer: null,
      countdown: 15
    },

    // 🔥 POINT CLÉ : Récupérer supplier_id depuis le produit, pas depuis l'auth
    init: async function() {
      console.log('[BrandiaAds] Initializing...');
      
      // Récupérer IDs depuis l'URL
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');
      
      if (!productId) {
        console.log('[BrandiaAds] No product ID, skipping');
        return;
      }

      try {
        // 1. D'abord récupérer les infos du produit pour avoir le supplier_id
        const productResponse = await fetch(`${API_BASE}/products/${productId}`);
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

        console.log('[BrandiaAds] Product:', productId, 'Supplier:', supplierId);

        // 2. Récupérer la campagne active pour ce fournisseur ET ce produit
        const campaignResponse = await fetch(
          `${API_BASE}/public/campaigns?supplier=${supplierId}&product=${productId}`
        );
        const campaignData = await campaignResponse.json();

        if (!campaignData.success || !campaignData.data) {
          console.log('[BrandiaAds] No active campaign');
          return;
        }

        const campaign = campaignData.data;
        
        // 3. Vérifier si déjà vue cette session
        if (AdsStorage.hasSeenCampaign(campaign.id)) {
          console.log('[BrandiaAds] Already seen this session');
          return;
        }

        // 4. Vérifier dates de validité
        const now = new Date();
        const startDate = new Date(campaign.start_date);
        const endDate = new Date(campaign.end_date);
        
        if (now < startDate || now > endDate) {
          console.log('[BrandiaAds] Campaign not active (dates)');
          return;
        }

        console.log('[BrandiaAds] Campaign found:', campaign.id);
        this.state.currentCampaign = campaign;
        
        // 5. Afficher après un délai (UX : laisser voir le produit d'abord)
        setTimeout(() => {
          this.showAd(campaign);
        }, 2000); // 2 secondes après chargement

      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
      }
    },

    showAd: function(campaign) {
      if (!campaign || AdsStorage.hasSeenCampaign(campaign.id)) return;
      
      console.log('[BrandiaAds] Showing ad:', campaign.id);
      
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
        ? `<video src="${campaign.media_url}" muted playsinline class="w-full h-full object-cover"></video>`
        : `<img src="${campaign.media_url}" class="w-full h-full object-cover" alt="${campaign.headline}">`;

      overlay.innerHTML = `
        <div class="ad-container w-full max-w-lg bg-slate-900 rounded-t-2xl overflow-hidden shadow-2xl transform translate-y-full transition-transform duration-300" style="max-height: 45vh;">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 bg-slate-800/50">
            <span class="text-xs text-indigo-400 font-medium">
              <i class="fas fa-ad mr-1"></i> Contenu proposé par la marque
            </span>
            <button onclick="BrandiaAds.closeAd()" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Media -->
          <div class="relative aspect-video bg-slate-800">
            ${mediaHtml}
            ${isVideo ? `
              <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                <span id="ad-timer">15</span>s
              </div>
            ` : ''}
          </div>
          
          <!-- Content -->
          <div class="p-4">
            <h3 class="text-lg font-bold text-white mb-1">${campaign.headline}</h3>
            <p class="text-sm text-slate-400 mb-3 line-clamp-2">${campaign.description || ''}</p>
            <a href="${campaign.cta_link || '#'}" 
               onclick="BrandiaAds.trackClick()"
               class="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-center rounded-lg font-medium transition-colors">
              ${campaign.cta_text || 'Voir l\'offre'}
            </a>
          </div>
          
          <!-- Progress bar for video -->
          ${isVideo ? '<div class="h-1 bg-indigo-600" id="ad-progress" style="width: 100%;"></div>' : ''}
        </div>
      `;

      document.body.appendChild(overlay);
      
      // Animation d'entrée
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('.ad-container').style.transform = 'translateY(0)';
      });

      // Gestion fermeture
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeAd();
      });
      
      // Touche Echap
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeAd();
      });

      // Pour les vidéos : démarrer et timer
      if (isVideo) {
        const video = overlay.querySelector('video');
        video.play().catch(() => {});
        this.startTimer(video);
      }

      // Marquer comme vue
      AdsStorage.markCampaignSeen(campaign.id);
      this.trackView(campaign.id);
    },

    startTimer: function(video) {
      this.state.countdown = 15;
      const timerEl = document.getElementById('ad-timer');
      const progressEl = document.getElementById('ad-progress');
      
      this.state.timer = setInterval(() => {
        this.state.countdown--;
        if (timerEl) timerEl.textContent = this.state.countdown;
        if (progressEl) {
          progressEl.style.width = `${(this.state.countdown / 15) * 100}%`;
        }
        
        if (this.state.countdown <= 0) {
          this.closeAd();
        }
      }, 1000);

      // Fermer quand vidéo finie
      video.onended = () => this.closeAd();
    },

    closeAd: function() {
      console.log('[BrandiaAds] Closing ad');
      
      if (this.state.timer) {
        clearInterval(this.state.timer);
        this.state.timer = null;
      }

      const overlay = document.getElementById('brandia-ad-overlay');
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.querySelector('.ad-container').style.transform = 'translateY(100%)';
        setTimeout(() => overlay.remove(), 300);
      }
    },

    trackView: async function(campaignId) {
      try {
        await fetch(`${API_BASE}/public/campaigns/view`, {
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
        await fetch(`${API_BASE}/public/campaigns/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: this.state.currentCampaign.id })
        });
      } catch (e) {
        console.error('[BrandiaAds] Track click error:', e);
      }
      
      this.closeAd();
    }
  };

  // Exposer globalement
  window.BrandiaAds = BrandiaAds;
  
  // Auto-init si sur page produit
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BrandiaAds.init());
  } else {
    BrandiaAds.init();
  }

  console.log('[BrandiaAds] Loaded v2.0 - Public Mode');
})();