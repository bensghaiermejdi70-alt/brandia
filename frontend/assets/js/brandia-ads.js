// ============================================
// BRANDIA ADS SYSTEM - Publicité Contextuelle v3.2 CORRIGÉ
// ============================================

(function() {
  'use strict';
  
  if (window.brandiaAds) {
    console.log('[BrandiaAds] Already loaded');
    return;
  }

  const BrandiaAds = {
    state: {
      currentCampaign: null,
      timer: null,
      progressInterval: null,
      timeLeft: 15,
      isPlaying: false
    },

    // ==========================================
    // VÉRIFICATION ET AFFICHAGE
    // ==========================================
    checkAndShow: async function(productId, supplierId) {
      console.log('[BrandiaAds] Checking for ad:', { productId, supplierId });
      
      if (!productId || !supplierId) {
        console.warn('[BrandiaAds] Missing parameters');
        return;
      }

      // Vérifier si déjà vue cette session
      const sessionKey = `ad_seen_${supplierId}_${productId}`;
      if (sessionStorage.getItem(sessionKey)) {
        console.log('[BrandiaAds] Already seen this session');
        return;
      }

      try {
        // Appel API pour récupérer la campagne active
        const baseURL = window.BrandiaAPI?.config?.apiURL || 'https://brandia-1.onrender.com/api';
        const url = `${baseURL}/public/campaigns?supplier=${supplierId}&product=${productId}`;
        
        console.log('[BrandiaAds] Fetching:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        console.log('[BrandiaAds] API Response:', result);

        if (!result.success || !result.data) {
          console.log('[BrandiaAds] No active campaign found');
          return;
        }

        const campaign = result.data;
        
        // Vérifier si la campagne cible bien ce produit
        const targetProducts = campaign.target_products || [];
        if (targetProducts.length > 0 && !targetProducts.includes(parseInt(productId))) {
          console.log('[BrandiaAds] Product not in target list');
          return;
        }

        // Afficher la publicité
        this.show(campaign, sessionKey);

      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
      }
    },

    // ==========================================
    // AFFICHAGE DE LA PUBLICITÉ (CORRIGÉ)
    // ==========================================
    show: function(campaign, sessionKey) {
      console.log('[BrandiaAds] Showing campaign:', campaign.name);
      
      this.state.currentCampaign = campaign;
      this.state.timeLeft = 15;
      
      const overlay = document.getElementById('brandia-ad-overlay');
      const mediaContainer = document.getElementById('ad-media-container');
      const headline = document.getElementById('ad-headline');
      const description = document.getElementById('ad-description');
      const cta = document.getElementById('ad-cta');
      
      console.log('[BrandiaAds] DOM elements:', {
        overlay: !!overlay,
        mediaContainer: !!mediaContainer,
        headline: !!headline,
        description: !!description,
        cta: !!cta
      });

      if (!overlay) {
        console.error('[BrandiaAds] Overlay not found in DOM!');
        return;
      }

      // Marquer comme vue cette session
      sessionStorage.setItem(sessionKey, 'true');

      // Remplir le contenu
      if (headline) headline.textContent = campaign.headline || 'Offre spéciale';
      if (description) description.textContent = campaign.description || '';
      if (cta) {
        cta.href = campaign.cta_link || '#';
        const ctaText = cta.querySelector('span');
        if (ctaText) ctaText.textContent = campaign.cta_text || 'Voir l\'offre';
      }

      // Media (image ou vidéo)
      if (mediaContainer) {
        mediaContainer.innerHTML = '';
        
        if (campaign.media_type === 'video' && campaign.media_url) {
          // Vidéo
          const video = document.createElement('video');
          video.src = campaign.media_url;
          video.className = 'brandia-ad-video';
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.controls = true;
          
          video.onloadeddata = () => {
            console.log('[BrandiaAds] Video loaded');
            video.play().catch(e => console.warn('[BrandiaAds] Autoplay blocked:', e));
          };
          
          video.onerror = () => {
            console.error('[BrandiaAds] Video error');
            this.showImageFallback(campaign, mediaContainer);
          };
          
          mediaContainer.appendChild(video);
          this.state.isPlaying = true;
          
        } else if (campaign.media_url) {
          // Image
          const img = document.createElement('img');
          img.src = campaign.media_url;
          img.className = 'brandia-ad-media';
          img.alt = campaign.headline || 'Publicité';
          img.onerror = () => {
            this.showImageFallback(campaign, mediaContainer);
          };
          mediaContainer.appendChild(img);
          
        } else {
          // Fallback
          this.showImageFallback(campaign, mediaContainer);
        }
      }

      // 🔥 CORRECTION CRITIQUE : Afficher l'overlay avec display flex
      overlay.style.display = 'flex';
      overlay.classList.add('active');
      
      console.log('[BrandiaAds] Overlay activated:', overlay.className, overlay.style.display);

      document.body.style.overflow = 'hidden';

      // Démarrer le timer
      this.startTimer();

      // Tracker la vue
      this.trackView(campaign.id);
    },

    showImageFallback: function(campaign, container) {
      container.innerHTML = `
        <div class="brandia-ad-media flex items-center justify-center bg-gradient-to-br from-pink-500/20 to-violet-600/20">
          <div class="text-center p-8">
            <i class="fas fa-bullhorn text-5xl text-pink-500 mb-4"></i>
            <p class="text-white font-bold text-lg">${campaign.headline || 'Offre spéciale'}</p>
          </div>
        </div>
      `;
    },

    // ==========================================
    // TIMER ET PROGRESSION
    // ==========================================
    startTimer: function() {
      const timerText = document.getElementById('ad-timer-text');
      const progress = document.getElementById('ad-progress');
      
      this.state.timeLeft = 15;
      
      // Mettre à jour immédiatement
      if (timerText) timerText.textContent = '15s';
      if (progress) progress.style.width = '100%';
      
      this.state.progressInterval = setInterval(() => {
        this.state.timeLeft--;
        
        if (timerText) {
          timerText.textContent = this.state.timeLeft + 's';
        }
        
        if (progress) {
          const percentage = (this.state.timeLeft / 15) * 100;
          progress.style.width = percentage + '%';
        }
        
        if (this.state.timeLeft <= 0) {
          this.close();
        }
      }, 1000);
    },

    // ==========================================
    // FERMETURE
    // ==========================================
    close: function() {
      console.log('[BrandiaAds] Closing ad');
      
      if (this.state.progressInterval) {
        clearInterval(this.state.progressInterval);
        this.state.progressInterval = null;
      }

      const video = document.querySelector('#ad-media-container video');
      if (video) {
        video.pause();
        video.src = '';
      }

      const overlay = document.getElementById('brandia-ad-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
      }
      
      document.body.style.overflow = '';
      this.state.currentCampaign = null;
      this.state.isPlaying = false;
    },

    // ==========================================
    // TRACKING
    // ==========================================
    trackView: async function(campaignId) {
      try {
        const baseURL = window.BrandiaAPI?.config?.apiURL || 'https://brandia-1.onrender.com/api';
        await fetch(`${baseURL}/public/campaigns/track-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId })
        });
        console.log('[BrandiaAds] View tracked:', campaignId);
      } catch (error) {
        console.error('[BrandiaAds] Track view error:', error);
      }
    },

    trackClick: async function() {
      const campaign = this.state.currentCampaign;
      if (!campaign) return true; // Laisser le lien fonctionner quand même

      try {
        const baseURL = window.BrandiaAPI?.config?.apiURL || 'https://brandia-1.onrender.com/api';
        await fetch(`${baseURL}/public/campaigns/track-click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaign.id })
        });
        console.log('[BrandiaAds] Click tracked:', campaign.id);
      } catch (error) {
        console.error('[BrandiaAds] Track click error:', error);
      }
      
      this.close();
      return true; // Permettre la navigation
    }
  };

  window.brandiaAds = BrandiaAds;
  console.log('[BrandiaAds] System loaded v3.2');
})();