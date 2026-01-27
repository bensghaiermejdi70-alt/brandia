// ============================================
// CONFIGURATION CATÉGORIES BRANDIA
// TOP 21 CATÉGORIES - IMAGES UNSPLASH PROFESSIONNELLES
// ============================================

const BRANDIA_CATEGORIES = [
  {
    id: 1,
    slug: 'cosmetiques-soins-peau',
    name: 'Cosmétiques & soins de la peau',
    name_en: 'Cosmetics & Skincare',
    icon: 'fa-spa',
    description: 'Produits de beauté, crèmes, sérums et soins dermatologiques',
    color: 'from-pink-500 to-rose-500',
    gradient: 'bg-gradient-to-br from-pink-500 to-rose-500',
    featured: true,
    // Image: produits cosmétiques élégants
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 2,
    slug: 'parfums-fragrances',
    name: 'Parfums & fragrances',
    name_en: 'Perfumes & Fragrances',
    icon: 'fa-spray-can',
    description: 'Parfums de luxe, eaux de toilette et fragrances exclusives',
    color: 'from-purple-500 to-indigo-500',
    gradient: 'bg-gradient-to-br from-purple-500 to-indigo-500',
    featured: true,
    // Image: flacon de parfum luxueux
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 3,
    slug: 'maquillage',
    name: 'Maquillage',
    name_en: 'Makeup',
    icon: 'fa-paint-brush',
    description: 'Maquillage professionnel, palettes et produits de beauté',
    color: 'from-red-500 to-pink-500',
    gradient: 'bg-gradient-to-br from-red-500 to-pink-500',
    featured: true,
    // Image: maquillage professionnel
    image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 4,
    slug: 'soins-capillaires',
    name: 'Soins capillaires',
    name_en: 'Hair Care',
    icon: 'fa-cut',
    description: 'Shampooings, soins, colorations et accessoires cheveux',
    color: 'from-amber-500 to-orange-500',
    gradient: 'bg-gradient-to-br from-amber-500 to-orange-500',
    featured: false,
    // Image: cheveux brillants et sains
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 5,
    slug: 'complements-bien-etre',
    name: 'Compléments bien-être & beauté',
    name_en: 'Wellness & Beauty Supplements',
    icon: 'fa-pills',
    description: 'Vitamines, compléments alimentaires et nutricosmétiques',
    color: 'from-emerald-500 to-teal-500',
    gradient: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    featured: false,
    // Image: compléments naturels
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 6,
    slug: 'mode-accessoires',
    name: 'Mode & accessoires (non fast-fashion)',
    name_en: 'Fashion & Accessories',
    icon: 'fa-tshirt',
    description: 'Mode durable, accessoires tendance et pièces intemporelles',
    color: 'from-blue-500 to-cyan-500',
    gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    featured: true,
    // Image: vêtements élégants
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 7,
    slug: 'montres-bijoux',
    name: 'Montres & bijoux',
    name_en: 'Watches & Jewelry',
    icon: 'fa-gem',
    description: 'Montres de luxe, bijoux fantaisie et accessoires précieux',
    color: 'from-yellow-500 to-amber-500',
    gradient: 'bg-gradient-to-br from-yellow-500 to-amber-500',
    featured: true,
    // Image: montre et bijoux luxe
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 8,
    slug: 'sport-fitness',
    name: 'Articles de sport & fitness',
    name_en: 'Sports & Fitness',
    icon: 'fa-dumbbell',
    description: 'Équipement sportif, vêtements techniques et fitness',
    color: 'from-green-500 to-emerald-500',
    gradient: 'bg-gradient-to-br from-green-500 to-emerald-500',
    featured: false,
    // Image: équipement fitness
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 9,
    slug: 'nutrition-sportive',
    name: 'Nutrition sportive',
    name_en: 'Sports Nutrition',
    icon: 'fa-apple-alt',
    description: 'Protéines, compléments sportifs et nutrition performance',
    color: 'from-lime-500 to-green-500',
    gradient: 'bg-gradient-to-br from-lime-500 to-green-500',
    featured: false,
    // Image: nutrition healthy
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 10,
    slug: 'high-tech-mobile',
    name: 'High-tech & accessoires mobiles',
    name_en: 'Tech & Mobile Accessories',
    icon: 'fa-mobile-alt',
    description: 'Smartphones, accessoires tech et gadgets innovants',
    color: 'from-slate-500 to-gray-500',
    gradient: 'bg-gradient-to-br from-slate-500 to-gray-500',
    featured: true,
    // Image: smartphone moderne
    image: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 11,
    slug: 'electronique-lifestyle',
    name: 'Électronique lifestyle (audio, wearables)',
    name_en: 'Lifestyle Electronics',
    icon: 'fa-headphones',
    description: 'Audio haute fidélité, wearables et objets connectés',
    color: 'from-indigo-500 to-blue-500',
    gradient: 'bg-gradient-to-br from-indigo-500 to-blue-500',
    featured: false,
    // Image: casque audio premium
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 12,
    slug: 'maison-decoration',
    name: 'Maison & décoration',
    name_en: 'Home & Decor',
    icon: 'fa-couch',
    description: 'Mobilier, décoration intérieure et art de vivre',
    color: 'from-orange-500 to-red-500',
    gradient: 'bg-gradient-to-br from-orange-500 to-red-500',
    featured: true,
    // Image: intérieur design
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 13,
    slug: 'parfumerie-interieur',
    name: 'Parfumerie d\'intérieur',
    name_en: 'Home Fragrance',
    icon: 'fa-fire',
    description: 'Bougies parfumées, diffuseurs et senteurs d\'intérieur',
    color: 'from-rose-400 to-pink-500',
    gradient: 'bg-gradient-to-br from-rose-400 to-pink-500',
    featured: false,
    // Image: bougies ambiance cosy
    image: 'https://images.unsplash.com/photo-1602607688652-9f3a0c96c646?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 14,
    slug: 'produits-ecologiques',
    name: 'Produits écologiques & durables',
    name_en: 'Eco-friendly & Sustainable',
    icon: 'fa-leaf',
    description: 'Produits verts, zéro déchet et mode éthique',
    color: 'from-green-400 to-emerald-500',
    gradient: 'bg-gradient-to-br from-green-400 to-emerald-500',
    featured: false,
    // Image: produits éco-responsables
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 15,
    slug: 'bebe-maternite',
    name: 'Bébé & maternité',
    name_en: 'Baby & Maternity',
    icon: 'fa-baby',
    description: 'Puériculture, soins bébé et produits maternité',
    color: 'from-sky-400 to-blue-500',
    gradient: 'bg-gradient-to-br from-sky-400 to-blue-500',
    featured: false,
    // Image: produits bébé doux
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 16,
    slug: 'animaux-pets',
    name: 'Animaux & accessoires pets',
    name_en: 'Pets & Accessories',
    icon: 'fa-paw',
    description: 'Accessoires pour animaux, soins et nutrition pet care',
    color: 'from-amber-600 to-yellow-600',
    gradient: 'bg-gradient-to-br from-amber-600 to-yellow-600',
    featured: false,
    // Image: accessoires animaux
    image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 17,
    slug: 'sante-hygiene',
    name: 'Santé & hygiène personnelle',
    name_en: 'Health & Personal Care',
    icon: 'fa-heartbeat',
    description: 'Produits de santé, hygiène et bien-être quotidien',
    color: 'from-red-400 to-rose-500',
    gradient: 'bg-gradient-to-br from-red-400 to-rose-500',
    featured: false,
    // Image: produits santé
    image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 18,
    slug: 'bagagerie-voyage',
    name: 'Bagagerie & accessoires de voyage',
    name_en: 'Luggage & Travel',
    icon: 'fa-suitcase',
    description: 'Valises, sacs de voyage et accessoires nomades',
    color: 'from-violet-500 to-purple-600',
    gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    featured: false,
    // Image: valise voyage élégante
    image: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 19,
    slug: 'papeterie-lifestyle',
    name: 'Papeterie premium & lifestyle',
    name_en: 'Premium Stationery',
    icon: 'fa-pen-fancy',
    description: 'Papeterie de luxe, carnets et objets d\'écriture',
    color: 'from-teal-400 to-cyan-500',
    gradient: 'bg-gradient-to-br from-teal-400 to-cyan-500',
    featured: false,
    // Image: papeterie élégante
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 20,
    slug: 'artisanat-local',
    name: 'Produits artisanaux & marques locales premium',
    name_en: 'Artisanal & Local Premium',
    icon: 'fa-hands',
    description: 'Créations artisanales, marques locales et savoir-faire',
    color: 'from-orange-400 to-amber-500',
    gradient: 'bg-gradient-to-br from-orange-400 to-amber-500',
    featured: false,
    // Image: artisanat fait main
    image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&h=600&fit=crop&q=80'
  },
  {
    id: 21,
    slug: 'sport-loisirs',
    name: 'Sport et loisir',
    name_en: 'Sports & Leisure',
    icon: 'fa-bicycle',
    description: 'Équipement de loisirs, outdoor et activités sportives',
    color: 'from-cyan-500 to-blue-600',
    gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    featured: true,
    // Image: vélo et outdoor
    image: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&q=80'
  }
];

// ==========================================
// IMAGES PAR DÉFAUT (fallback sécurisé)
// ==========================================

const DEFAULT_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&h=600&fit=crop&q=80';

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

const CategoriesAPI = {
  getAll() {
    return BRANDIA_CATEGORIES;
  },

  getFeatured() {
    return BRANDIA_CATEGORIES.filter(cat => cat.featured);
  },

  getBySlug(slug) {
    return BRANDIA_CATEGORIES.find(cat => cat.slug === slug);
  },

  getById(id) {
    return BRANDIA_CATEGORIES.find(cat => cat.id === id);
  },

  search(query) {
    const lowerQuery = query.toLowerCase();
    return BRANDIA_CATEGORIES.filter(cat => 
      cat.name.toLowerCase().includes(lowerQuery) ||
      cat.name_en.toLowerCase().includes(lowerQuery) ||
      cat.description.toLowerCase().includes(lowerQuery)
    );
  },

  getName(category, lang = 'fr') {
    return lang === 'en' ? category.name_en : category.name;
  },

  // Récupérer l'image d'une catégorie (avec fallback)
  getImage(category) {
    return category?.image || DEFAULT_CATEGORY_IMAGE;
  },

  // Générer le HTML pour une carte complète avec image
  renderCardWithImage(category, options = {}) {
    const { lang = 'fr', showDescription = true } = options;
    const name = this.getName(category, lang);
    const image = this.getImage(category);

    return `
      <a href="catalogue.html?category=${category.slug}" 
         class="group block bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 hover:border-indigo-500 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-1">
        <div class="relative h-48 overflow-hidden bg-neutral-900">
          <img src="${image}" 
               alt="${name}" 
               class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
               loading="lazy"
               onerror="this.onerror=null; this.src='${DEFAULT_CATEGORY_IMAGE}';">
          <div class="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent"></div>
          <div class="absolute top-4 left-4">
            <div class="w-12 h-12 ${category.gradient} rounded-xl flex items-center justify-center shadow-lg">
              <i class="fas ${category.icon} text-white text-xl"></i>
            </div>
          </div>
        </div>
        <div class="p-5">
          <h3 class="text-lg font-bold text-neutral-100 mb-2 group-hover:text-indigo-400 transition-colors line-clamp-2">
            ${name}
          </h3>
          ${showDescription ? `<p class="text-neutral-400 text-sm line-clamp-2 mb-3">${category.description}</p>` : ''}
          <div class="flex items-center text-indigo-400 text-sm font-medium">
            <span>Explorer</span>
            <i class="fas fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>
          </div>
        </div>
      </a>
    `;
  },

  // Générer le HTML pour la grille complète avec images
  renderGridWithImages(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} non trouvé`);
      return;
    }

    const categories = options.featuredOnly ? this.getFeatured() : this.getAll();
    
    container.innerHTML = categories.map((cat, index) => `
      <div class="fade-in" style="animation-delay: ${index * 0.05}s">
        ${this.renderCardWithImage(cat, options)}
      </div>
    `).join('');
  },

  // Générer le HTML pour le dropdown header
  renderDropdown(containerId, lang = 'fr') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const html = BRANDIA_CATEGORIES.map(cat => `
      <a href="catalogue.html?category=${cat.slug}" 
         class="flex items-center gap-3 px-4 py-3 text-sm text-neutral-300 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors mx-2 mb-1">
        <div class="w-8 h-8 ${cat.gradient} rounded-lg flex items-center justify-center flex-shrink-0">
          <i class="fas ${cat.icon} text-white text-xs"></i>
        </div>
        <span class="font-medium truncate">${this.getName(cat, lang)}</span>
      </a>
    `).join('');

    container.innerHTML = html;
  },

  // Ancienne méthode pour compatibilité (sans image)
  renderCard(category, options = {}) {
    const { 
      showDescription = false, 
      compact = false,
      lang = 'fr'
    } = options;

    const name = this.getName(category, lang);

    if (compact) {
      return `
        <a href="catalogue.html?category=${category.slug}" class="category-card group block p-3 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-all duration-300 border border-neutral-700 hover:border-indigo-500">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 ${category.gradient} rounded-lg flex items-center justify-center shadow-lg">
              <i class="fas ${category.icon} text-white text-lg"></i>
            </div>
            <span class="text-neutral-200 text-sm font-medium group-hover:text-white">${name}</span>
          </div>
        </a>
      `;
    }

    return `
      <a href="catalogue.html?category=${category.slug}" class="category-card group block p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-all duration-300 border border-neutral-700 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20">
        <div class="w-12 h-12 ${category.gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform">
          <i class="fas ${category.icon} text-white text-xl"></i>
        </div>
        <h3 class="text-neutral-100 font-semibold mb-1 group-hover:text-indigo-400 transition-colors">${name}</h3>
        ${showDescription ? `<p class="text-neutral-400 text-xs line-clamp-2">${category.description}</p>` : ''}
      </a>
    `;
  },

  renderGrid(categories, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const html = categories.map((cat, index) => `
      <div class="fade-in" style="animation-delay: ${index * 0.05}s">
        ${this.renderCard(cat, options)}
      </div>
    `).join('');

    container.innerHTML = html;
  }
};

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BRANDIA_CATEGORIES, CategoriesAPI, DEFAULT_CATEGORY_IMAGE };
}