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
        
        if (window.BRANDIA_CATEGORIES) {
            PublicProducts.state.categories = window.BRANDIA_CATEGORIES;
        }
        
        await PublicProducts.loadFeaturedProducts();
    },

    // ==========================================
    // CHARGEMENT PRODUITS
    // ==========================================
    loadFeaturedProducts: async () => {
        try {
            PublicProducts.showLoading(true);
            
            // ✅ CORRECTION: Vérifier que la méthode existe avant d'appeler
            let response;
            if (BrandiaAPI.Products.getFeaturedWithPromotions) {
                response = await BrandiaAPI.Products.getFeaturedWithPromotions();
            } else {
                // Fallback sur getFeatured classique
                console.log('[PublicProducts] getFeaturedWithPromotions non disponible, fallback sur getFeatured');
                response = await BrandiaAPI.Products.getFeatured();
            }
            
            if (response.success) {
                // ✅ CORRECTION: Gérer les deux formats de réponse
                const products = response.data?.products || response.data || [];
                PublicProducts.state.products = products;
                PublicProducts.renderProductGrid('featured-products-grid', products);
                console.log(`[PublicProducts] ${products.length} produits chargés`);
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('[PublicProducts] Erreur chargement featured:', error);
            PublicProducts.loadFeaturedFallback();
        } finally {
            PublicProducts.showLoading(false);
        }
    },

    loadAllProducts: async (category = null) => {
        try {
            PublicProducts.showLoading(true);
            
            // ✅ CORRECTION: Nettoyage robuste du paramètre category
            let cleanCategory = category;
            if (cleanCategory === 'null' || cleanCategory === 'undefined' || cleanCategory === 'false') {
                cleanCategory = null;
            }
            PublicProducts.state.currentCategory = cleanCategory;
            
            const params = {};
            if (cleanCategory) params.category = cleanCategory;
            
            // ✅ CORRECTION: Vérifier que la méthode existe
            let response;
            if (BrandiaAPI.Products.getAllWithPromotions) {
                response = await BrandiaAPI.Products.getAllWithPromotions(params);
            } else {
                response = await BrandiaAPI.Products.getAll(params);
            }
            
            if (response.success) {
                const products = response.data?.products || response.data || [];
                PublicProducts.state.products = products;
                PublicProducts.renderProductGrid('products-grid', products);
                PublicProducts.updateCategoryTitle(cleanCategory);
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('[PublicProducts] Erreur chargement produits:', error);
            // Fallback
            const fallback = await BrandiaAPI.Products.getAll({ 
                category: PublicProducts.state.currentCategory 
            });
            if (fallback.success) {
                const products = fallback.data?.products || fallback.data || [];
                PublicProducts.renderProductGrid('products-grid', products);
            }
        } finally {
            PublicProducts.showLoading(false);
        }
    },

    loadFeaturedFallback: async () => {
        try {
            const response = await BrandiaAPI.Products.getFeatured();
            if (response.success) {
                const products = response.data?.products || response.data || [];
                PublicProducts.state.products = products;
                PublicProducts.renderProductGrid('featured-products-grid', products);
            }
        } catch (error) {
            console.error('[PublicProducts] Fallback failed:', error);
        }
    },

    // ==========================================
    // RENDU HTML
    // ==========================================
    renderProductGrid: (containerId, products) => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`[PublicProducts] Container #${containerId} non trouvé`);
            return;
        }

        if (!Array.isArray(products) || products.length === 0) {
            container.innerHTML = PublicProducts.renderEmptyState();
            return;
        }

        container.innerHTML = products.map(p => PublicProducts.renderProductCard(p)).join('');
    },

    renderProductCard: (product) => {
        // ✅ CORRECTION: Vérification robuste des valeurs
        const hasPromo = product.has_promotion === true || 
                        (product.final_price && product.final_price < product.price) || 
                        product.promo_id;
        
        const finalPrice = parseFloat(product.final_price || product.price || 0);
        const basePrice = parseFloat(product.base_price || product.original_price || product.price || 0);
        
        let savingsAmount = 0;
        let savingsPercent = 0;
        
        if (hasPromo && basePrice > finalPrice) {
            savingsAmount = basePrice - finalPrice;
            savingsPercent = Math.round((savingsAmount / basePrice) * 100);
        }

        const promoBadge = hasPromo ? `
            <div class="absolute top-3 left-3 z-10">
                <span class="bg-gradient-to-r from-red-500 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                    <i class="fas fa-fire mr-1"></i>-${product.discount_display || savingsPercent + '%'}
                </span>
            </div>
        ` : '';

        const stockBadge = product.stock_quantity < 5 ? `
            <div class="absolute top-3 right-3 z-10">
                <span class="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                    ${product.stock_quantity === 0 ? 'Rupture' : 'Stock faible'}
                </span>
            </div>
        ` : '';

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

        // ✅ CORRECTION: Image sans espace dans l'URL
        const imageUrl = product.main_image_url || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&q=80';

        return `
            <div class="group relative bg-slate-800 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 border border-slate-700 hover:border-indigo-500/50">
                <div class="relative h-64 overflow-hidden bg-slate-900">
                    <img src="${imageUrl}" 
                         class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                         alt="${product.name || 'Produit'}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&q=80'">
                    
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
                    
                    ${promoBadge}
                    ${stockBadge}
                    
                    <div class="absolute bottom-4 left-4 right-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <button onclick="event.preventDefault(); event.stopPropagation(); PublicProducts.addToCart(${product.id})"
                                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium shadow-lg backdrop-blur-sm bg-opacity-90">
                            <i class="fas fa-cart-plus mr-2"></i>Ajouter
                        </button>
                    </div>
                </div>
                
                <div class="p-5">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-slate-500 uppercase tracking-wider">${product.category_name || 'Catégorie'}</span>
                        ${product.supplier_company ? `
                            <span class="text-xs text-slate-400">
                                <i class="fas fa-store mr-1"></i>${product.supplier_company}
                            </span>
                        ` : ''}
                    </div>
                    
                    <h3 class="font-semibold text-white text-lg mb-1 line-clamp-2 group-hover:text-indigo-400 transition-colors">
                        ${product.name || 'Produit sans nom'}
                    </h3>
                    
                    <p class="text-slate-400 text-sm line-clamp-2 mb-3 h-10">
                        ${product.description || 'Découvrez ce produit de qualité'}
                    </p>
                    
                    <div class="mb-3">
                        ${priceDisplay}
                    </div>
                    
                    ${promoInfo}
                    
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
    addToCart: async (productId) => {
        try {
            // ✅ CORRECTION: Vérifier que getByIdWithPromotion existe
            let response;
            if (BrandiaAPI.Products.getByIdWithPromotion) {
                response = await BrandiaAPI.Products.getByIdWithPromotion(productId);
            } else {
                response = await BrandiaAPI.Products.getById(productId);
            }
            
            if (!response.success) {
                throw new Error(response.message || 'Produit non trouvé');
            }

            const product = response.data?.product || response.data;
            
            if (!product) {
                throw new Error('Données produit manquantes');
            }
            
            // ✅ CORRECTION: Vérifier que Cart.add existe
            if (BrandiaAPI.Cart && BrandiaAPI.Cart.add) {
                BrandiaAPI.Cart.add({
                    id: product.id,
                    name: product.name,
                    price: product.final_price || product.price,
                    base_price: product.base_price || product.price,
                    has_promotion: product.has_promotion,
                    promo_code: product.promo_code,
                    promo_id: product.promo_id,
                    main_image_url: product.main_image_url,
                    supplier_id: product.supplier_id
                });
            } else {
                // Fallback: panier manuel
                let cart = JSON.parse(localStorage.getItem('brandia_cart') || '[]');
                const existing = cart.find(item => item.id == productId);
                
                if (existing) {
                    existing.quantity += 1;
                } else {
                    cart.push({
                        id: product.id,
                        name: product.name,
                        price: parseFloat(product.final_price || product.price),
                        original_price: parseFloat(product.price),
                        has_promotion: product.has_promotion || false,
                        main_image_url: product.main_image_url,
                        quantity: 1
                    });
                }
                
                localStorage.setItem('brandia_cart', JSON.stringify(cart));
            }

            PublicProducts.showToast(`${product.name} ajouté au panier !`, 'success');

        } catch (error) {
            console.error('[PublicProducts] Erreur ajout panier:', error);
            PublicProducts.showToast(error.message || 'Erreur lors de l\'ajout', 'error');
        }
    },

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
        
        const cat = PublicProducts.state.categories.find(c => c.slug === category || c.id == category);
        titleEl.textContent = cat ? cat.name : 'Produits';
    },

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
        // ✅ CORRECTION: Vérifier DashboardApp avant d'utiliser
        if (window.DashboardApp && DashboardApp.showToast) {
            DashboardApp.showToast(message, type);
        } else {
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

// ✅ CORRECTION: Vérifier que le DOM est prêt et que BrandiaAPI existe
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPublicProducts);
} else {
    initPublicProducts();
}

function initPublicProducts() {
    // Vérifier que BrandiaAPI est chargé
    if (typeof BrandiaAPI === 'undefined') {
        console.warn('[PublicProducts] BrandiaAPI non disponible, attente...');
        setTimeout(initPublicProducts, 500);
        return;
    }
    
    if (document.getElementById('featured-products-grid') || 
        document.getElementById('products-grid')) {
        PublicProducts.init();
    }
}

console.log('[PublicProducts] Module chargé');