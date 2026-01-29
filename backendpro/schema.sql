-- ============================================
-- BRANDIA - SCHEMA COMPLET
-- ============================================

-- Activer l'extension UUID (optionnel mais recommandé)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PAYS & CONFIGURATION
-- ============================================
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  vat_rate DECIMAL(4,2) DEFAULT 20.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO countries (code, name, currency, vat_rate) VALUES
('FR', 'France', 'EUR', 20.00),
('BE', 'Belgique', 'EUR', 21.00),
('CH', 'Suisse', 'CHF', 7.70),
('CA', 'Canada', 'CAD', 5.00),
('TN', 'Tunisie', 'TND', 19.00),
('DZ', 'Algérie', 'DZD', 19.00),
('MA', 'Maroc', 'MAD', 20.00),
('DE', 'Allemagne', 'EUR', 19.00),
('IT', 'Italie', 'EUR', 22.00),
('ES', 'Espagne', 'EUR', 21.00),
('NL', 'Pays-Bas', 'EUR', 21.00),
('AT', 'Autriche', 'EUR', 20.00),
('PT', 'Portugal', 'EUR', 23.00),
('IE', 'Irlande', 'EUR', 23.00),
('FI', 'Finlande', 'EUR', 24.00),
('LU', 'Luxembourg', 'EUR', 17.00),
('GB', 'Royaume-Uni', 'GBP', 20.00),
('US', 'États-Unis', 'USD', 0.00),
('JP', 'Japon', 'JPY', 10.00),
('KR', 'Corée du Sud', 'KRW', 10.00),
('CN', 'Chine', 'CNY', 13.00),
('SG', 'Singapour', 'SGD', 7.00),
('AU', 'Australie', 'AUD', 10.00),
('EG', 'Égypte', 'EGP', 14.00),
('AE', 'Émirats Arabes Unis', 'AED', 5.00),
('SA', 'Arabie Saoudite', 'SAR', 15.00),
('QA', 'Qatar', 'QAR', 0.00),
('KW', 'Koweït', 'KWD', 0.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. CATÉGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  icon VARCHAR(50),
  gradient VARCHAR(100),
  image_url VARCHAR(500),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO categories (slug, name, icon, gradient) VALUES
('cosmetiques-soins-peau', 'Cosmétiques & soins de la peau', 'fa-spa', 'from-pink-500 to-rose-600'),
('parfums-fragrances', 'Parfums & fragrances', 'fa-spray-can', 'from-purple-500 to-indigo-600'),
('maquillage', 'Maquillage', 'fa-magic', 'from-red-500 to-pink-600'),
('soins-capillaires', 'Soins capillaires', 'fa-cut', 'from-amber-500 to-orange-600'),
('complements-bien-etre', 'Compléments bien-être & beauté', 'fa-heart', 'from-emerald-500 to-teal-600'),
('mode-accessoires', 'Mode & accessoires', 'fa-tshirt', 'from-blue-500 to-cyan-600'),
('montres-bijoux', 'Montres & bijoux', 'fa-gem', 'from-yellow-500 to-amber-600'),
('sport-fitness', 'Articles de sport & fitness', 'fa-dumbbell', 'from-orange-500 to-red-600'),
('nutrition-sportive', 'Nutrition sportive', 'fa-apple-alt', 'from-green-500 to-emerald-600'),
('high-tech-mobile', 'High-tech & accessoires mobiles', 'fa-mobile-alt', 'from-indigo-500 to-blue-600'),
('electronique-lifestyle', 'Électronique lifestyle', 'fa-headphones', 'from-violet-500 to-purple-600'),
('maison-decoration', 'Maison & décoration', 'fa-home', 'from-orange-500 to-red-500'),
('parfumerie-interieur', 'Parfumerie d''intérieur', 'fa-fire', 'from-rose-400 to-pink-500'),
('produits-ecologiques', 'Produits écologiques & durables', 'fa-leaf', 'from-green-400 to-emerald-500'),
('bebe-maternite', 'Bébé & maternité', 'fa-baby', 'from-sky-400 to-blue-500'),
('animaux-pets', 'Animaux & accessoires pets', 'fa-paw', 'from-amber-600 to-yellow-600'),
('sante-hygiene', 'Santé & hygiène personnelle', 'fa-heartbeat', 'from-red-400 to-rose-500'),
('bagagerie-voyage', 'Bagagerie & accessoires de voyage', 'fa-suitcase', 'from-violet-500 to-purple-600'),
('papeterie-lifestyle', 'Papeterie premium & lifestyle', 'fa-pen-fancy', 'from-teal-400 to-cyan-500'),
('artisanat-local', 'Produits artisanaux & marques locales', 'fa-hands', 'from-orange-400 to-amber-500'),
('sport-loisirs', 'Sport et loisirs', 'fa-bicycle', 'from-cyan-500 to-blue-600')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. UTILISATEURS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'client', -- client, supplier, admin
  country_code VARCHAR(2) DEFAULT 'FR',
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. FOURNISSEURS (Profil étendu)
-- ============================================
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
  postal_code VARCHAR(20),
  country VARCHAR(100),
  siret VARCHAR(50),
  vat_number VARCHAR(50),
  legal_form VARCHAR(50),
  stripe_account_id VARCHAR(255),
  stripe_account_status VARCHAR(50) DEFAULT 'pending',
  facebook_url VARCHAR(255),
  instagram_url VARCHAR(255),
  linkedin_url VARCHAR(255),
  tiktok_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. PRODUITS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  short_description VARCHAR(500),
  price DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  sku VARCHAR(100),
  main_image_url VARCHAR(500),
  images JSONB DEFAULT '[]',
  weight_kg DECIMAL(6,2),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  seo_title VARCHAR(255),
  seo_description TEXT,
  views_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. COMMANDES
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE,
  user_id INTEGER REFERENCES users(id),
  supplier_id INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled, refunded
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_method VARCHAR(50),
  payment_intent_id VARCHAR(255),
  subtotal DECIMAL(10,2),
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'EUR',
  shipping_address JSONB,
  billing_address JSONB,
  tracking_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. DÉTAILS COMMANDES
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name VARCHAR(255),
  product_image VARCHAR(500),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  commission_amount DECIMAL(10,2) DEFAULT 0,
  supplier_amount DECIMAL(10,2) DEFAULT 0
);

-- ============================================
-- 8. PAIEMENTS FOURNISSEURS
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_payments (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  supplier_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, available, payout_requested, paid
  stripe_transfer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 9. PAYOUTS (VIREMENTS)
-- ============================================
CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  stripe_payout_id VARCHAR(255),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. PROMOTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- percentage, fixed, bogo
  value DECIMAL(10,2) NOT NULL,
  applies_to VARCHAR(50) DEFAULT 'all', -- all, category, products
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

-- ============================================
-- 11. AVIS/REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_promotions_supplier ON promotions(supplier_id);

-- ============================================
-- DONNÉES DE TEST (COMPTES)
-- ============================================

-- Client Test (mot de passe: Test1234!)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, country_code)
VALUES ('test@brandia.com', '$2b$10$YourHashedPasswordHere', 'John', 'Doe', 'client', true, 'FR')
ON CONFLICT (email) DO NOTHING;

-- Fournisseur Test (mot de passe: Supplier123!)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, country_code)
VALUES ('supplier@brandia.com', '$2b$10$YourHashedPasswordHere', 'Jane', 'Smith', 'supplier', true, 'FR')
ON CONFLICT (email) DO NOTHING;

-- Associer le fournisseur
INSERT INTO suppliers (user_id, company_name, description, category, stripe_account_status)
SELECT id, 'Luxe Beauty', 'Marque de cosmétiques premium', 'cosmetiques-soins-peau', 'pending'
FROM users WHERE email = 'supplier@brandia.com'
ON CONFLICT (user_id) DO NOTHING;

-- Produits de démo
INSERT INTO products (supplier_id, category_id, name, slug, description, short_description, price, compare_price, stock_quantity, sku, main_image_url, is_featured, is_active)
SELECT 
  u.id,
  c.id,
  'Sérum Hydratant Premium',
  'serum-hydratant-premium',
  '<p>Un sérum hydratant de qualité premium pour tous types de peau.</p>',
  'Sérum hydratant intense pour peau lumineuse',
  45.90,
  59.90,
  50,
  'LUXE-001',
  'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400',
  true,
  true
FROM users u, categories c
WHERE u.email = 'supplier@brandia.com' AND c.slug = 'cosmetiques-soins-peau'
ON CONFLICT DO NOTHING;