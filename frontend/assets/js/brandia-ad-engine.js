// ============================================
// BRANDIA AD ENGINE v6.0
// Système de publicité vidéo 15 secondes avec Round-Robin
// Fichier: assets/js/brandia-ad-engine.js
// ============================================

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        API_URL: 'https://brandia-1.onrender.com/api',
        PROXY_URL: 'https://brandia-1.onrender.com/api/proxy/video',
        AD_DURATION: 15000, // 15 secondes en ms
        SKIP_DELAY: 5000,   // 5 secondes avant skip possible
        SESSION_KEY: 'brandia_ad_session_v6',
        ROTATION_KEY: 'brandia_ad_rotation_v6',
        CAMPAIGNS_CACHE_KEY: 'brandia_campaigns_cache',
        CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
        MAX_ADS_PER_SESSION: 1,
        FALLBACK_IMAGE: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&auto=format&fit=crop&q=80'
    };

    // ============================================
    // ÉTAT DU SYSTÈME
    // ============================================
    const state = {
        currentProduct: null,
        campaigns: [],
        activeCampaign: null,
        isPlaying: false,
        isSkipped: false,
        timer: null,
        progressTimer: null,
        skipTimer: null,
        countdown: 15,
        videoBlobUrl: null,
        sessionId: null,
        rotationIndex: 0,
        totalCampaigns: 0,
        viewsTracked: false,
        clickTracked: false
    };

    // ============================================
    // UTILITAIRES
    // ============================================
    const utils = {
        generateSessionId: () => {
            return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        getSessionData: () => {
            try {
                const data = sessionStorage.getItem(CONFIG.SESSION_KEY);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                return null;
            }
        },

        setSessionData: (data) => {
            try {
                sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(data));
            } catch (e) {
                console.warn('[AdEngine] SessionStorage non disponible');
            }
        },

        clearSession: () => {
            sessionStorage.removeItem(CONFIG.SESSION_KEY);
            sessionStorage.removeItem(CONFIG.ROTATION_KEY);
        },

        getRotationState: () => {
            try {
                const data = sessionStorage.getItem(CONFIG.ROTATION_KEY);
                return data ? JSON.parse(data) : { index: 0, campaigns: [], lastShown: null };
            } catch (e) {
                return { index: 0, campaigns: [], lastShown: null };
            }
        },

        setRotationState: (data) => {
            try {
                sessionStorage.setItem(CONFIG.ROTATION_KEY, JSON.stringify(data));
            } catch (e) {
                console.warn('[AdEngine] Rotation state non sauvegardé');
            }
        },

        isNewSession: () => {
            const session = utils.getSessionData();
            if (!session) return true;
            
            // Vérifier si la session a expiré (plus de 30 minutes)
            const now = Date.now();
            const lastActivity = session.lastActivity || 0;
            return (now - lastActivity) > (30 * 60 * 1000);
        },

        updateActivity: () => {
            const session = utils.getSessionData() || { id: utils.generateSessionId(), adsShown: 0 };
            session.lastActivity = Date.now();
            utils.setSessionData(session);
        },

        canShowAd: () => {
            if (utils.isNewSession()) {
                // Nouvelle session, reset
                const newSession = {
                    id: utils.generateSessionId(),
                    adsShown: 0,
                    lastActivity: Date.now()
                };
                utils.setSessionData(newSession);
                return true;
            }

            const session = utils.getSessionData();
            return session.adsShown < CONFIG.MAX_ADS_PER_SESSION;
        },

        markAdShown: () => {
            const session = utils.getSessionData();
            if (session) {
                session.adsShown++;
                session.lastActivity = Date.now();
                utils.setSessionData(session);
            }
        },

        // 🔥 ROUND ROBIN: Sélection équitable des campagnes
        selectNextCampaign: (campaigns) => {
            if (!campaigns || campaigns.length === 0) return null;
            
            let rotation = utils.getRotationState();
            
            // Si nouvelle session ou campagnes changées, reset
            if (!rotation.campaigns || rotation.campaigns.length !== campaigns.length) {
                rotation = {
                    index: 0,
                    campaigns: campaigns.map(c => c.id),
                    lastShown: null
                };
            }

            // Sélection Round-Robin
            const selectedIndex = rotation.index % campaigns.length;
            const selectedCampaign = campaigns[selectedIndex];
            
            // Mise à jour pour la prochaine fois
            rotation.index = (rotation.index + 1) % campaigns.length;
            rotation.lastShown = selectedCampaign.id;
            utils.setRotationState(rotation);

            console.log(`[AdEngine] Round-Robin: Campagne ${selectedIndex + 1}/${campaigns.length} (ID: ${selectedCampaign.id})`);
            
            return selectedCampaign;
        },

        formatTime: (seconds) => {
            return Math.ceil(seconds);
        },

        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    // ============================================
    // API & DATA
    // ============================================
    const api = {
        // Récupérer les campagnes actives pour un fournisseur
        fetchCampaigns: async (supplierId, productId) => {
            try {
                const cacheKey = `${CONFIG.CAMPAIGNS_CACHE_KEY}_${supplierId}`;
                const cached = localStorage.getItem(cacheKey);
                
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CONFIG.CACHE_DURATION) {
                        console.log('[AdEngine] Campagnes récupérées du cache');
                        return { success: true, data };
                    }
                }

                const response = await fetch(
                    `${CONFIG.API_URL}/supplier/public/campaigns?supplier=${supplierId}&product=${productId}`,
                    { headers: { 'Accept': 'application/json' } }
                );

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const result = await response.json();
                
                if (result.success && result.data) {
                    // Mettre en cache
                    localStorage.setItem(cacheKey, JSON.stringify({
                        data: Array.isArray(result.data) ? result.data : [result.data],
                        timestamp: Date.now()
                    }));
                }

                return result;
            } catch (error) {
                console.error('[AdEngine] Erreur fetch campaigns:', error);
                return { success: false, error: error.message };
            }
        },

        // Charger vidéo via proxy (contourne ad blockers)
        loadVideoViaProxy: async (videoUrl) => {
            try {
                console.log('[AdEngine] Chargement vidéo via proxy...');
                const proxyFullUrl = `${CONFIG.PROXY_URL}?url=${encodeURIComponent(videoUrl)}`;
                
                const response = await fetch(proxyFullUrl);
                if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
                
                const blob = await response.blob();
                return URL.createObjectURL(blob);
            } catch (error) {
                console.error('[AdEngine] Proxy failed:', error);
                return null;
            }
        },

        // Tracking
        trackView: async (campaignId) => {
            try {
                await fetch(`${CONFIG.API_URL}/supplier/public/campaigns/view`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign_id: campaignId })
                });
                console.log('[AdEngine] View tracked:', campaignId);
            } catch (e) {
                console.warn('[AdEngine] Track view failed:', e);
            }
        },

        trackClick: async (campaignId) => {
            try {
                await fetch(`${CONFIG.API_URL}/supplier/public/campaigns/click`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign_id: campaignId })
                });
                console.log('[AdEngine] Click tracked:', campaignId);
            } catch (e) {
                console.warn('[AdEngine] Track click failed:', e);
            }
        }
    };

    // ============================================
    // UI CONTROLLERS
    // ============================================
    const ui = {
        elements: {
            overlay: null,
            video: null,
            fallback: null,
            fallbackImg: null,
            timerText: null,
            timerDisplay: null,
            progressBar: null,
            title: null,
            desc: null,
            cta: null,
            download: null,
            closeBtn: null,
            skipBtn: null,
            skipTimer: null,
            loading: null,
            stats: null,
            views: null,
            clicks: null,
            rotationInfo: null,
            sponsorNotif: null
        },

        init: () => {
            ui.elements.overlay = document.getElementById('brandia-ad-overlay');
            ui.elements.video = document.getElementById('brandia-ad-video');
            ui.elements.fallback = document.getElementById('brandia-ad-fallback');
            ui.elements.fallbackImg = document.getElementById('brandia-ad-fallback-img');
            ui.elements.timerText = document.getElementById('brandia-ad-timer-text');
            ui.elements.timerDisplay = document.getElementById('brandia-ad-timer-display');
            ui.elements.progressBar = document.getElementById('brandia-ad-progress-bar');
            ui.elements.title = document.getElementById('brandia-ad-title');
            ui.elements.desc = document.getElementById('brandia-ad-desc');
            ui.elements.cta = document.getElementById('brandia-ad-cta');
            ui.elements.download = document.getElementById('brandia-ad-download');
            ui.elements.closeBtn = document.querySelector('.brandia-ad-close');
            ui.elements.skipBtn = document.getElementById('brandia-ad-skip');
            ui.elements.skipTimer = document.getElementById('skip-timer');
            ui.elements.loading = document.getElementById('brandia-ad-loading');
            ui.elements.stats = document.getElementById('brandia-ad-stats');
            ui.elements.views = document.getElementById('ad-views');
            ui.elements.clicks = document.getElementById('ad-clicks');
            ui.elements.rotationInfo = document.getElementById('ad-rotation-info');
            ui.elements.sponsorNotif = document.getElementById('brandia-ad-sponsor-notif');
        },

        showLoading: () => {
            if (ui.elements.loading) ui.elements.loading.classList.remove('hidden');
        },

        hideLoading: () => {
            if (ui.elements.loading) ui.elements.loading.classList.add('hidden');
        },

        showOverlay: () => {
            if (ui.elements.overlay) {
                ui.elements.overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        },

        hideOverlay: () => {
            if (ui.elements.overlay) {
                ui.elements.overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        },

        showSkipButton: () => {
            if (ui.elements.skipBtn) {
                ui.elements.skipBtn.classList.add('visible');
                ui.elements.skipBtn.innerHTML = 'Passer la pub';
            }
        },

        updateTimer: (seconds) => {
            const text = utils.formatTime(seconds);
            if (ui.elements.timerText) ui.elements.timerText.textContent = text;
            if (ui.elements.timerDisplay) ui.elements.timerDisplay.textContent = text;
        },

        updateProgress: (percent) => {
            if (ui.elements.progressBar) {
                ui.elements.progressBar.style.width = `${Math.max(0, percent)}%`;
            }
        },

        updateStats: (views, clicks) => {
            if (ui.elements.views) ui.elements.views.textContent = views || 0;
            if (ui.elements.clicks) ui.elements.clicks.textContent = clicks || 0;
        },

        updateRotationInfo: (current, total) => {
            if (ui.elements.rotationInfo) {
                ui.elements.rotationInfo.textContent = `${current}/${total}`;
            }
        },

        showSponsorNotification: () => {
            if (ui.elements.sponsorNotif) {
                ui.elements.sponsorNotif.classList.add('show');
                setTimeout(() => {
                    ui.elements.sponsorNotif.classList.remove('show');
                }, 3000);
            }
        },

        setCampaignData: (campaign) => {
            if (ui.elements.title) ui.elements.title.textContent = campaign.headline || 'Offre spéciale';
            if (ui.elements.desc) ui.elements.desc.textContent = campaign.description || 'Découvrez cette offre exclusive';
            if (ui.elements.cta) ui.elements.cta.href = campaign.cta_link || '#';
            if (ui.elements.download) ui.elements.download.href = campaign.media_url || '#';
            
            // Fallback image
            if (ui.elements.fallbackImg && campaign.media_url) {
                const posterUrl = campaign.media_url.replace('.mp4', '.jpg').replace('/upload/', '/upload/so_0/');
                ui.elements.fallbackImg.src = posterUrl;
                ui.elements.fallbackImg.onerror = () => {
                    ui.elements.fallbackImg.src = CONFIG.FALLBACK_IMAGE;
                };
            }
        },

        showFallback: () => {
            if (ui.elements.video) ui.elements.video.style.display = 'none';
            if (ui.elements.fallback) ui.elements.fallback.classList.add('active');
        },

        showVideo: () => {
            if (ui.elements.fallback) ui.elements.fallback.classList.remove('active');
            if (ui.elements.video) ui.elements.video.style.display = 'block';
        }
    };

    // ============================================
    // MOTEUR VIDÉO
    // ============================================
    const videoEngine = {
        play: async (videoUrl) => {
            return new Promise(async (resolve) => {
                const video = ui.elements.video;
                if (!video) return resolve(false);

                // Charger via proxy
                const blobUrl = await api.loadVideoViaProxy(videoUrl);
                
                if (!blobUrl) {
                    console.log('[AdEngine] Fallback vers image');
                    ui.showFallback();
                    return resolve(true); // On continue avec fallback
                }

                state.videoBlobUrl = blobUrl;
                video.src = blobUrl;

                video.onloadeddata = () => {
                    console.log('[AdEngine] Vidéo chargée');
                    ui.hideLoading();
                    ui.showVideo();
                    
                    video.play().then(() => {
                        console.log('[AdEngine] Lecture démarrée');
                        resolve(true);
                    }).catch(err => {
                        console.warn('[AdEngine] Autoplay bloqué:', err);
                        video.muted = true;
                        video.play().then(() => resolve(true)).catch(() => {
                            ui.showFallback();
                            resolve(true);
                        });
                    });
                };

                video.onerror = (e) => {
                    console.error('[AdEngine] Erreur vidéo:', e);
                    ui.showFallback();
                    resolve(true);
                };

                // Timeout de sécurité
                setTimeout(() => {
                    if (!video.currentTime || video.paused) {
                        ui.showFallback();
                        resolve(true);
                    }
                }, 10000);
            });
        },

        stop: () => {
            const video = ui.elements.video;
            if (video) {
                video.pause();
                video.src = '';
            }
            
            if (state.videoBlobUrl) {
                URL.revokeObjectURL(state.videoBlobUrl);
                state.videoBlobUrl = null;
            }
        },

        retry: () => {
            if (state.activeCampaign && state.activeCampaign.media_url) {
                ui.showVideo();
                videoEngine.play(state.activeCampaign.media_url);
            }
        }
    };

    // ============================================
    // TIMER & PROGRESSION
    // ============================================
    const timerEngine = {
        start: () => {
            const startTime = Date.now();
            const totalDuration = CONFIG.AD_DURATION;
            
            // Timer principal (15s)
            state.timer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, Math.ceil((totalDuration - elapsed) / 1000));
                const progress = ((totalDuration - elapsed) / totalDuration) * 100;
                
                state.countdown = remaining;
                ui.updateTimer(remaining);
                ui.updateProgress(progress);
                
                if (elapsed >= totalDuration) {
                    BrandiaAdEngine.completeAd();
                }
            }, 100);

            // Skip timer (5s avant skip possible)
            let skipCountdown = CONFIG.SKIP_DELAY / 1000;
            state.skipTimer = setInterval(() => {
                skipCountdown--;
                if (ui.elements.skipTimer) {
                    ui.elements.skipTimer.textContent = `(${skipCountdown})`;
                }
                
                if (skipCountdown <= 0) {
                    clearInterval(state.skipTimer);
                    ui.showSkipButton();
                }
            }, 1000);
        },

        stop: () => {
            if (state.timer) {
                clearInterval(state.timer);
                state.timer = null;
            }
            if (state.skipTimer) {
                clearInterval(state.skipTimer);
                state.skipTimer = null;
            }
        }
    };

    // ============================================
    // MÉTHODES PUBLIQUES
    // ============================================
    const BrandiaAdEngine = {
        // Initialisation
        init: (product) => {
            console.log('[AdEngine] Initialisation v6.0...');
            state.currentProduct = product;
            ui.init();
            utils.updateActivity();
        },

        // Vérifier et déclencher la publicité
        checkAndTrigger: async (product) => {
            console.log('[AdEngine] Vérification déclenchement...');
            
            // 1. Vérifier si on peut montrer une pub (1 par session)
            if (!utils.canShowAd()) {
                console.log('[AdEngine] Limite atteinte pour cette session');
                // Redirection directe vers le produit
                window.location.href = `product.html?id=${product.id}`;
                return;
            }

            // 2. Vérifier si campagnes existent
            if (!product.supplier_id) {
                console.log('[AdEngine] Pas de fournisseur, pas de pub');
                window.location.href = `product.html?id=${product.id}`;
                return;
            }

            // 3. Afficher loading
            ui.showLoading();
            ui.showOverlay();

            try {
                const response = await api.fetchCampaigns(product.supplier_id, product.id);
                
                if (!response.success || !response.data || response.data.length === 0) {
                    console.log('[AdEngine] Pas de campagnes actives');
                    ui.hideOverlay();
                    window.location.href = `product.html?id=${product.id}`;
                    return;
                }

                // 4. Sélection Round-Robin
                const campaigns = Array.isArray(response.data) ? response.data : [response.data];
                const selectedCampaign = utils.selectNextCampaign(campaigns);
                
                if (!selectedCampaign) {
                    ui.hideOverlay();
                    window.location.href = `product.html?id=${product.id}`;
                    return;
                }

                // 5. Lancer la publicité
                await BrandiaAdEngine.showAd(selectedCampaign, campaigns.length);

            } catch (error) {
                console.error('[AdEngine] Erreur:', error);
                ui.hideOverlay();
                window.location.href = `product.html?id=${product.id}`;
            }
        },

        // Afficher la publicité
        showAd: async (campaign, totalCampaigns) => {
            console.log('[AdEngine] Affichage campagne:', campaign.id);
            
            state.activeCampaign = campaign;
            state.isPlaying = true;
            state.isSkipped = false;
            state.viewsTracked = false;
            state.clickTracked = false;

            // Mise à jour UI
            ui.setCampaignData(campaign);
            ui.updateRotationInfo(
                (utils.getRotationState().index || 0) + 1, 
                totalCampaigns
            );
            ui.updateStats(campaign.views_count || 0, campaign.clicks_count || 0);

            // Notification sponsorisé
            setTimeout(() => ui.showSponsorNotification(), 500);

            // Lancer vidéo
            const videoStarted = await videoEngine.play(campaign.media_url);
            
            if (videoStarted) {
                // Démarrer timers
                timerEngine.start();
                
                // Marquer comme vue après 3 secondes
                setTimeout(() => {
                    if (!state.viewsTracked) {
                        api.trackView(campaign.id);
                        state.viewsTracked = true;
                    }
                }, 3000);

                // Marquer la pub comme montrée dans la session
                utils.markAdShown();
            }
        },

        // Gestion du clic sur CTA
        handleClick: (event) => {
            event.preventDefault();
            
            if (!state.activeCampaign) return;
            
            // Tracker le clic
            if (!state.clickTracked) {
                api.trackClick(state.activeCampaign.id);
                state.clickTracked = true;
            }

            // Redirection
            const link = state.activeCampaign.cta_link || '#';
            if (link !== '#') {
                window.open(link, '_blank');
            }
        },

        // Passer la publicité
        skipAd: () => {
            if (!state.isPlaying) return;
            
            console.log('[AdEngine] Skip demandé');
            state.isSkipped = true;
            BrandiaAdEngine.completeAd();
        },

        // Compléter la publicité (naturellement ou skip)
        completeAd: () => {
            console.log('[AdEngine] Publicité terminée');
            
            timerEngine.stop();
            videoEngine.stop();
            ui.hideOverlay();
            
            // Reset état
            state.isPlaying = false;
            state.activeCampaign = null;
            
            // Redirection vers le produit après la pub
            if (state.currentProduct) {
                console.log('[AdEngine] Redirection vers produit');
                // Option: rediriger ou juste fermer l'overlay
                // window.location.href = `product.html?id=${state.currentProduct.id}`;
            }
        },

        // Retry vidéo (bouton play sur fallback)
        retryVideo: () => {
            videoEngine.retry();
        },

        // Reset manuel (pour debug)
        reset: () => {
            utils.clearSession();
            console.log('[AdEngine] Session reset');
        },

        // Stats pour debug
        getStats: () => {
            return {
                session: utils.getSessionData(),
                rotation: utils.getRotationState(),
                state: state
            };
        }
    };

    // ============================================
    // EXPOSITION GLOBALE
    // ============================================
    window.BrandiaAdEngine = BrandiaAdEngine;

    console.log('[Brandia Ad Engine] v6.0 chargé - Round-Robin Ready');
})();