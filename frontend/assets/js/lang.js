const translations = {
  fr: {
    // Meta
    "meta-title": "Brandia – La marketplace des marques",
    "catalogue-meta": "Catalogue – Brandia",
    "offres-meta": "Offres – Brandia",
    "categories-meta": "Catégories – Brandia",
    "brand-meta": "Marque – Brandia",
    "product-meta": "Produit – Brandia",
    "checkout-meta": "Commande – Brandia",
    "login-meta": "Connexion – Brandia",
    "register-meta": "Inscription – Brandia",
    "supplier-meta": "Devenir partenaire – Brandia",
    "cart-meta": "Panier – Brandia",
    
    // Navigation
    "nav-new": "Nouveautés",
    "nav-brands": "Marques",
    "nav-offers": "Offres",
    "nav-about": "À propos",
    "nav-categories": "Catégories",
    "nav-login": "Connexion",
    
    // Index
    "hero-title": "Achetez directement chez les marques",
    "hero-sub": "Produits authentiques, livraison par la marque.",
    "cta": "Voir les offres du jour",
    "brands-title": "Nos marques partenaires",
    "featured-title": "En vedette aujourd'hui",
    
    // Catalogue
    "catalogue-title": "Catalogue",
    "filter-cat": "Catégorie",
    "filter-price": "Prix",
    "filter-country": "Pays",
    "cat-beauty": "Beauté",
    "cat-sport": "Sport",
    "cat-lifestyle": "Lifestyle",
    
    // Catégories
    "categories-title": "Catégories",
    "cat-beauty-desc": "Soins visage, corps, maquillage",
    "cat-sport-desc": "Nutrition, accessoires, bien-être",
    "cat-lifestyle-desc": "Déco, bougies, accessoires",
    
    // Offres
    "offres-title": "Offres du jour",
    
    // Marque
    "brand-name": "GlowCo",
    "brand-desc": "Marque française de soins clean.",
    "brand-products": "Produits de la marque",
    
    // Produit
    "product-creme": "Crème Anti-Âge",
    "product-serum": "Sérum Hydratant",
    "product-desc": "Repulpante immédiate, formule clean, testée dermatologiquement.",
    "add-to-cart": "Ajouter au panier",
    
    // Checkout
    "your-order": "Votre commande",
    "payment": "Paiement",
    "pay": "Payer",
    "total": "Total",
    "card-info": "Carte bancaire (Stripe)",
    
    // Panier
    "cart-title": "Votre panier",
    "checkout-btn": "Commander",
    
    // Login
    "login-title": "Connexion",
    "login-sub": "Accédez à vos commandes, vos favoris et plus encore.",
    "remember": "Se souvenir de moi",
    "forgot": "Mot de passe oublié ?",
    "login-btn": "Se connecter",
    "or": "ou",
    "google": "Continuer avec Google",
    "no-account": "Pas encore de compte ?",
    "signup": "S'inscrire",
    "back": "← Retour",
    
    // Register
    "register-title": "Inscription client",
    "register-btn": "Créer mon compte",
    "has-account": "Déjà un compte ?",
    "login-link": "Se connecter",
    
    // Supplier
    "supplier-title": "Devenir partenaire Brandia",
    "select-country": "Pays",
    "supplier-btn": "Envoyer la demande",
    
    // Footer
    "footer": "© 2026 Brandia – Marketplace officielle des marques"
  },
  
  en: {
    // Meta
    "meta-title": "Brandia – The brand marketplace",
    "catalogue-meta": "Catalogue – Brandia",
    "offres-meta": "Offers – Brandia",
    "categories-meta": "Categories – Brandia",
    "brand-meta": "Brand – Brandia",
    "product-meta": "Product – Brandia",
    "checkout-meta": "Checkout – Brandia",
    "login-meta": "Login – Brandia",
    "register-meta": "Register – Brandia",
    "supplier-meta": "Become a partner – Brandia",
    "cart-meta": "Cart – Brandia",
    
    // Navigation
    "nav-new": "New arrivals",
    "nav-brands": "Brands",
    "nav-offers": "Offers",
    "nav-about": "About",
    "nav-categories": "Categories",
    "nav-login": "Login",
    
    // Index
    "hero-title": "Buy directly from the brands",
    "hero-sub": "Authentic products, shipped by the brand.",
    "cta": "See today's offers",
    "brands-title": "Our partner brands",
    "featured-title": "Featured today",
    
    // Catalogue
    "catalogue-title": "Catalogue",
    "filter-cat": "Category",
    "filter-price": "Price",
    "filter-country": "Country",
    "cat-beauty": "Beauty",
    "cat-sport": "Sport",
    "cat-lifestyle": "Lifestyle",
    
    // Categories
    "categories-title": "Categories",
    "cat-beauty-desc": "Face, body, makeup care",
    "cat-sport-desc": "Nutrition, accessories, well-being",
    "cat-lifestyle-desc": "Decor, candles, accessories",
    
    // Offers
    "offres-title": "Today's offers",
    
    // Brand
    "brand-name": "GlowCo",
    "brand-desc": "French clean beauty brand.",
    "brand-products": "Brand products",
    
    // Product
    "product-creme": "Anti-Aging Cream",
    "product-serum": "Hydrating Serum",
    "product-desc": "Immediate plumping, clean formula, dermatologically tested.",
    "add-to-cart": "Add to cart",
    
    // Checkout
    "your-order": "Your order",
    "payment": "Payment",
    "pay": "Pay",
    "total": "Total",
    "card-info": "Credit card (Stripe)",
    
    // Cart
    "cart-title": "Your cart",
    "checkout-btn": "Checkout",
    
    // Login
    "login-title": "Login",
    "login-sub": "Access your orders, favourites and more.",
    "remember": "Remember me",
    "forgot": "Forgot password ?",
    "login-btn": "Log in",
    "or": "or",
    "google": "Continue with Google",
    "no-account": "No account yet ?",
    "signup": "Sign up",
    "back": "← Back",
    
    // Register
    "register-title": "Customer registration",
    "register-btn": "Create my account",
    "has-account": "Already have an account ?",
    "login-link": "Log in",
    
    // Supplier
    "supplier-title": "Become a Brandia partner",
    "select-country": "Country",
    "supplier-btn": "Send request",
    
    // Footer
    "footer": "© 2026 Brandia – Official marketplace of brands"
  }
};

function applyLang(lang) {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

const langSwitch = document.getElementById("langSwitch");
if (langSwitch) {
  langSwitch.addEventListener("change", () => {
    const lang = langSwitch.value;
    localStorage.setItem("lang", lang);
    applyLang(lang);
  });
  const savedLang = localStorage.getItem("lang") || "fr";
  langSwitch.value = savedLang;
  applyLang(savedLang);
}