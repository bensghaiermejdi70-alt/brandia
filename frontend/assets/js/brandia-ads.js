// ============================================
// BRANDIA ADS - Publicité Contextuelle Intelligente v2.1
// Corrections : apiURL trim, campaign_id pour tracking
// ============================================

(function() {
    'use strict';

    class BrandiaAds {
        constructor() {
            this.sessionKey = 'brandia_ads_seen';
            this.currentCampaign = null;
            this.countdownInterval = null;
            this.apiURL = null;
            this.init();
        }

        init() {
            // Attendre que BrandiaAPI soit chargé
            if (window.BrandiaAPI?.config?.apiURL) {
                // 🔥 Supprimer les espaces et le slash final
                this.apiURL = window.BrandiaAPI.config.apiURL.replace(/\s+$/, '').replace(/\/$/, '');
                console.log('[BrandiaAds] Initialized with API:', this.apiURL);
            } else {
                this.apiURL = 'https://brandia-1.onrender.com/api';
                console.warn('[BrandiaAds] BrandiaAPI not found, using fallback:', this.apiURL);
            }
        }

        async checkAndShow(productId, supplierId) {
            if (!productId || !supplierId) return;

            if (this.hasSeenInSession(supplierId)) return;

            await new Promise(r => setTimeout(r, 2000));

            try {
                const campaign = await this.fetchActiveCampaign(supplierId, productId);
                if (!campaign) return;

                this.currentCampaign = campaign;
                this.showOverlay(campaign, supplierId);
                this.trackView(campaign.id);
            } catch (error) {
                console.error('[BrandiaAds] Error:', error);
            }
        }

        hasSeenInSession(supplierId) {
            try {
                const seen = JSON.parse(sessionStorage.getItem(this.sessionKey) || '[]');
                return seen.includes(supplierId.toString());
            } catch {
                return false;
            }
        }

        markAsSeen(supplierId) {
            try {
                const seen = JSON.parse(sessionStorage.getItem(this.sessionKey) || '[]');
                if (!seen.includes(supplierId.toString())) {
                    seen.push(supplierId.toString());
                    sessionStorage.setItem(this.sessionKey, JSON.stringify(seen));
                }
            } catch (e) {
                console.error('[BrandiaAds] Error marking as seen:', e);
            }
        }

        async fetchActiveCampaign(supplierId, productId) {
            const url = `${this.apiURL}/public/campaigns?supplier=${supplierId}&product=${productId}`;
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data.success && data.data ? data.data : null;
            } catch (error) {
                console.error('[BrandiaAds] Fetch error:', error);
                return null;
            }
        }

        showOverlay(campaign, supplierId) {
            this.close();

            const container = document.createElement('div');
            container.id = 'brandia-ad-overlay';
            container.innerHTML = this.getOverlayHTML(campaign);
            document.body.appendChild(container);
            container.offsetHeight; // reflow
            requestAnimationFrame(() => container.classList.add('active'));

            this.attachEvents(container, supplierId);
            this.startCountdown(container, 15);
        }

        getOverlayHTML(campaign) {
            const isVideo = campaign.media_type === 'video';
            return `
                <div class="brandia-ad-backdrop" onclick="window.brandiaAds.close()"></div>
                <div class="brandia-ad-container" role="dialog" aria-modal="true" aria-label="Publicité de la marque">
                    <button class="brandia-ad-close" onclick="window.brandiaAds.close()" aria-label="Fermer la publicité">
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
                                Contenu proposé par la marque que vous consultez
                            </span>
                            <h3 class="brandia-ad-headline">${campaign.headline}</h3>
                            <p class="brandia-ad-description">${campaign.description || ''}</p>
                            <a href="${campaign.cta_link || '#'}" 
                               class="brandia-ad-cta" 
                               onclick="window.brandiaAds.handleClick(event)"
                               target="_blank" rel="noopener">
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
                        Cette publicité se fermera automatiquement dans <span id="ad-seconds">15</span> secondes
                    </p>
                </div>
                <style>
                    /* Styles identiques à v2.0 */
                </style>
            `;
        }

        attachEvents(container, supplierId) {
            const handleEscape = e => { if (e.key === 'Escape') { this.close(); document.removeEventListener('keydown', handleEscape); } };
            document.addEventListener('keydown', handleEscape);

            container.addEventListener('transitionend', e => {
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

            if (progressBar) {
                progressBar.style.transition = `transform ${seconds}s linear`;
                requestAnimationFrame(() => { progressBar.style.transform = 'scaleX(0)'; });
            }

            this.countdownInterval = setInterval(() => {
                remaining--;
                if (timerText) timerText.textContent = remaining + 's';
                if (secondsText) secondsText.textContent = remaining;
                if (remaining <= 0) this.close();
            }, 1000);

            setTimeout(() => this.close(), seconds * 1000 + 500);
        }

        handleClick(event) {
            event.preventDefault();
            const link = event.currentTarget.href;
            if (this.currentCampaign?.id) this.trackClick(this.currentCampaign.id);
            if (link && link !== '#' && link !== 'javascript:void(0)') window.open(link, '_blank', 'noopener,noreferrer');
            this.close();
        }

        close() {
            if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
            const container = document.getElementById('brandia-ad-overlay');
            if (container) {
                container.classList.remove('active');
                setTimeout(() => { if (container.parentNode) container.parentNode.removeChild(container); }, 500);
            }
        }

        async trackView(campaignId) {
            try {
                await fetch(`${this.apiURL}/supplier/campaigns/track/view`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign_id: campaignId })
                });
                console.log('[BrandiaAds] View tracked:', campaignId);
            } catch (e) {
                console.error('[BrandiaAds] Track view error:', e);
            }
        }

        async trackClick(campaignId) {
            try {
                await fetch(`${this.apiURL}/supplier/campaigns/track/click`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign_id: campaignId })
                });
                console.log('[BrandiaAds] Click tracked:', campaignId);
            } catch (e) {
                console.error('[BrandiaAds] Track click error:', e);
            }
        }
    }

    // Exposer globalement
    window.BrandiaAds = BrandiaAds;
    window.brandiaAds = new BrandiaAds();

    // Auto-init
    function initAdSystem() {
        if (window.currentProduct?.supplier_id) {
            window.brandiaAds.checkAndShow(window.currentProduct.id, window.currentProduct.supplier_id);
        }
        setTimeout(() => { if (window.currentProduct?.supplier_id) window.brandiaAds.checkAndShow(window.currentProduct.id, window.currentProduct.supplier_id); }, 3000);
        setTimeout(() => { if (window.currentProduct?.supplier_id) window.brandiaAds.checkAndShow(window.currentProduct.id, window.currentProduct.supplier_id); }, 6000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdSystem);
    } else {
        initAdSystem();
    }

    // SPA / Dynamic product changes
    let lastProductId = null;
    setInterval(() => {
        if (window.currentProduct?.id && window.currentProduct.id !== lastProductId) {
            lastProductId = window.currentProduct.id;
            window.brandiaAds.checkAndShow(window.currentProduct.id, window.currentProduct.supplier_id);
        }
    }, 1000);

})();
