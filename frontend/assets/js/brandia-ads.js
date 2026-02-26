// ============================================
// BRANDIA ADS SYSTEM - v3.6 EMERGENCY FIX
// Fix: Désactivation totale des vidéos - Images uniquement
// ============================================
(function() {
  'use strict';
  
  if (window.BrandiaAds && window.BrandiaAds.version === '3.6') return;
  
  function waitForAPI(callback, maxAttempts = 50) {
    let attempts = 0;
    const check = () => {
      attempts++;
      if (window.BrandiaAPI && window.BrandiaAPI.Supplier) {
        callback(false);
      } else if (attempts < maxAttempts) {
        setTimeout(check, 100);
      } else {
        callback(true);
      }
    };
    check();
  }
  
  const CONFIG = {
    overlayDuration: 15000,
    initDelay: 2000,
    fallbackAPI: 'https://brandia-1.onrender.com/api',
    fallbackImage: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&auto=format&fit=crop&q=80'
  };
  
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
  
  // 🔥 FONCTION UTILITAIRE : Convertir n'importe quelle URL en image sûre
  function getSafeImageUrl(mediaUrl, mediaType) {
    if (!mediaUrl || mediaUrl === 'null' || mediaUrl === 'undefined') {
      console.log('[BrandiaAds] Using fallback image');
      return CONFIG.fallbackImage;
    }
    
    // Si c'est une vidéo, convertir en image
    if (mediaType === 'video' || mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('.webm')) {
      console.log('[BrandiaAds] Converting video to image:', mediaUrl);
      
      // Extraction ID Cloudinary et conversion en image
      try {
        // Pattern: https://res.cloudinary.com/.../upload/v.../brandia/campaigns/xxx.mp4
        const match = mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.(mp4|mov|webm)/i);
        if (match) {
          const basePath = match[1];
          // Créer URL image avec transformation Cloudinary
          const imageUrl = `https://res.cloudinary.com/dsm9w1jzx/image/upload/c_fill,w_600,h_400,q_auto/${basePath}.jpg`;
          console.log('[BrandiaAds] Converted to:', imageUrl);
          return imageUrl;
        }
      } catch (e) {
        console.error('[BrandiaAds] Conversion error:', e);
      }
      
      // Fallback si échec conversion
      return CONFIG.fallbackImage;
    }
    
    // C'est déjà une image
    return mediaUrl;
  }
  
  const BrandiaAds = {
    version: '3.6',
    state: {
      currentCampaign: null,
      currentSupplierId: null,
      isPlaying: false,
      timer: null,
      countdown: 15,
      apiAvailable: false,
      isClosed: false
    },
    
    init: function(fallbackMode = false) {
      console.log('[BrandiaAds] Initializing v3.6 (VIDEO DISABLED)...');
      this.state.apiAvailable = !fallbackMode && !!window.BrandiaAPI;
      this.state.isClosed = false;
      
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');
      
      if (!productId) {
        console.log('[BrandiaAds] No product ID, skipping');
        return;
      }
      
      console.log('[BrandiaAds] Product ID:', productId);
      
      if (fallbackMode) {
        this.initFallback(productId);
      } else {
        this.initWithAPI(productId);
      }
    },
    
    initFallback: function(productId) {
      const self = this;
      const apiBase = CONFIG.fallbackAPI;
      
      fetch(`${apiBase}/products/${productId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success || !data.data) return;
          const product = data.data.product || data.data;
          const supplierId = product.supplier_id;
          if (!supplierId) return;
          return fetch(`${apiBase}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`);
        })
        .then(r => r ? r.json() : null)
        .then(campaignData => {
          if (campaignData?.success && campaignData.data) {
            self.showAd(campaignData.data, null);
          }
        })
        .catch(err => console.error('[BrandiaAds] Fallback error:', err));
    },
    
    initWithAPI: async function(productId) {
      const self = this;
      
      try {
        const productResponse = await fetch(`${CONFIG.fallbackAPI}/products/${productId}`);
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
        
        const sessionKey = `ad_seen_supplier_${supplierId}`;
        if (sessionStorage.getItem(sessionKey)) {
          console.log('[BrandiaAds] Already seen for this supplier');
          return;
        }
        
        const campaignResponse = await fetch(
          `${CONFIG.fallbackAPI}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`
        );
        const campaignData = await campaignResponse.json();
        
        if (!campaignData.success || !campaignData.data) {
          console.log('[BrandiaAds] No active campaign');
          return;
        }
        
        const campaign = campaignData.data;
        
        if (AdsStorage.hasSeenCampaign(campaign.id)) {
          console.log('[BrandiaAds] Campaign already seen');
          return;
        }
        
        const now = new Date();
        const startDate = new Date(campaign.start_date);
        const endDate = new Date(campaign.end_date);
        
        if (now < startDate || now > endDate) {
          console.log('[BrandiaAds] Campaign not active (dates)');
          return;
        }
        
        console.log(`[BrandiaAds] Campaign found: ${campaign.id}, Type: ${campaign.media_type}`);
        
        setTimeout(() => {
          self.showAd(campaign, supplierId);
        }, CONFIG.initDelay);
        
      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
        this.initFallback(productId);
      }
    },
    
    showAd: function(campaign, supplierId) {
      if (!campaign || AdsStorage.hasSeenCampaign(campaign.id) || this.state.isClosed) return;
      
      const self = this;
      console.log(`[BrandiaAds] Showing ad: ${campaign.id}`);
      
      // 🔥 CONVERSION FORCÉE EN IMAGE (peu importe le type)
      const safeImageUrl = getSafeImageUrl(campaign.media_url, campaign.media_type);
      console.log('[BrandiaAds] Safe image URL:', safeImageUrl);
      
      const wrapper = document.createElement('div');
      wrapper.id = 'brandia-ad-wrapper';
      wrapper.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(10px);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      
      wrapper.innerHTML = `
        <div id="brandia-ad-container" style="
          width: 92%; max-width: 480px; max-height: 85vh;
          background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
          border-radius: 24px; overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.4);
          transform: scale(0.9) translateY(30px);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex; flex-direction: column;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid rgba(99, 102, 241, 0.2);">
            <span style="font-size: 13px; color: #818cf8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-sparkles" style="color: #ec4899;"></i> Sponsorisé
            </span>
            <button id="ad-close-btn" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 16px;" onmouseover="this.style.background='rgba(239,68,68,0.4)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(239,68,68,0.2)'; this.style.transform='scale(1)'">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div style="position: relative; width: 100%; height: 280px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); overflow: hidden;">
            <img id="ad-media-img" src="${safeImageUrl}" 
                 style="width: 100%; height: 100%; object-fit: cover; display: block;" 
                 alt="${campaign.headline || 'Publicité'}"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;\\'><i class=\\'fas fa-image\\' style=\\'font-size:48px;\\'></i></div>';">
            
            ${campaign.media_type === 'video' ? `
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;">
              <div style="width: 70px; height: 70px; background: rgba(236, 72, 153, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(236, 72, 153, 0.4);">
                <i class="fas fa-play" style="color: white; font-size: 28px; margin-left: 5px;"></i>
              </div>
            </div>
            ` : ''}
            
            <div style="position: absolute; bottom: 16px; right: 16px; background: rgba(0,0,0,0.85); color: white; padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.1);">
              <i class="fas fa-clock" style="color: #ec4899;"></i> <span id="ad-timer">15</span>s
            </div>
          </div>
          
          <div style="padding: 24px;">
            <h3 style="font-size: 22px; font-weight: 800; color: white; margin-bottom: 10px; line-height: 1.3; letter-spacing: -0.2px;">${campaign.headline || 'Offre spéciale'}</h3>
            <p style="font-size: 15px; color: #94a3b8; margin-bottom: 24px; line-height: 1.6;">${campaign.description || 'Découvrez cette offre exclusive de la marque'}</p>
            
            <a href="${campaign.cta_link || '#'}" id="ad-cta-btn" style="display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; text-align: center; border-radius: 14px; font-weight: 700; text-decoration: none; transition: all 0.3s; border: none; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 30px -5px rgba(236,72,153,0.5)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 15px rgba(236, 72, 153, 0.3)'">
              ${campaign.cta_text || "Voir l'offre"} <i class="fas fa-arrow-right" style="margin-left: 10px; transition: transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'"></i>
            </a>
            
            <p style="margin-top: 18px; font-size: 12px; color: #64748b; text-align: center; font-weight: 500;">
              <i class="fas fa-info-circle" style="margin-right: 6px;"></i> Contenu proposé par la marque que vous consultez
            </p>
          </div>
          
          <div style="height: 4px; background: #1e293b; width: 100%; position: relative;">
            <div id="ad-progress" style="height: 100%; width: 100%; background: linear-gradient(90deg, #ec4899, #8b5cf6); position: absolute; top: 0; left: 0; transition: width ${CONFIG.overlayDuration}ms linear;"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(wrapper);
      
      // Animation d'entrée
      requestAnimationFrame(() => {
        wrapper.style.opacity = '1';
        const container = document.getElementById('brandia-ad-container');
        if (container) {
          container.style.transform = 'scale(1) translateY(0)';
        }
        
        // Démarrer la barre de progression
        setTimeout(() => {
          const progress = document.getElementById('ad-progress');
          if (progress) progress.style.width = '0%';
        }, 100);
      });
      
      // Gestion fermeture
      const closeAdHandler = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        console.log('[BrandiaAds] Closing ad');
        self.closeAd('dismissed', supplierId);
      };
      
      const closeBtn = document.getElementById('ad-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeAdHandler);
        closeBtn.addEventListener('touchend', closeAdHandler);
      }
      
      wrapper.addEventListener('click', (e) => { 
        if (e.target === wrapper) closeAdHandler(e); 
      });
      
      const escapeHandler = (e) => {
        if (e.key === 'Escape') { 
          closeAdHandler(e); 
          document.removeEventListener('keydown', escapeHandler); 
        }
      };
      document.addEventListener('keydown', escapeHandler);
      
      // CTA click
      const ctaBtn = document.getElementById('ad-cta-btn');
      if (ctaBtn) {
        ctaBtn.addEventListener('click', (e) => {
          e.preventDefault();
          self.trackClick(campaign.id);
          setTimeout(() => {
            self.closeAd('clicked', supplierId);
            window.location.href = campaign.cta_link || '#';
          }, 100);
        });
      }
      
      // Timer
      this.startTimer(supplierId);
      
      // Fermeture auto
      setTimeout(() => {
        self.closeAd('completed', supplierId);
      }, CONFIG.overlayDuration);
      
      // Tracking
      AdsStorage.markCampaignSeen(campaign.id);
      if (supplierId) sessionStorage.setItem(`ad_seen_supplier_${supplierId}`, 'true');
      this.trackView(campaign.id);
    },
    
    startTimer: function(supplierId) {
      const self = this;
      this.state.countdown = 15;
      const timerEl = document.getElementById('ad-timer');
      
      this.state.timer = setInterval(() => {
        self.state.countdown--;
        if (timerEl) timerEl.textContent = self.state.countdown;
        if (self.state.countdown <= 0) {
          clearInterval(self.state.timer);
          self.state.timer = null;
        }
      }, 1000);
    },
    
    closeAd: function(reason, supplierId) {
      if (this.state.isClosed) return;
      this.state.isClosed = true;
      console.log(`[BrandiaAds] Closing: ${reason}`);
      
      if (this.state.timer) {
        clearInterval(this.state.timer);
        this.state.timer = null;
      }
      
      const wrapper = document.getElementById('brandia-ad-wrapper');
      if (wrapper) {
        wrapper.style.opacity = '0';
        const container = document.getElementById('brandia-ad-container');
        if (container) container.style.transform = 'scale(0.9) translateY(30px)';
        
        setTimeout(() => {
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
          this.state.currentCampaign = null;
          this.state.isClosed = false;
        }, 300);
      }
    },
    
    trackView: async function(campaignId) {
      try {
        await fetch(`${CONFIG.fallbackAPI}/supplier/public/campaigns/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId })
        });
      } catch (e) {}
    },
    
    trackClick: async function(campaignId) {
      try {
        await fetch(`${CONFIG.fallbackAPI}/supplier/public/campaigns/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId })
        });
      } catch (e) {}
    },
    
    debug: function() { 
      return { state: this.state, storage: AdsStorage.getSeenCampaigns() }; 
    },
    
    reset: function() { 
      AdsStorage.reset(); 
      this.state.isClosed = false; 
    }
  };
  
  window.BrandiaAds = BrandiaAds;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForAPI((fallback) => BrandiaAds.init(fallback)));
  } else {
    waitForAPI((fallback) => BrandiaAds.init(fallback));
  }
  
  console.log('[BrandiaAds] Loader v3.6 ready - VIDEO DISABLED');
})();