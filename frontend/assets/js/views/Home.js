// ============================================
// HOME VIEW - Page d'accueil Brandia
// ============================================

const HomeView = async (params, query) => {
  // Récupérer les données
  const [featuredProducts, categories, stats] = await Promise.all([
    fetchFeaturedProducts(),
    fetchCategories(),
    fetchStats()
  ]);

  return `
    <!-- Hero Section -->
    <section class="relative overflow-hidden bg-gradient-to-b from-neutral-900 to-neutral-800 py-20 lg:py-32">
      <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1920&q=80')] opacity-10 bg-cover bg-center"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-transparent"></div>
      
      <div class="container max-w-7xl mx-auto px-4 relative z-10">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <div class="space-y-8 animate-fade-in">
            <h1 class="text-4xl lg:text-6xl font-bold text-white leading-tight">
              Achetez directement<br>
              <span class="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">chez les marques</span>
            </h1>
            <p class="text-lg text-neutral-300 max-w-xl">
              Produits authentiques, livraison par la marque, commission réduite. Découvrez des milliers de produits originaux directement auprès des créateurs.
            </p>
            <div class="flex flex-wrap gap-4">
              <button onclick="router.navigate('/catalogue')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/25 flex items-center gap-2">
                <span>Explorer le catalogue</span>
                <i class="fas fa-arrow-right"></i>
              </button>
              <button onclick="router.navigate('/devenir-vendeur')" class="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2">
                <span>Devenir vendeur</span>
                <i class="fas fa-store"></i>
              </button>
            </div>
            
            <!-- Stats mini -->
            <div class="flex gap-8 pt-4">
              <div>
                <div class="text-2xl font-bold text-white">${stats.brands}+</div>
                <div class="text-sm text-neutral-400">Marques</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-white">${stats.products}+</div>
                <div class="text-sm text-neutral-400">Produits</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-white">${stats.countries}</div>
                <div class="text-sm text-neutral-400">Pays</div>
              </div>
            </div>
          </div>
          
          <div class="relative hidden lg:block">
            <div class="relative rounded-2xl overflow-hidden shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop&q=80" 
                   alt="Produits Brandia" 
                   class="w-full h-auto object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent"></div>
            </div>
            <!-- Floating cards -->
            <div class="absolute -bottom-6 -left-6 bg-neutral-800 rounded-xl p-4 shadow-xl border border-neutral-700 animate-float">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <i class="fas fa-check text-green-400"></i>
                </div>
                <div>
                  <div class="text-sm font-semibold text-white">Authentique</div>
                  <div class="text-xs text-neutral-400">Produits vérifiés</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Categories Section -->
    <section class="py-20 bg-neutral-900">
      <div class="container max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-end mb-12">
          <div>
            <h2 class="text-3xl font-bold text-white mb-2">Nos catégories</h2>
            <p class="text-neutral-400">Explorez notre univers</p>
          </div>
          <button onclick="router.navigate('/categories')" class="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-2 transition-colors">
            Voir tout <i class="fas fa-arrow-right"></i>
          </button>
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          ${categories.map((cat, i) => `
            <button onclick="router.navigate('/catalogue?category=${cat.slug}')" 
                    class="group relative bg-neutral-800 hover:bg-neutral-700 rounded-xl p-6 transition-all duration-300 hover:transform hover:scale-105 border border-neutral-700 hover:border-indigo-500/50"
                    style="animation-delay: ${i * 50}ms">
              <div class="w-12 h-12 bg-gradient-to-br ${cat.color} rounded-lg flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-indigo-500/25 transition-shadow">
                <i class="fas ${cat.icon} text-white text-xl"></i>
              </div>
              <h3 class="font-semibold text-white text-sm mb-1">${cat.name}</h3>
              <p class="text-xs text-neutral-500">${cat.count || 0} produits</p>
            </button>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- Featured Products -->
    <section class="py-20 bg-neutral-800/50">
      <div class="container max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-end mb-12">
          <div>
            <h2 class="text-3xl font-bold text-white mb-2">Nos meilleures offres</h2>
            <p class="text-neutral-400">Profitez de nos promotions exclusives</p>
          </div>
          <button onclick="router.navigate('/catalogue?filter=deals')" class="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-2 transition-colors">
            Voir tout <i class="fas fa-arrow-right"></i>
          </button>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          ${featuredProducts.map(product => ProductCard(product)).join('')}
        </div>
      </div>
    </section>

    <!-- Why Brandia -->
    <section class="py-20 bg-neutral-900">
      <div class="container max-w-7xl mx-auto px-4">
        <div class="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 class="text-3xl font-bold text-white mb-8">Pourquoi Brandia ?</h2>
            <div class="space-y-6">
              ${[
                { icon: 'fa-check-circle', color: 'text-green-400', title: 'Produits authentiques', desc: 'Achetez directement auprès des marques officielles, garantie authenticité 100%.' },
                { icon: 'fa-shipping-fast', color: 'text-blue-400', title: 'Livraison rapide', desc: 'Expédition directe par les marques, livraison en 24-48h selon votre localisation.' },
                { icon: 'fa-hand-holding-usd', color: 'text-purple-400', title: 'Prix justes', desc: 'Commission modulable, les meilleurs prix pour les marques et les clients.' },
                { icon: 'fa-headset', color: 'text-pink-400', title: 'Support dédié', desc: 'Une équipe à votre écoute pour vous accompagner dans vos achats.' }
              ].map(item => `
                <div class="flex gap-4 group">
                  <div class="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-700 transition-colors">
                    <i class="fas ${item.icon} ${item.color} text-xl"></i>
                  </div>
                  <div>
                    <h3 class="font-semibold text-white mb-1">${item.title}</h3>
                    <p class="text-neutral-400 text-sm leading-relaxed">${item.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="relative">
            <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop&q=80" 
                 alt="Pourquoi Brandia" 
                 class="rounded-2xl shadow-2xl">
            <div class="absolute -bottom-6 -right-6 bg-indigo-600 text-white rounded-xl p-6 shadow-xl">
              <div class="text-3xl font-bold">15%</div>
              <div class="text-sm opacity-90">Commission max</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
};

// Helper: Product Card Component
const ProductCard = (product) => {
  const hasPromo = product.final_price < product.price;
  const discount = hasPromo ? Math.round((1 - product.final_price / product.price) * 100) : 0;
  
  return `
    <div class="group bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 hover:border-indigo-500/50 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10">
      <div class="relative aspect-square overflow-hidden">
        <img src="${product.main_image_url || 'https://via.placeholder.com/400'}" 
             alt="${product.name}" 
             class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
        ${hasPromo ? `
          <div class="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            -${discount}%
          </div>
        ` : ''}
        <button onclick="store.addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')}); event.stopPropagation();" 
                class="absolute bottom-3 right-3 w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="p-4">
        <div class="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-1">${product.category_name || 'Catégorie'}</div>
        <h3 class="font-semibold text-white mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors cursor-pointer" 
            onclick="router.navigate('/product/${product.id}')">${product.name}</h3>
        <div class="flex items-center justify-between">
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-bold ${hasPromo ? 'text-green-400' : 'text-white'}">${formatPrice(product.final_price || product.price)}</span>
            ${hasPromo ? `<span class="text-sm text-neutral-500 line-through">${formatPrice(product.price)}</span>` : ''}
          </div>
          <div class="flex items-center gap-1 text-sm text-neutral-400">
            <i class="fas fa-star text-yellow-400"></i>
            <span>${product.rating || '4.5'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Helper: Format price
const formatPrice = (price) => {
  const currency = store.get('currency') || 'EUR';
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency 
  }).format(price);
};

// API Calls
async function fetchFeaturedProducts() {
  try {
    const response = await fetch('https://brandia-1.onrender.com/api/products/featured');
    const data = await response.json();
    return data.data?.products || data.data || [];
  } catch (error) {
    console.error('Erreur chargement produits:', error);
    return [];
  }
}

async function fetchCategories() {
  return [
    { slug: 'cosmetiques-soins-peau', name: 'Cosmétiques', icon: 'fa-spa', color: 'from-pink-500 to-rose-500', count: 234 },
    { slug: 'parfums-fragrances', name: 'Parfums', icon: 'fa-spray-can', color: 'from-purple-500 to-indigo-500', count: 156 },
    { slug: 'maquillage', name: 'Maquillage', icon: 'fa-magic', color: 'from-red-500 to-pink-500', count: 189 },
    { slug: 'mode-accessoires', name: 'Mode', icon: 'fa-tshirt', color: 'from-blue-500 to-cyan-500', count: 312 },
    { slug: 'high-tech-mobile', name: 'High-Tech', icon: 'fa-mobile-alt', color: 'from-indigo-500 to-blue-500', count: 278 },
    { slug: 'maison-decoration', name: 'Maison', icon: 'fa-home', color: 'from-orange-500 to-red-500', count: 145 }
  ];
}

async function fetchStats() {
  return { brands: 50, products: 1000, countries: 28 };
}

// Export
window.HomeView = HomeView;