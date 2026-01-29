// ============================================
// BRANDIA - SEED DATABASE (Render Ready)
// ============================================

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');

// Charger .env depuis la racine du projet (backendpro/)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// DEBUG : Afficher les variables chargées (masquer le password)
console.log('🔍 Configuration détectée :');
console.log('  Host:', process.env.DB_HOST || '❌ NON DÉFINI');
console.log('  User:', process.env.DB_USER || '❌ NON DÉFINI');
console.log('  Database:', process.env.DB_NAME || '❌ NON DÉFINI');
console.log('  SSL:', process.env.DB_SSL || 'false');

// Validation des variables requises
const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Variables manquantes dans .env :', missing.join(', '));
  console.error('Assure-toi d\'avoir un fichier .env à la racine de backendpro/');
  process.exit(1);
}

// Configuration pool pour Render (SSL obligatoire)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000, // 10s pour Render
});

const log = (msg) => console.log(`✅ ${msg}`);
const error = (msg, err) => {
  console.error(`❌ ${msg}`, err?.message || '');
  process.exit(1);
};

// ============================================
// DONNÉES
// ============================================

const COUNTRIES = [
  { code: 'FR', name: 'France', currency: 'EUR', vat: 20 },
  { code: 'BE', name: 'Belgique', currency: 'EUR', vat: 21 },
  { code: 'CH', name: 'Suisse', currency: 'CHF', vat: 7.7 },
  { code: 'CA', name: 'Canada', currency: 'CAD', vat: 5 },
  { code: 'TN', name: 'Tunisie', currency: 'TND', vat: 19 },
  { code: 'DZ', name: 'Algérie', currency: 'DZD', vat: 19 },
  { code: 'MA', name: 'Maroc', currency: 'MAD', vat: 20 },
  { code: 'DE', name: 'Allemagne', currency: 'EUR', vat: 19 },
  { code: 'IT', name: 'Italie', currency: 'EUR', vat: 22 },
  { code: 'ES', name: 'Espagne', currency: 'EUR', vat: 21 },
  { code: 'NL', name: 'Pays-Bas', currency: 'EUR', vat: 21 },
  { code: 'AT', name: 'Autriche', currency: 'EUR', vat: 20 },
  { code: 'PT', name: 'Portugal', currency: 'EUR', vat: 23 },
  { code: 'IE', name: 'Irlande', currency: 'EUR', vat: 23 },
  { code: 'FI', name: 'Finlande', currency: 'EUR', vat: 24 },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', vat: 17 },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', vat: 20 },
  { code: 'US', name: 'États-Unis', currency: 'USD', vat: 0 },
  { code: 'JP', name: 'Japon', currency: 'JPY', vat: 10 },
  { code: 'KR', name: 'Corée du Sud', currency: 'KRW', vat: 10 },
  { code: 'CN', name: 'Chine', currency: 'CNY', vat: 13 },
  { code: 'SG', name: 'Singapour', currency: 'SGD', vat: 7 },
  { code: 'AU', name: 'Australie', currency: 'AUD', vat: 10 },
  { code: 'EG', name: 'Égypte', currency: 'EGP', vat: 14 },
  { code: 'AE', name: 'Émirats Arabes Unis', currency: 'AED', vat: 5 },
  { code: 'SA', name: 'Arabie Saoudite', currency: 'SAR', vat: 15 },
  { code: 'QA', name: 'Qatar', currency: 'QAR', vat: 0 },
  { code: 'KW', name: 'Koweït', currency: 'KWD', vat: 0 },
];

const CATEGORIES = [
  { slug: 'cosmetiques-soins-peau', name: 'Cosmétiques & soins de la peau', icon: 'fa-spa', gradient: 'from-pink-500 to-rose-600' },
  { slug: 'parfums-fragrances', name: 'Parfums & fragrances', icon: 'fa-spray-can', gradient: 'from-purple-500 to-indigo-600' },
  { slug: 'maquillage', name: 'Maquillage', icon: 'fa-magic', gradient: 'from-red-500 to-pink-600' },
  { slug: 'soins-capillaires', name: 'Soins capillaires', icon: 'fa-cut', gradient: 'from-amber-500 to-orange-600' },
  { slug: 'complements-bien-etre', name: 'Compléments bien-être', icon: 'fa-heart', gradient: 'from-emerald-500 to-teal-600' },
  { slug: 'mode-accessoires', name: 'Mode & accessoires', icon: 'fa-tshirt', gradient: 'from-blue-500 to-cyan-600' },
  { slug: 'montres-bijoux', name: 'Montres & bijoux', icon: 'fa-gem', gradient: 'from-yellow-500 to-amber-600' },
  { slug: 'sport-fitness', name: 'Articles de sport', icon: 'fa-dumbbell', gradient: 'from-orange-500 to-red-600' },
  { slug: 'nutrition-sportive', name: 'Nutrition sportive', icon: 'fa-apple-alt', gradient: 'from-green-500 to-emerald-600' },
  { slug: 'high-tech-mobile', name: 'High-tech', icon: 'fa-mobile-alt', gradient: 'from-indigo-500 to-blue-600' },
  { slug: 'electronique-lifestyle', name: 'Électronique lifestyle', icon: 'fa-headphones', gradient: 'from-violet-500 to-purple-600' },
  { slug: 'maison-decoration', name: 'Maison & décoration', icon: 'fa-home', gradient: 'from-orange-500 to-red-500' },
  { slug: 'parfumerie-interieur', name: 'Parfumerie d\'intérieur', icon: 'fa-fire', gradient: 'from-rose-400 to-pink-500' },
  { slug: 'produits-ecologiques', name: 'Produits écologiques', icon: 'fa-leaf', gradient: 'from-green-400 to-emerald-500' },
  { slug: 'bebe-maternite', name: 'Bébé & maternité', icon: 'fa-baby', gradient: 'from-sky-400 to-blue-500' },
  { slug: 'animaux-pets', name: 'Animaux', icon: 'fa-paw', gradient: 'from-amber-600 to-yellow-600' },
  { slug: 'sante-hygiene', name: 'Santé & hygiène', icon: 'fa-heartbeat', gradient: 'from-red-400 to-rose-500' },
  { slug: 'bagagerie-voyage', name: 'Bagagerie', icon: 'fa-suitcase', gradient: 'from-violet-500 to-purple-600' },
  { slug: 'papeterie-lifestyle', name: 'Papeterie premium', icon: 'fa-pen-fancy', gradient: 'from-teal-400 to-cyan-500' },
  { slug: 'artisanat-local', name: 'Artisanat local', icon: 'fa-hands', gradient: 'from-orange-400 to-amber-500' },
  { slug: 'sport-loisirs', name: 'Sport et loisirs', icon: 'fa-bicycle', gradient: 'from-cyan-500 to-blue-600' }
];

// ============================================
// CRÉATION TABLES
// ============================================

const createTables = async () => {
  log('Création des tables...');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS countries (
      id SERIAL PRIMARY KEY,
      code VARCHAR(2) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      currency VARCHAR(3) NOT NULL,
      vat_rate DECIMAL(4,2) DEFAULT 20.00,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      icon VARCHAR(50),
      gradient VARCHAR(100),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(20),
      role VARCHAR(20) DEFAULT 'client',
      country_code VARCHAR(2) DEFAULT 'FR',
      is_verified BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      company_name VARCHAR(255),
      description TEXT,
      website VARCHAR(255),
      logo_url VARCHAR(500),
      category VARCHAR(100),
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      stripe_account_id VARCHAR(255),
      stripe_account_status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      category_slug VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      short_description VARCHAR(500),
      price DECIMAL(10,2) NOT NULL,
      compare_price DECIMAL(10,2),
      stock_quantity INTEGER DEFAULT 100,
      sku VARCHAR(100),
      main_image_url VARCHAR(500),
      is_featured BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      rating DECIMAL(2,1) DEFAULT 4.5,
      reviews_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
    CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
  `);
  
  log('Tables créées');
};

// ============================================
// SEEDING
// ============================================

const seedData = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Pays
    log('Insertion 28 pays...');
    for (const country of COUNTRIES) {
      await client.query(
        `INSERT INTO countries (code, name, currency, vat_rate) 
         VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [country.code, country.name, country.currency, country.vat]
      );
    }

    // 2. Catégories
    log('Insertion 21 catégories...');
    for (const cat of CATEGORIES) {
      await client.query(
        `INSERT INTO categories (slug, name, icon, gradient) 
         VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING`,
        [cat.slug, cat.name, cat.icon, cat.gradient]
      );
    }

    // 3. Hash passwords
    log('Hashage mots de passe (bcrypt)...');
    const hashClient = await bcrypt.hash('Test1234!', 10);
    const hashSupplier = await bcrypt.hash('Supplier123!', 10);

    // 4. Users
    log('Création utilisateurs...');
    
    // Client
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, country_code, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, true) 
       ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
      ['test@brandia.com', hashClient, 'John', 'Doe', 'client', 'FR']
    );

    // 6 Suppliers
    const suppliers = [
      { email: 'supplier@brandia.com', company: 'Luxe Beauty', category: 'cosmetiques-soins-peau', desc: 'Marque premium de cosmétiques naturels et soins de la peau haut de gamme.' },
      { email: 'contact@techmaster.com', company: 'TechMaster', category: 'high-tech-mobile', desc: 'Expert en gadgets électroniques et accessoires tech innovants.' },
      { email: 'hello@organiclife.fr', company: 'Organic Life', category: 'complements-bien-etre', desc: 'Produits bio et compléments alimentaires pour votre bien-être.' },
      { email: 'info@urbanstyle.com', company: 'Urban Style', category: 'mode-accessoires', desc: 'Mode urbaine tendance et accessoires pour un style contemporain.' },
      { email: 'contact@homeelegance.fr', company: 'Home Elegance', category: 'maison-decoration', desc: 'Décoration d\'intérieur élégante et objets design.' },
      { email: 'pro@sportpro.eu', company: 'Sport Pro', category: 'sport-fitness', desc: 'Équipement professionnel pour le sport et la performance.' }
    ];

    const supplierIds = [];

    for (let i = 0; i < suppliers.length; i++) {
      const sup = suppliers[i];
      
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, first_name, role, country_code, is_verified) 
         VALUES ($1, $2, $3, $4, $5, true) 
         ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id`,
        [sup.email, hashSupplier, `Supplier${i+1}`, 'supplier', 'FR']
      );
      
      const userId = userRes.rows[0].id;
      supplierIds.push(userId);

      await client.query(
        `INSERT INTO suppliers (user_id, company_name, description, category, stripe_account_status) 
         VALUES ($1, $2, $3, $4, 'pending') 
         ON CONFLICT (user_id) DO UPDATE SET company_name = $2, description = $3`,
        [userId, sup.company, sup.desc, sup.category]
      );
    }

    // 5. Produits (12)
    log('Création 12 produits démo...');
    
    const products = [
      { name: 'Sérum Anti-Âge Premium', category: 'cosmetiques-soins-peau', supplier: 0, price: 89.90, compare: 120.00, image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800', desc: 'Sérum concentré avec acide hyaluronique et vitamine C.', featured: true },
      { name: 'Crème Hydratante 24h', category: 'cosmetiques-soins-peau', supplier: 0, price: 45.50, compare: 60.00, image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800', desc: 'Hydratation intense pour tous types de peau.' },
      { name: 'Écouteurs Sans Fil Pro', category: 'electronique-lifestyle', supplier: 1, price: 129.00, compare: 159.00, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', desc: 'Réduction de bruit active, autonomie 30h.', featured: true },
      { name: 'Montre Connectée Sport', category: 'high-tech-mobile', supplier: 1, price: 199.00, compare: null, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', desc: 'Suivi activité, cardio, GPS intégré.' },
      { name: 'Vitamines Biodisponibles', category: 'complements-bien-etre', supplier: 2, price: 34.90, compare: 42.00, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800', desc: 'Complexe vitaminé complet pour booster votre énergie.' },
      { name: 'Huile Essentielle Lavande', category: 'produits-ecologiques', supplier: 2, price: 24.90, compare: null, image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800', desc: 'Huile essentielle pure issue de l\'agriculture biologique.' },
      { name: 'Sac Cabas Cuir Véritable', category: 'mode-accessoires', supplier: 3, price: 159.00, compare: 220.00, image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800', desc: 'Cuir italien premium, fabrication artisanale.', featured: true },
      { name: 'Collier Plaqué Or 18k', category: 'montres-bijoux', supplier: 3, price: 79.00, compare: 120.00, image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800', desc: 'Design épuré, résistant à l\'eau.' },
      { name: 'Baskets Running Légères', category: 'sport-fitness', supplier: 5, price: 119.00, compare: 149.00, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', desc: 'Technologie amortissante dernière génération.' },
      { name: 'Tapis Yoga Écologique', category: 'sport-loisirs', supplier: 5, price: 49.90, compare: 65.00, image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800', desc: 'Caoutchouc naturel, grip anti-dérapant.' },
      { name: 'Diffuseur Arômes Design', category: 'parfumerie-interieur', supplier: 4, price: 59.00, compare: null, image: 'https://images.unsplash.com/photo-1602607688652-9f3a0c96c646?w=800', desc: 'Diffusion ultrasonique, design scandinave.', featured: true },
      { name: 'Set 3 Bougies Parfumées', category: 'maison-decoration', supplier: 4, price: 39.90, compare: 55.00, image: 'https://images.unsplash.com/photo-1602825267689-1b0f7eb22c00?w=800', desc: 'Cire végétale, parfums subtils.' }
    ];

    for (const prod of products) {
      await client.query(
        `INSERT INTO products 
         (supplier_id, category_slug, name, description, short_description, price, compare_price, main_image_url, is_featured, stock_quantity) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 100) 
         ON CONFLICT DO NOTHING`,
        [
          supplierIds[prod.supplier],
          prod.category,
          prod.name,
          prod.desc,
          prod.desc.substring(0, 100) + '...',
          prod.price,
          prod.compare,
          prod.image,
          prod.featured || false
        ]
      );
    }

    await client.query('COMMIT');
    
    console.log('\n🎉 SEEDING TERMINÉ AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════');
    console.log('Comptes de test :');
    console.log('  👤 Client    : test@brandia.com / Test1234!');
    console.log('  🏪 Fournisseur: supplier@brandia.com / Supplier123!');
    console.log('Données insérées :');
    console.log(`  • ${COUNTRIES.length} pays`);
    console.log(`  • ${CATEGORIES.length} catégories`);
    console.log(`  • ${suppliers.length} marques`);
    console.log(`  • ${products.length} produits`);
    console.log('═══════════════════════════════════════\n');
    
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ============================================
// EXÉCUTION
// ============================================

const run = async () => {
  try {
    log('Connexion à PostgreSQL...');
    await pool.query('SELECT NOW()'); // Test connexion
    log('Connecté avec succès');
    
    await createTables();
    await seedData();
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    error('Erreur:', err);
  }
};

run();