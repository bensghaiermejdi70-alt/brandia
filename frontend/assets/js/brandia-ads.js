// ============================================
// BRANDIA ADS - Publicité Contextuelle Intelligente
// Règles d'or: 15s max, 40% overlay, 1x/session, mute auto
// ============================================

class BrandiaAds {
  constructor() {
    this.sessionKey = 'brandia_ads_seen';
    this.currentCampaign = null;
    this.countdownInterval = null;
    this.apiURL = (window.BrandiaAPI?.config?.apiURL || 'https://brandia-1.onrender.com/api').replace(/\/$/, '');
  }

  async checkAndShow(productId, supplierId) {
    if (!productId || !supplierId) {
      console.log('[BrandiaAds] Missing productId or supplierId');
      return;
    }

    // Vérifier si déjà vu cette session
    if (this.hasSeenInSession(supplierId)) {
      console.log('[BrandiaAds] Déjà vue cette session pour ce supplier');
      return;
    }

    // Attendre 3 secondes pour laisser l'utilisateur voir le produit
    await new Promise(r => setTimeout(r, 3000));

    // Récupérer campagne active
    const campaign = await this.fetchActiveCampaign(supplierId, productId);
    if (!campaign) {
      console.log('[BrandiaAds] Pas de campagne active');
      return;
    }

    this.currentCampaign = campaign;
    this.showOverlay(campaign, supplierId);
    this.trackView(campaign.id);
  }

  hasSeenInSession(supplierId) {
    const seen = JSON.parse(sessionStorage.getItem(this.sessionKey) || '[]');
    return seen.includes(supplierId.toString());
  }

  markAsSeen(supplierId) {
    const seen = JSON.parse(sessionStorage.getItem(this.sessionKey) || '[]');
    if (!seen.includes(supplierId.toString())) {
      seen.push(supplierId.toString());
      sessionStorage.setItem(this.sessionKey, JSON.stringify(seen));
    }
  }

  async fetchActiveCampaign(supplierId, productId) {
    try {
      const url = `${this.apiURL}/public/campaigns?supplier=${supplierId}&product=${productId}`;
      console.log('[BrandiaAds] Fetching:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('[BrandiaAds] Response not OK:', response.status);
        return null;
      }
      
      const data = await response.json();
      console.log('[BrandiaAds] Campaign data:', data);
      return data.data || null;
    } catch (error) {
      console.error('[BrandiaAds] Erreur fetch:', error);
      return null;
    }
  }

  showOverlay(campaign, supplierId) {
    // Supprimer ancien overlay s'il existe
    let container = document.getElementById('brandia-ad-overlay');
    if (container) container.remove();

    container = document.createElement('div');
    container.id = 'brandia-ad-overlay';
    container.innerHTML = this.getOverlayHTML(campaign);
    document.body.appendChild(container);

    this.attachEvents(container, supplierId);
    this.startCountdown(container, 15);
    
    setTimeout(() => container.classList.add('active'), 100);
  }

  getOverlayHTML(campaign) {
    const isVideo = campaign.media_type === 'video';
    
    return `
      <div class="brandia-ad-backdrop" onclick="window.brandiaAds.close()"></div>
      <div class="brandia-ad-container">
        <button class="brandia-ad-close" onclick="window.brandiaAds.close()" aria-label="Fermer">
          <i class="fas fa-times"></i>
        </button>
        
        <div class="brandia-ad-content">
          ${isVideo ? `
            <video class="brandia-ad-media" autoplay muted playsinline loop>
              <source src="${campaign.media_url}" type="video/mp4">
            </video>
          ` : `
            <img class="brandia-ad-media" src="${campaign.media_url}" alt="${campaign.headline}" onerror="this.style.display='none'">
          `}
          
          <div class="brandia-ad-overlay-gradient"></div>
          
          <div class="brandia-ad-text">
            <span class="brandia-ad-badge">
              <i class="fas fa-sparkles mr-1"></i>
              Contenu proposé par la marque
            </span>
            <h3 class="brandia-ad-headline">${campaign.headline}</h3>
            <p class="brandia-ad-description">${campaign.description || ''}</p>
            <a href="${campaign.cta_link || '#'}" 
               class="brandia-ad-cta" 
               onclick="window.brandiaAds.handleClick(event)"
               target="_blank">
              ${campaign.cta_text || 'Voir l\'offre'}
              <i class="fas fa-arrow-right ml-2"></i>
            </a>
          </div>
        </div>
        
        <div class="brandia-ad-footer">
          <div class="brandia-ad-progress">
            <div class="brandia-ad-progress-bar" id="ad-progress-bar"></div>
          </div>
          <span class="brandia-ad-timer" id="ad-timer">15s</span>
        </div>
        
        <p class="brandia-ad-disclaimer">
          <i class="fas fa-info-circle mr-1"></i>
          Contenu proposé par la marque que vous consultez • Ferme dans <span id="ad-seconds">15</span>s
        </p>
      </div>
      
      <style>
        #brandia-ad-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        
        #brandia-ad-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }
        
        .brandia-ad-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          cursor: pointer;
        }
        
        .brandia-ad-container {
          position: relative;
          width: 100%;
          max-width: 600px;
          height: 40vh;
          min-height: 350px;
          max-height: 450px;
          margin: 0 16px 16px;
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          border-radius: 24px 24px 24px 24px;
          overflow: hidden;
          transform: translateY(100%);
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(99, 102, 241, 0.4);
        }
        
        #brandia-ad-overlay.active .brandia-ad-container {
          transform: translateY(0);
        }
        
        .brandia-ad-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 100;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-size: 16px;
        }
        
        .brandia-ad-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1) rotate(90deg);
        }
        
        .brandia-ad-content {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .brandia-ad-media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .brandia-ad-overlay-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(30, 27, 75, 0.98) 0%, rgba(30, 27, 75, 0.8) 40%, rgba(49, 46, 129, 0.4) 70%, transparent 100%);
          z-index: 5;
        }
        
        .brandia-ad-text {
          position: relative;
          z-index: 10;
          padding: 32px;
          margin-top: auto;
          text-align: center;
        }
        
        .brandia-ad-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 16px;
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 9999px;
          margin-bottom: 16px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          backdrop-filter: blur(4px);
        }
        
        .brandia-ad-headline {
          font-size: 28px;
          font-weight: 800;
          color: white;
          margin: 0 0 12px 0;
          line-height: 1.2;
          text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .brandia-ad-description {
          font-size: 15px;
          color: #c7d2fe;
          margin: 0 0 24px 0;
          line-height: 1.6;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .brandia-ad-cta {
          display: inline-flex;
          align-items: center;
          padding: 14px 32px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 30px -10px rgba(99, 102, 241, 0.5);
          border: 1px solid rgba(255,255,255,0.1);
        }
        
        .brandia-ad-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.6);
        }
        
        .brandia-ad-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 20;
        }
        
        .brandia-ad-progress {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }
        
        .brandia-ad-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #a78bfa);
          width: 100%;
          transform-origin: left;
        }
        
        .brandia-ad-timer {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          min-width: 36px;
          text-align: right;
        }
        
        .brandia-ad-disclaimer {
          position: absolute;
          bottom: -28px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          font-style: italic;
        }
        
        @media (max-width: 640px) {
          .brandia-ad-container {
            height: 50vh;
            min-height: 400px;
            margin: 0 12px 12px;
            border-radius: 20px;
          }
          
          .brandia-ad-headline {
            font-size: 22px;
          }
          
          .brandia-ad-description {
            font-size: 14px;
          }
          
          .brandia-ad-text {
            padding: 24px 20px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .brandia-ad-container,
          #brandia-ad-overlay {
            transition: none;
          }
        }
      </style>
    `;
  }

  attachEvents(container, supplierId) {
    // Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Mark as seen when closed
    container.addEventListener('transitionend', (e) => {
      if (!container.classList.contains('active') && e.propertyName === 'transform') {
        this.markAsSeen(supplierId);
      }
    });
  }

  startCountdown(container, seconds) {
    let remaining = seconds;
    const progressBar = container.querySelector('#ad-progress-bar');
    const timerText = container.querySelector('#ad-timer');
    const secondsText = container.querySelector('#ad-seconds');
    
    // CSS animation
    if (progressBar) {
      progressBar.style.transition = `transform ${seconds}s linear`;
      requestAnimationFrame(() => {
        progressBar.style.transform = 'scaleX(0)';
      });
    }

    this.countdownInterval = setInterval(() => {
      remaining--;
      
      if (timerText) timerText.textContent = remaining + 's';
      if (secondsText) secondsText.textContent = remaining;
      
      if (remaining <= 0) {
        this.close();
      }
    }, 1000);

    // Safety timeout
    setTimeout(() => this.close(), seconds * 1000 + 500);
  }

  handleClick(event) {
    event.preventDefault();
    const link = event.currentTarget.href;
    
    if (this.currentCampaign) {
      this.trackClick(this.currentCampaign.id);
    }
    
    if (link && link !== '#') {
      window.open(link, '_blank');
    }
    
    this.close();
  }

  close() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const container = document.getElementById('brandia-ad-overlay');
    if (container) {
      container.classList.remove('active');
      setTimeout(() => {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }, 500);
    }
  }

  async trackView(campaignId) {
    try {
      await fetch(`${this.apiURL}/supplier/campaigns/track/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
    } catch (e) {
      console.log('[BrandiaAds] Track view failed:', e);
    }
  }

  async trackClick(campaignId) {
    try {
      await fetch(`${this.apiURL}/supplier/campaigns/track/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
    } catch (e) {
      console.log('[BrandiaAds] Track click failed:', e);
    }
  }
}

// Auto-initialization
window.brandiaAds = new BrandiaAds();

// Auto-check when product is loaded
document.addEventListener('DOMContentLoaded', () => {
  const checkAndShowAd = () => {
    if (window.currentProduct?.supplier_id) {
      window.brandiaAds.checkAndShow(
        window.currentProduct.id,
        window.currentProduct.supplier_id
      );
    }
  };

  // Try immediately
  checkAndShowAd();
  
  // Also try after a delay in case product loads late
  setTimeout(checkAndShowAd, 4000);
});