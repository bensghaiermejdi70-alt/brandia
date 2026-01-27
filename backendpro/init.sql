-- ============================================
-- BRANDIA DATABASE SCHEMA
-- ============================================

-- Drop tables if exist (for clean setup)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP TABLE IF EXISTS shipping_zones CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;

-- ============================================
-- 1. COUNTRIES (Pays, devises, TVA)
-- ============================================
CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,           -- FR, TN, DE, etc.
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    currency VARCHAR(3) NOT NULL,              -- EUR, TND, etc.
    vat_rate DECIMAL(5,2) DEFAULT 20.00,       -- TVA en %
    shipping_multiplier DECIMAL(5,2) DEFAULT 1.00, -- Multiplicateur frais de port
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. CATEGORIES (Catégories de produits)
-- ============================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. USERS (Clients et admins)
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),                -- NULL pour Google OAuth
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country_code VARCHAR(2) REFERENCES countries(code),
    role VARCHAR(20) DEFAULT 'customer',       -- customer, admin, supplier
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    google_id VARCHAR(255),                    -- Pour OAuth Google
    stripe_customer_id VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. SUPPLIERS (Fournisseurs/marques)
-- ============================================
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),      -- Lien vers compte user
    brand_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,         -- URL-friendly
    description TEXT,
    short_description VARCHAR(500),
    logo_url VARCHAR(500),
    banner_url VARCHAR(500),
    website VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    siret VARCHAR(14),
    vat_number VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country_code VARCHAR(2) REFERENCES countries(code),
    commission_rate DECIMAL(5,2) DEFAULT 15.00, -- % commission Brandia
    min_payout_amount DECIMAL(10,2) DEFAULT 50.00,
    is_featured BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    stripe_account_id VARCHAR(255),            -- Compte Stripe Connect
    payout_enabled BOOLEAN DEFAULT FALSE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. PRODUCTS (Produits)
-- ============================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),               -- Prix barré (promo)
    cost_price DECIMAL(10,2),                  -- Prix d'achat fournisseur
    currency VARCHAR(3) DEFAULT 'EUR',
    stock_quantity INTEGER DEFAULT 0,
    sku VARCHAR(100),                          -- Référence interne
    barcode VARCHAR(50),
    weight_grams INTEGER,                      -- Pour calcul frais port
    length_cm INTEGER,
    width_cm INTEGER,
    height_cm INTEGER,
    main_image_url VARCHAR(500),
    additional_images JSONB DEFAULT '[]',      -- Array d'URLs
    category_slug VARCHAR(50),                 -- beauty, sport, lifestyle
    tags JSONB DEFAULT '[]',                   -- Array de tags
    attributes JSONB DEFAULT '{}',             -- {color: "red", size: "M"}
    meta_title VARCHAR(255),
    meta_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_digital BOOLEAN DEFAULT FALSE,          -- Produit téléchargeable
    available_countries JSONB DEFAULT '["FR"]', -- ['FR', 'TN', 'DE']
    view_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. SHIPPING ZONES (Zones de livraison)
-- ============================================
CREATE TABLE shipping_zones (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    countries JSONB NOT NULL,                  -- ['FR', 'BE', 'LU']
    base_cost DECIMAL(10,2) DEFAULT 0.00,
    free_shipping_threshold DECIMAL(10,2),     -- Gratuit dès X €
    estimated_days_min INTEGER DEFAULT 3,
    estimated_days_max INTEGER DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. CARTS (Paniers)
-- ============================================
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),                   -- Pour visiteurs non connectés
    country_code VARCHAR(2) DEFAULT 'FR',
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- 8. CART ITEMS (Lignes de panier)
-- ============================================
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time DECIMAL(10,2) NOT NULL,      -- Prix au moment de l'ajout
    currency VARCHAR(3) NOT NULL,
    selected_options JSONB DEFAULT '{}',       -- {color: "blue", size: "L"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, product_id, selected_options)
);

-- ============================================
-- 9. ORDERS (Commandes)
-- ============================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,  -- BRD-2026-000001
    user_id INTEGER REFERENCES users(id),
    
    -- Informations client
    customer_email VARCHAR(255) NOT NULL,
    customer_first_name VARCHAR(100),
    customer_last_name VARCHAR(100),
    customer_phone VARCHAR(20),
    
    -- Adresse de livraison
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    shipping_postal_code VARCHAR(20) NOT NULL,
    shipping_country_code VARCHAR(2) NOT NULL,
    
    -- Adresse de facturation (si différente)
    billing_address TEXT,
    billing_city VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country_code VARCHAR(2),
    
    -- Totaux
    subtotal DECIMAL(10,2) NOT NULL,           -- Total HT produits
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    vat_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,       -- Total TTC
    
    -- Devises et TVA
    currency VARCHAR(3) NOT NULL,
    vat_rate DECIMAL(5,2) DEFAULT 20.00,
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending',      -- pending, paid, processing, shipped, delivered, cancelled, refunded
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
    shipping_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, shipped, delivered
    
    -- Paiement
    payment_method VARCHAR(50),                -- stripe, paypal, etc.
    stripe_payment_intent_id VARCHAR(255),
    stripe_transfer_group VARCHAR(255),
    
    -- Tracking
    tracking_number VARCHAR(100),
    shipping_carrier VARCHAR(50),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    
    -- Notes
    customer_note TEXT,
    internal_note TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. ORDER ITEMS (Lignes de commande)
-- ============================================
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    
    -- Informations produit (snapshot)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_image_url VARCHAR(500),
    
    -- Prix et quantités
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,         -- Prix unitaire HT
    vat_rate DECIMAL(5,2) DEFAULT 20.00,
    total_price DECIMAL(10,2) NOT NULL,        -- Prix total HT
    
    -- Split paiement
    supplier_amount DECIMAL(10,2) NOT NULL,    -- Montant pour le fournisseur
    commission_amount DECIMAL(10,2) NOT NULL,  -- Commission Brandia
    
    -- Statut livraison par fournisseur
    fulfillment_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, shipped, delivered
    
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. REVIEWS (Avis clients)
-- ============================================
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id),
    
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    
    helpful_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, user_id)
);

-- ============================================
-- 12. PAYOUTS (Paiements aux fournisseurs)
-- ============================================
CREATE TABLE payouts (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pending',      -- pending, processing, completed, failed
    
    -- Période couverte
    period_start DATE,
    period_end DATE,
    
    -- Stripe
    stripe_transfer_id VARCHAR(255),
    stripe_payout_id VARCHAR(255),
    
    -- Détails
    orders_included JSONB,                     -- IDs des commandes
    total_orders INTEGER DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    failure_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES POUR PERFORMANCES
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_role ON users(role);

-- Suppliers
CREATE INDEX idx_suppliers_slug ON suppliers(slug);
CREATE INDEX idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX idx_suppliers_featured ON suppliers(is_featured) WHERE is_featured = TRUE;

-- Products
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_price ON products(price);

-- Orders
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);

-- Order items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_supplier ON order_items(supplier_id);

-- Reviews
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Pays supportés
INSERT INTO countries (code, name, name_en, currency, vat_rate, shipping_multiplier) VALUES
('FR', 'France', 'France', 'EUR', 20.00, 1.00),
('BE', 'Belgique', 'Belgium', 'EUR', 21.00, 1.10),
('DE', 'Allemagne', 'Germany', 'EUR', 19.00, 1.20),
('IT', 'Italie', 'Italy', 'EUR', 22.00, 1.30),
('ES', 'Espagne', 'Spain', 'EUR', 21.00, 1.40),
('TN', 'Tunisie', 'Tunisia', 'TND', 19.00, 2.50),
('CH', 'Suisse', 'Switzerland', 'CHF', 7.70, 1.50),
('LU', 'Luxembourg', 'Luxembourg', 'EUR', 17.00, 1.10);

-- Catégories
INSERT INTO categories (name, slug, description, sort_order) VALUES
('Beauté & Soins', 'beauty', 'Produits cosmétiques et soins personnels', 1),
('Sport & Fitness', 'sport', 'Équipement sportif et nutrition', 2),
('Maison & Déco', 'home', 'Décoration et aménagement intérieur', 3),
('Mode & Accessoires', 'fashion', 'Vêtements, chaussures et accessoires', 4),
('Électronique', 'electronics', 'Gadgets et appareils électroniques', 5),
('Alimentation & Bio', 'food', 'Produits alimentaires et bio', 6);

-- Admin par défaut (password: Admin123!)
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified) VALUES
('admin@brandia.com', '$2b$10$YourHashedPasswordHere', 'Admin', 'Brandia', 'admin', TRUE);

-- ============================================
-- TRIGGERS POUR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();