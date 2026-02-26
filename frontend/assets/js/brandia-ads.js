// ============================================
// BRANDIA ADS SYSTEM - v3.3 FINAL PRODUCTION
// Fix: Syntaxe JS + Fallback vidéo Cloudinary
// ============================================
(function() {
  'use strict';
  
  if (window.BrandiaAds && window.BrandiaAds.version === '3.3') return;
  
  function waitForAPI(callback, maxAttempts = 50) {
    let attempts = 0;
    const check = () => {
      attempts++;
      if (window.BrandiaAPI && window.BrandiaAPI.Supplier) {
        callback();
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
    fallbackAPI: 'https://brandia-1.onrender.com/api'
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
  
  const BrandiaAds = {
    version: '3.3',
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
      console.log('[BrandiaAds] Initializing v3.3...');
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
            this.showAd(campaignData.data, null);
          }
        })
        .catch(err => console.error('[BrandiaAds] Fallback error:', err));
    },
    
    initWithAPI: async function(productId) {
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
        console.log(`[BrandiaAds] Product: ${productId} | Supplier: ${supplierId}`);
        
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
        
        console.log(`[BrandiaAds] Campaign found: ${campaign.id}`);
        
        setTimeout(() => {
          this.showAd(campaign, supplierId);
        }, CONFIG.initDelay);
        
      } catch (error) {
        console.error('[BrandiaAds] Error:', error);
        this.initFallback(productId);
      }
    },
    
    showAd: function(campaign, supplierId) {
      if (!campaign || AdsStorage.hasSeenCampaign(campaign.id) || this.state.isClosed) return;
      
      console.log(`[BrandiaAds] Showing ad: ${campaign.id}`);
      
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
      
      const isVideo = campaign.media_type === 'video';
      
      // 🔥 FALLBACK VIDÉO : poster + gestion erreur
      const videoPoster = campaign.media_url.replace('/upload/', '/upload/f_auto,q_auto/');
      const mediaHtml = isVideo 
        ? `<video src="${campaign.media_url}" poster="${videoPoster}?format=jpg" muted playsinline autoplay class="w-full h-full object-cover" id="ad-video" crossorigin="anonymous"></video>`
        : `<img src="${campaign.media_url}" class="w-full h-full object-cover" alt="${campaign.headline}" onerror="this.src='https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'">`;
      
      wrapper.innerHTML = `
        <div id="brandia-ad-container" style="
          width: 90%; max-width: 500px; max-height: 80vh;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 20px; overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(99, 102, 241, 0.3);
          transform: scale(0.9) translateY(20px);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex; flex-direction: column;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid rgba(99, 102, 241, 0.2);">
            <span style="font-size: 12px; color: #818cf8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-sparkles" style="color: #ec4899;"></i> Sponsorisé
            </span>
            <button id="ad-close-btn" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 14px;" onmouseover="this.style.background='rgba(239,68,68,0.4)'" onmouseout="this.style.background='rgba(239,68,68,0.2)'">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div style="position: relative; width: 100%; height: 250px; background: #0f172a; overflow: hidden;">
            ${mediaHtml}
            ${isVideo ? `<div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.8); color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;"><i class="fas fa-clock"></i> <span id="ad-timer">15</span>s</div>` : ''}
          </div>
          
          <div style="padding: 20px;">
            <h3 style="font-size: 20px; font-weight: 700; color: white; margin-bottom: 8px; line-height: 1.3;">${campaign.headline || 'Offre spéciale'}</h3>
            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5;">${campaign.description || 'Découvrez cette offre exclusive de la marque'}</p>
            <a href="${campaign.cta_link || '#'}" id="ad-cta-btn" style="display: block; width: 100%; padding: 14px; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; text-align: center; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s; border: none; cursor: pointer; font-size: 15px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 25px -5px rgba(236,72,153,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
              ${campaign.cta_text || "Voir l'offre"} <i class="fas fa-arrow-right" style="margin-left: 8px;"></i>
            </a>
            <p style="margin-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
              <i class="fas fa-info-circle" style="margin-right: 4px;"></i> Contenu proposé par la marque que vous consultez
            </p>
          </div>
          
          <div style="height: 4px; background: #1e293b; width: 100%;">
            <div id="ad-progress" style="height: 100%; width: 100%; background: linear-gradient(90deg, #ec4899, #8b5cf6); transition: width ${CONFIG.overlayDuration}ms linear;"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(wrapper);
      
      requestAnimationFrame(() => {
        wrapper.style.opacity = '1';
        const container = document.getElementById('brandia-ad-container');
        if (container) container.style.transform = 'scale(1) translateY(0)';
        setTimeout(() => {
          const progress = document.getElementById('ad-progress');
          if (progress) progress.style.width = '0%';
        }, 100);
      });
      
      const closeBtn = document.getElementById('ad-close-btn');
      const closeAdHandler = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        console.log('[BrandiaAds] Close triggered');
        this.closeAd('dismissed', supplierId);
      };
      
      closeBtn.addEventListener('click', closeAdHandler);
      closeBtn.addEventListener('touchend', closeAdHandler);
      wrapper.addEventListener('click', (e) => { if (e.target === wrapper) closeAdHandler(e); });
      
      const escapeHandler = (e) => {
        if (e.key === 'Escape') { closeAdHandler(e); document.removeEventListener('keydown', escapeHandler); }
      };
      document.addEventListener('keydown', escapeHandler);
      
      const ctaBtn = document.getElementById('ad-cta-btn');
      ctaBtn.addEventListener('click', () => {
        this.trackClick(campaign.id);
        setTimeout(() => this.closeAd('clicked', supplierId), 100);
      });
      
      // 🔥 GESTION VIDÉO AVEC FALLBACK
      if (isVideo) {
        const video = document.getElementById('ad-video');
        if (video) {
          // Fallback si vidéo bloquée
          video.addEventListener('error', () => {
            console.log('[BrandiaAds] Video blocked, showing poster');
            video.style.display = 'none';
            video.parentElement.style.backgroundImage = `url('${videoPoster}?format=jpg')`;
            video.parentElement.style.backgroundSize = 'cover';
            video.parentElement.style.backgroundPosition = 'center';
          });
          
          this.startTimer(video);
          video.onended = () => setTimeout(() => this.closeAd('completed', supplierId), 500);
        }
      } else {
        this.startTimer(null);
        setTimeout(() => this.closeAd('completed', supplierId), CONFIG.overlayDuration);
      }
      
      AdsStorage.markCampaignSeen(campaign.id);
      if (supplierId) sessionStorage.setItem(`ad_seen_supplier_${supplierId}`, 'true');
      this.trackView(campaign.id);
    },
    
    startTimer: function(video) {
      this.state.countdown = 15;
      const timerEl = document.getElementById('ad-timer');
      this.state.timer = setInterval(() => {
        this.state.countdown--;
        if (timerEl) timerEl.textContent = this.state.countdown;
        if (this.state.countdown <= 0) clearInterval(this.state.timer);
      }, 1000);
    },
    
    closeAd: function(reason, supplierId) {
      if (this.state.isClosed) { console.log('[BrandiaAds] Already closing'); return; }
      this.state.isClosed = true;
      console.log(`[BrandiaAds] Closing ad: ${reason}`);
      
      if (this.state.timer) { clearInterval(this.state.timer); this.state.timer = null; }
      
      const video = document.getElementById('ad-video');
      if (video) { video.pause(); video.src = ''; }
      
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
    
    debug: function() { return { state: this.state, storage: AdsStorage.getSeenCampaigns() }; },
    reset: function() { AdsStorage.reset(); this.state.isClosed = false; }
  };
  
  window.BrandiaAds = BrandiaAds;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForAPI((f) => BrandiaAds.init(f)));
  } else {
    waitForAPI((f) => BrandiaAds.init(f));
  }
  
  console.log('[BrandiaAds] Loader v3.3 ready');
})();