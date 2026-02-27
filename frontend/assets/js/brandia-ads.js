// ============================================
// BRANDIA ADS SYSTEM - v4.0 PRODUCTION
// Changes: 30% size, auto-target all supplier products, 5 campaigns limit support
// ============================================
(function() {
  'use strict';
  
  if (window.BrandiaAds && window.BrandiaAds.version === '4.0') return;
  
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
    fallbackImage: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&auto=format&fit=crop&q=80',
    // NOUVEAU: Configuration taille réduite
    overlayWidth: '30%',        // Réduit de 40% à 30%
    overlayMaxWidth: '500px',   // Max 500px
    overlayMaxHeight: '70vh'    // Max 70% viewport height
  };
  
  const AdsStorage = {
    getSeenCampaigns: () => {
      try {
        return JSON.parse(sessionStorage.getItem('brandia_seen_campaigns_v4') || '[]');
      } catch { return []; }
    },
    markCampaignSeen: (campaignId) => {
      const seen = AdsStorage.getSeenCampaigns();
      if (!seen.includes(campaignId)) {
        seen.push(campaignId);
        sessionStorage.setItem('brandia_seen_campaigns_v4', JSON.stringify(seen));
      }
    },
    hasSeenCampaign: (campaignId) => AdsStorage.getSeenCampaigns().includes(campaignId),
    reset: () => sessionStorage.removeItem('brandia_seen_campaigns_v4')
  };
  
  // Convertir URL vidéo en image (fallback)
  function getSafeImageUrl(mediaUrl, mediaType) {
    if (!mediaUrl || mediaUrl === 'null' || mediaUrl === 'undefined') {
      console.log('[BrandiaAds] Using fallback image');
      return CONFIG.fallbackImage;
    }
    
    if (mediaType === 'video' || mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('.webm')) {
      console.log('[BrandiaAds] Converting video to image:', mediaUrl);
      try {
        const match = mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.(mp4|mov|webm)/i);
        if (match) {
          const basePath = match[1];
          return `https://res.cloudinary.com/dsm9w1jzx/image/upload/c_fill,w_600,h_400,q_auto/${basePath}.jpg`;
        }
      } catch (e) {
        console.error('[BrandiaAds] Conversion error:', e);
      }
      return CONFIG.fallbackImage;
    }
    return mediaUrl;
  }
  
  const BrandiaAds = {
    version: '4.0',
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
      console.log('[BrandiaAds] Initializing v4.0 (30% overlay)...');
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
          // MODIFIÉ: Nouveau endpoint pour récupérer TOUTES les campagnes actives du fournisseur
          return fetch(`${apiBase}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`);
        })
        .then(r => r ? r.json() : null)
        .then(campaignData => {
          if (campaignData?.success && campaignData.data) {
            // MODIFIÉ: Gestion de plusieurs campagnes (rotation aléatoire si plusieurs)
            const campaigns = Array.isArray(campaignData.data) ? campaignData.data : [campaignData.data];
            const availableCampaigns = campaigns.filter(c => !AdsStorage.hasSeenCampaign(c.id));
            
            if (availableCampaigns.length > 0) {
              // Choisir une campagne aléatoire parmi les disponibles
              const selectedCampaign = availableCampaigns[Math.floor(Math.random() * availableCampaigns.length)];
              self.showAd(selectedCampaign, null);
            } else if (campaigns.length > 0) {
              // Toutes vues, prendre la première (ou reset si tu préfères)
              console.log('[BrandiaAds] All campaigns seen, showing first');
              self.showAd(campaigns[0], null);
            }
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
        
        // Vérifier si déjà vu pour ce fournisseur (session)
        const sessionKey = `ad_seen_supplier_${supplierId}`;
        if (sessionStorage.getItem(sessionKey)) {
          console.log('[BrandiaAds] Already seen for this supplier');
          return;
        }
        
        // MODIFIÉ: Récupérer toutes les campagnes actives du fournisseur pour ce produit
        const campaignResponse = await fetch(
          `${CONFIG.fallbackAPI}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`
        );
        const campaignData = await campaignResponse.json();
        
        if (!campaignData.success || !campaignData.data) {
          console.log('[BrandiaAds] No active campaign');
          return;
        }
        
        // MODIFIÉ: Gérer un tableau de campagnes
        const campaigns = Array.isArray(campaignData.data) ? campaignData.data : [campaignData.data];
        const now = new Date();
        
        // Filtrer les campagnes actives (dates)
        const activeCampaigns = campaigns.filter(c => {
          const startDate = new Date(c.start_date);
          const endDate = new Date(c.end_date);
          return now >= startDate && now <= endDate;
        });
        
        if (activeCampaigns.length === 0) {
          console.log('[BrandiaAds] No active campaigns (dates)');
          return;
        }
        
        // Filtrer celles pas encore vues
        const availableCampaigns = activeCampaigns.filter(c => !AdsStorage.hasSeenCampaign(c.id));
        const campaignsToShow = availableCampaigns.length > 0 ? availableCampaigns : activeCampaigns;
        
        // Sélection aléatoire
        const selectedCampaign = campaignsToShow[Math.floor(Math.random() * campaignsToShow.length)];
        console.log(`[BrandiaAds] Selected campaign: ${selectedCampaign.id} (among ${campaignsToShow.length})`);
        
        setTimeout(() => {
          self.showAd(selectedCampaign, supplierId);
        }, CONFIG.initDelay);
        
      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
        this.initFallback(productId);
      }
    },
    
    showAd: function(campaign, supplierId) {
      if (!campaign || this.state.isClosed) return;
      
      const self = this;
      console.log(`[BrandiaAds] Showing ad: ${campaign.id}`);
      
      const safeImageUrl = getSafeImageUrl(campaign.media_url, campaign.media_type);
      
      const wrapper = document.createElement('div');
      wrapper.id = 'brandia-ad-wrapper';
      wrapper.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      
      // MODIFIÉ: Container réduit à 30% / max 500px
      wrapper.innerHTML = `
        <div id="brandia-ad-container" style="
          width: ${CONFIG.overlayWidth};
          max-width: ${CONFIG.overlayMaxWidth};
          max-height: ${CONFIG.overlayMaxHeight};
          background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.3);
          transform: scale(0.9) translateY(20px);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          flex-direction: column;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid rgba(99, 102, 241, 0.2);">
            <span style="font-size: 11px; color: #818cf8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-sparkles" style="color: #ec4899;"></i> Sponsorisé
            </span>
            <button id="ad-close-btn" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 12px;" onmouseover="this.style.background='rgba(239,68,68,0.4)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(239,68,68,0.2)'; this.style.transform='scale(1)'">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div style="position: relative; width: 100%; height: 200px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); overflow: hidden;">
            <img id="ad-media-img" src="${safeImageUrl}" 
                 style="width: 100%; height: 100%; object-fit: cover; display: block;" 
                 alt="${campaign.headline || 'Publicité'}"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;\\'><i class=\\'fas fa-image\\' style=\\'font-size:32px;\\'></i></div>';">
            
            <div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.85); color: white; padding: 6px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.1);">
              <i class="fas fa-clock" style="color: #ec4899;"></i> <span id="ad-timer">15</span>s
            </div>
          </div>
          
          <div style="padding: 16px;">
            <h3 style="font-size: 16px; font-weight: 700; color: white; margin-bottom: 6px; line-height: 1.3;">${campaign.headline || 'Offre spéciale'}</h3>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${campaign.description || 'Découvrez cette offre exclusive de la marque'}</p>
            
            <a href="${campaign.cta_link || '#'}" id="ad-cta-btn" style="display: block; width: 100%; padding: 12px; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; text-align: center; border-radius: 10px; font-weight: 600; text-decoration: none; transition: all 0.3s; border: none; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px -4px rgba(236,72,153,0.4)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(236, 72, 153, 0.3)'">
              ${campaign.cta_text || "Voir l'offre"} <i class="fas fa-arrow-right" style="margin-left: 6px;"></i>
            </a>
            
            <p style="margin-top: 12px; font-size: 10px; color: #64748b; text-align: center;">
              <i class="fas fa-info-circle" style="margin-right: 4px;"></i> Publicité de la marque consultée
            </p>
          </div>
          
          <div style="height: 3px; background: #1e293b; width: 100%; position: relative;">
            <div id="ad-progress" style="height: 100%; width: 100%; background: linear-gradient(90deg, #ec4899, #8b5cf6); position: absolute; top: 0; left: 0; transition: width ${CONFIG.overlayDuration}ms linear;"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(wrapper);
      
      // Animation entrée
      requestAnimationFrame(() => {
        wrapper.style.opacity = '1';
        const container = document.getElementById('brandia-ad-container');
        if (container) {
          container.style.transform = 'scale(1) translateY(0)';
        }
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
      
      this.startTimer(supplierId);
      
      setTimeout(() => {
        self.closeAd('completed', supplierId);
      }, CONFIG.overlayDuration);
      
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
        if (container) container.style.transform = 'scale(0.9) translateY(20px)';
        
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
  
  console.log('[BrandiaAds] Loader v4.0 ready - 30% overlay');
})();