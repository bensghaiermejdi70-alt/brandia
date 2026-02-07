// ============================================
// PUBLIC PRODUCTS - Affichage boutique client avec promotions
// ============================================

window.PublicProducts = {
    state: {
        products: [],
        categories: [],
        currentCategory: null,
        isLoading: false
    },

    // ==========================================
    // INITIALISATION
    // ==========================================
    init: async () => {
        console.log('[PublicProducts] Initialisation...');
        
        // Charger les catégories depuis categories-config.js si disponible
        if (window.BRANDIA_CATEGORIES) {
            PublicProducts.state.categories = window.BRANDIA_CATEGORIES;
        }
        
        await PublicProducts.loadFeaturedProducts();
    },

    // ==========================================
    // CHARGEMENT PRODUITS
    // ==========================================
    
    /**
     * Charge les produits en vedette avec promotions (pour page d'accueil)
     */
    loadFeaturedProducts: async () => {
        try {
            PublicProducts.showLoading(true);
            
            // Utiliser la nouvelle API avec promotions
            const response = await BrandiaAPI.Products.getFeaturedWithPromotions();
            
            if (response.success) {
                PublicProducts.state.products = response.data.products || [];
                PublicProducts.renderProductGrid('featured-products-grid', PublicProducts.state.products);
                console.log(`[PublicProducts] ${response.data.products.length} produits chargés (${response.data.promo_count} en promo)`);
            } else {
                throw new Error(response.message);
            }
            
        } catch (error) {
            console.error('[PublicProducts] Erreur chargement featured:', error);
            // Fallback sur ancienne API
            PublicProducts.loadFeaturedFallback();
        } finally {
            PublicProducts.showLoading(false);
        }
    },

    /**
     * Charge tous les produits avec promotions (pour page catalogue)
     */
    loadAllProducts: async (category = null) => {
        try {
            PublicProducts.showLoading(true);
            // Nettoyage du paramètre category
            let cleanCategory = category;
            if (cleanCategory === 'null' || cleanCategory === 'undefined') {
                cleanCategory = null;
            }
            PublicProducts.state.currentCategory = cleanCategory;
            const params = {};
            if (cleanCategory) params.category = cleanCategory;
            const response = await BrandiaAPI.Products.getAllWithPromotions(params);
            if (response.success) {
                PublicProducts.state.products = response.data.products || [];
                PublicProducts.renderProductGrid('products-grid', PublicProducts.state.products);
                // Mettre à jour le titre
                PublicProducts.updateCategoryTitle(cleanCategory);
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('[PublicProducts] Erreur chargement produits:', error);
            // Fallback
            let cleanCategory = category;
            if (cleanCategory === 'null' || cleanCategory === 'undefined') {
                cleanCategory = null;
            }
            const fallback = await BrandiaAPI.Products.getAll({ category: cleanCategory });
            if (fallback.success) {
                PublicProducts.renderProductGrid('products-grid', fallback.data.products);
            }
        } finally {
            PublicProducts.showLoading(false);
        }
    },

    /**
     * Fallback si l'API avec promotions échoue
     */
    loadFeaturedFallback: async () => {
        try {
            const response = await BrandiaAPI.Products.getFeatured();
            if (response.success) {
                PublicProducts.state.products = response.data.products || [];
                PublicProducts.renderProductGrid('featured-products-grid', PublicProducts.state.products);
            }
        } catch (error) {
            console.error('[PublicProducts] Fallback failed:', error);
        }
    },

    // ==========================================
    // RENDU HTML
    // ==========================================
    
    /**
     * Rend une grille de produits
     */
    renderProductGrid: (containerId, products) => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`[PublicProducts] Container #${containerId} non trouvé`);
            return;
        }

        if (products.length === 0) {
            container.innerHTML = PublicProducts.renderEmptyState();
            return;
        }

        container.innerHTML = products.map(p => PublicProducts.renderProductCard(p)).join('');
    },

    /**
     * Rend une carte produit complète avec promotion
     */
    renderProductCard: (product) => {
        const hasPromo = product.has_promotion === true;
        const finalPrice = parseFloat(product.final_price || product.price);
        const basePrice = parseFloat(product.base_price || product.original_price || product.price);
        
        // Calcul des économies
        let savingsAmount = 0;
        let savingsPercent = 0;
        
        if (hasPromo && basePrice > finalPrice) {
            savingsAmount = basePrice - finalPrice;
            savingsPercent = Math.round((savingsAmount / basePrice) * 100);
        }

        // Badge promotion
        const promoBadge = hasPromo ? `
            <div class="absolute top-3 left-3 z-10">
                <span class="bg-gradient-to-r from-red-500 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                    <i class="fas fa-fire mr-1"></i>-${product.discount_display || savingsPercent + '%'}
                </span>
            </div>
        ` : '';

        // Badge stock faible
        const stockBadge = product.stock_quantity < 5 ? `
            <div class="absolute top-3 right-3 z-10">
                <span class="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                    ${product.stock_quantity === 0 ? 'Rupture' : 'Stock faible'}
                </span>
            </div>
        ` : '';

        // Affichage prix
        const priceDisplay = hasPromo ? `
            <div class="flex flex-col">
                <span class="text-slate-400 line-through text-sm">${PublicProducts.formatPrice(basePrice)}</span>
                <div class="flex items-center gap-2">
                    <span class="text-emerald-400 font-bold text-xl">${PublicProducts.formatPrice(finalPrice)}</span>
                    <span class="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Éco. ${PublicProducts.formatPrice(savingsAmount)}
                    </span>
                </div>
            </div>
        ` : `
            <span class="text-indigo-400 font-bold text-xl">${PublicProducts.formatPrice(finalPrice)}</span>
        `;

        // Info promotion supplémentaire
        const promoInfo = hasPromo ? `
            <div class="mt-2 p-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg border border-indigo-500/20">
                <div class="flex items-center gap-2 text-xs text-indigo-300">
                    <i class="fas fa-tag"></i>
                    <span>${product.promo_name || 'Promotion en cours'}</span>
                </div>
                ${product.promo_end_date ? `
                    <div class="text-xs text-amber-400 mt-1">
                        <i class="fas fa-clock mr-1"></i>
                        Jusqu'au ${new Date(product.promo_end_date).toLocaleDateString('fr-FR')}
                    </div>
                ` : ''}
                ${product.promo_code ? `
                    <div class="text-xs font-mono text-emerald-400 mt-1">
                        Code: ${product.promo_code}
                    </div>
                ` : ''}
            </div>
        ` : '';

        return `
            <div class="group relative bg-slate-800 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 border border-slate-700 hover:border-indigo-500/50">
                <!-- Image -->
                <div class="relative h-64 overflow-hidden bg-slate-900">
                    <img src="${product.main_image_url || 'https://via.placeholder.com/400x400?text=Produit'}" 
                         class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                         alt="${product.name}"
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/400x400?text=Produit'">
                    
                    <!-- Overlay au hover -->
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
                    
                    ${promoBadge}
                    ${stockBadge}
                    
                    <!-- Bouton rapide hover -->
                    <div class="absolute bottom-4 left-4 right-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <button onclick="PublicProducts.quickAddToCart(${product.id})" 
                                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium shadow-lg backdrop-blur-sm bg-opacity-90">
                            <i class="fas fa-cart-plus mr-2"></i>Ajouter
                        </button>
                    </div>
                </div>
                
                <!-- Contenu -->
                <div class="p-5">
                    <!-- Catégorie -->
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-slate-500 uppercase tracking-wider">${product.category_name || 'Catégorie'}</span>
                        ${product.supplier_company ? `
                            <span class="text-xs text-slate-400">
                                <i class="fas fa-store mr-1"></i>${product.supplier_company}
                            </span>
                        ` : ''}
                    </div>
                    
                    <!-- Nom -->
                    <h3 class="font-semibold text-white text-lg mb-1 line-clamp-2 group-hover:text-indigo-400 transition-colors">
                        ${product.name}
                    </h3>
                    
                    <!-- Description courte -->
                    <p class="text-slate-400 text-sm line-clamp-2 mb-3 h-10">
                        ${product.description || 'Découvrez ce produit de qualité'}
                    </p>
                    
                    <!-- Prix -->
                    <div class="mb-3">
                        ${priceDisplay}
                    </div>
                    
                    ${promoInfo}
                    
                    <!-- Actions -->
                    <div class="mt-4 flex gap-2">
                        <button onclick="PublicProducts.addToCart(${product.id})" 
                                class="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <i class="fas fa-shopping-cart"></i>
                            <span>Panier</span>
                        </button>
                        <a href="product.html?id=${product.id}" 
                           class="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl transition-colors flex items-center justify-center">
                            <i class="fas fa-eye"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    },

    renderEmptyState: () => `
        <div class="col-span-full py-16 text-center">
            <div class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-box-open text-4xl text-slate-600"></i>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Aucun produit trouvé</h3>
            <p class="text-slate-400">Revenez plus tard ou explorez d'autres catégories</p>
        </div>
    `,

    // ==========================================
    // ACTIONS
    // ==========================================
    
    /**
     * Ajout rapide au panier (depuis la grille)
     */
    quickAddToCart: async (productId) => {
        event.stopPropagation();
        await PublicProducts.addToCart(productId);
    },

    /**
     * Ajout au panier avec récupération du prix promo
     */
    addToCart: async (productId) => {
        try {
            // Récupérer le détail complet avec promotion
            const response = await BrandiaAPI.Products.getByIdWithPromotion(productId);
            
            if (!response.success || !response.data.product) {
                throw new Error('Produit non trouvé');
            }

            const product = response.data.product;
            
            // Ajouter au panier avec le prix promo déjà calculé
            BrandiaAPI.Cart.add({
                id: product.id,
                name: product.name,
                price: product.final_price || product.price, // Prix promo appliqué
                base_price: product.base_price || product.price, // Prix d'origine pour référence
                has_promotion: product.has_promotion,
                promo_code: product.promo_code,
                promo_id: product.promo_id,
                main_image_url: product.main_image_url,
                supplier_id: product.supplier_id
            });

            // Feedback visuel
            PublicProducts.showToast(`${product.name} ajouté au panier !`, 'success');
            
            // Animation sur le bouton
            const btn = event.target.closest('button');
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
                btn.classList.add('bg-emerald-600');
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.classList.remove('bg-emerald-600');
                }, 1500);
            }

        } catch (error) {
            console.error('[PublicProducts] Erreur ajout panier:', error);
            PublicProducts.showToast('Erreur lors de l\'ajout', 'error');
        }
    },

    // ==========================================
    // CATÉGORIES
    // ==========================================
    
    /**
     * Filtre par catégorie
     */
    filterByCategory: (categorySlug) => {
        PublicProducts.loadAllProducts(categorySlug);
    },

    updateCategoryTitle: (category) => {
        const titleEl = document.getElementById('category-title');
        if (!titleEl) return;
        
        if (!category) {
            titleEl.textContent = 'Tous nos produits';
            return;
        }
        
        // Chercher le nom de la catégorie
        const cat = PublicProducts.state.categories.find(c => c.slug === category || c.id == category);
        titleEl.textContent = cat ? cat.name : 'Produits';
    },

    // ==========================================
    // UTILITAIRES
    // ==========================================
    
    showLoading: (show) => {
        const loader = document.getElementById('products-loader');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
        PublicProducts.state.isLoading = show;
    },

    formatPrice: (amount) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    },

    showToast: (message, type = 'info') => {
        // Utiliser le toast de DashboardApp si disponible, sinon créer un simple alert
        if (window.DashboardApp && DashboardApp.showToast) {
            DashboardApp.showToast(message, type);
        } else {
            // Créer un toast simple
            const toast = document.createElement('div');
            toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform translate-y-0 transition-all z-50 ${
                type === 'success' ? 'bg-emerald-500' : 
                type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
            } text-white`;
            toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>${message}`;
            
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }
};

// ==========================================
// INITIALISATION AUTO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si on est sur une page qui a besoin des produits publics
    if (document.getElementById('featured-products-grid') || 
        document.getElementById('products-grid')) {
        PublicProducts.init();
    }
});

console.log('[PublicProducts] Module chargé');