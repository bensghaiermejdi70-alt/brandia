// ============================================
// SUPPLIER.CONTROLLER.JS - v6.7 EMERGENCY FIX
// Fix: Multer field name consistency, SQL query fixes for campaigns, better error handling
// ============================================

const crypto = require('crypto');
const path = require('path');

// ============================================
// DATABASE SETUP
// ============================================

let db;
try {
    db = require('../../config/db');
} catch (e) {
    console.error('[SupplierController] ❌ Cannot load database module:', e.message);
    db = { query: async () => { throw new Error('Database not configured'); } };
}

// ============================================
// UUID GENERATION
// ============================================

const generateUUID = () => {
    try {
        if (crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = crypto.randomBytes(1)[0] % 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// ============================================
// SQL HELPERS
// ============================================

const detectDbType = () => {
    try {
        if (db.pool && db.pool.options && db.pool.options.database) return 'postgres';
        if (db.connection && db.connection.config) return 'mysql';
        return 'mysql';
    } catch (e) {
        return 'mysql';
    }
};

const DB_TYPE = detectDbType();
console.log(`[SupplierController] Database: ${DB_TYPE}`);

const ph = (i) => DB_TYPE === 'postgres' ? `$${i}` : '?';

const normalizeResult = (result) => {
    if (!result) return [];
    if (result.rows !== undefined) return result.rows;
    if (Array.isArray(result)) {
        if (result.length > 0 && Array.isArray(result[0])) return result[0];
        return result;
    }
    return [];
};

const first = (r) => normalizeResult(r)[0] || null;
const affected = (r) => r?.rowCount ?? r?.affectedRows ?? (Array.isArray(r) ? r[0]?.affectedRows : 0) ?? 0;

// ============================================
// ERROR HANDLING
// ============================================

const handleError = (res, error, msg = 'Erreur serveur', status = 500) => {
    console.error(`[SupplierController] ${msg}:`, error.message);
    
    // Détection des erreurs de table manquante
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.status(500).json({
            success: false,
            message: 'Erreur de configuration base de données. Contactez l\\'administrateur.',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Table not found',
            code: 'DB_CONFIG_ERROR'
        });
    }
    
    // Erreur opérateur PostgreSQL (text = integer)
    if (error.code === '42883' || error.message?.includes('operator does not exist')) {
        return res.status(400).json({
            success: false,
            message: 'Erreur de type de données. Vérifiez les IDs envoyés.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    
    return res.status(status).json({
        success: false,
        message: msg,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

const validateRequired = (fields, data) => fields.filter(f => 
    data[f] === undefined || data[f] === null || data[f] === ''
);

const safeJsonParse = (str) => {
    if (!str) return {};
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch (e) { return {}; }
};

const safeJsonStringify = (obj) => {
    if (!obj) return '{}';
    if (typeof obj === 'string') return obj;
    try { return JSON.stringify(obj); } catch (e) { return '{}'; }
};

// ============================================
// STATS (avec fallback si tables manquantes)
// ============================================

const getStats = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        // Essayer de récupérer les stats, avec fallback à 0 si erreur
        const safeQuery = async (query, params, defaultValue = 0) => {
            try {
                const result = await db.query(query, params);
                return first(result)?.count || first(result)?.total_orders || first(result)?.total_revenue || defaultValue;
            } catch (e) {
                console.log(`[Stats] Query failed (table may not exist): ${e.message}`);
                return defaultValue;
            }
        };

        const [products, orders, campaigns, pending] = await Promise.all([
            safeQuery(`SELECT COUNT(*) as count FROM products WHERE supplier_id = ${ph(1)}`, [supplierId], 0),
            safeQuery(`
                SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue
                FROM orders WHERE supplier_id = ${ph(1)} AND status != 'cancelled'
            `, [supplierId], { total_orders: 0, total_revenue: 0 }),
            safeQuery(`
                SELECT COUNT(*) as count FROM campaigns 
                WHERE supplier_id = ${ph(1)} AND status = 'active' AND end_date > NOW()
            `, [supplierId], 0),
            safeQuery(`
                SELECT COUNT(*) as count FROM orders WHERE supplier_id = ${ph(1)} AND status = 'pending'
            `, [supplierId], 0)
        ]);

        res.json({
            success: true,
            data: {
                products_count: typeof products === 'object' ? products.count || 0 : products,
                total_orders: typeof orders === 'object' ? orders.total_orders || 0 : 0,
                total_revenue: parseFloat(typeof orders === 'object' ? orders.total_revenue || 0 : 0),
                active_campaigns: typeof campaigns === 'object' ? campaigns.count || 0 : campaigns,
                pending_orders: typeof pending === 'object' ? pending.count || 0 : pending
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des statistiques');
    }
};

// ============================================
// PRODUCTS
// ============================================

const getProducts = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = `SELECT * FROM products WHERE supplier_id = ${ph(1)}`;
        let params = [supplierId];
        let countQuery = `SELECT COUNT(*) as total FROM products WHERE supplier_id = ${ph(1)}`;
        let countParams = [supplierId];

        if (search) {
            const searchClause = DB_TYPE === 'postgres' 
                ? ` AND (name ILIKE ${ph(2)} OR sku ILIKE ${ph(3)})`
                : ` AND (name LIKE ${ph(2)} OR sku LIKE ${ph(3)})`;
            query += searchClause;
            countQuery += searchClause;
            const pattern = `%${search}%`;
            params.push(pattern, pattern);
            countParams.push(pattern, pattern);
        }

        query += ` ORDER BY created_at DESC LIMIT ${ph(params.length + 1)} OFFSET ${ph(params.length + 2)}`;
        params.push(parseInt(limit), offset);

        const [products, count] = await Promise.all([
            db.query(query, params),
            db.query(countQuery, countParams)
        ]);

        res.json({
            success: true,
            data: normalizeResult(products),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: first(count)?.total || 0
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des produits');
    }
};

const createProduct = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const { name, price } = req.body;
        const missing = validateRequired(['name', 'price'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Champs requis: ${missing.join(', ')}` });
        }

        const id = generateUUID();
        const now = new Date().toISOString();

        await db.query(`
            INSERT INTO products (id, supplier_id, name, description, price, compare_price, cost_price, sku, 
                barcode, inventory_quantity, category, images, variants, seo_title, seo_description, status, created_at)
            VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, ${ph(6)}, ${ph(7)}, ${ph(8)},
                ${ph(9)}, ${ph(10)}, ${ph(11)}, ${ph(12)}, ${ph(13)}, ${ph(14)}, ${ph(15)}, 'active', ${ph(16)})
        `, [
            id, supplierId, name, req.body.description || '', parseFloat(price) || 0, req.body.compare_price || null,
            req.body.cost_price || null, req.body.sku || null, req.body.barcode || null, 
            req.body.inventory_quantity || 0, req.body.category || null,
            JSON.stringify(req.body.images || []), JSON.stringify(req.body.variants || []),
            req.body.seo_title || null, req.body.seo_description || null, now
        ]);

        const result = await db.query(`SELECT * FROM products WHERE id = ${ph(1)}`, [id]);
        res.status(201).json({ success: true, message: 'Produit créé', data: first(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création du produit');
    }
};

const updateProduct = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const existing = await db.query(`SELECT id FROM products WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`, [id, supplierId]);
        if (normalizeResult(existing).length === 0) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        const allowed = ['name', 'description', 'price', 'compare_price', 'cost_price', 'sku', 'barcode', 
                        'inventory_quantity', 'category', 'images', 'variants', 'seo_title', 'seo_description', 'status'];
        
        const updates = [];
        const values = [];

        allowed.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ${ph(values.length + 1)}`);
                values.push(['images', 'variants'].includes(field) ? JSON.stringify(req.body[field]) : req.body[field]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }

        values.push(id);
        values.push(supplierId);

        await db.query(`UPDATE products SET ${updates.join(', ')}, updated_at = NOW() 
                       WHERE id = ${ph(values.length - 1)} AND supplier_id = ${ph(values.length)}`, values);

        const result = await db.query(`SELECT * FROM products WHERE id = ${ph(1)}`, [id]);
        res.json({ success: true, message: 'Produit mis à jour', data: first(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour du produit');
    }
};

const deleteProduct = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const result = await db.query(`DELETE FROM products WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`, [id, supplierId]);
        
        if (affected(result) === 0) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        res.json({ success: true, message: 'Produit supprimé' });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression du produit');
    }
};

// ============================================
// ORDERS
// ============================================

const getOrders = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = `SELECT * FROM orders WHERE supplier_id = ${ph(1)}`;
        let params = [supplierId];

        if (status) {
            query += ` AND status = ${ph(2)}`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT ${ph(params.length + 1)} OFFSET ${ph(params.length + 2)}`;
        params.push(parseInt(limit), offset);

        const result = await db.query(query, params);
        const orders = normalizeResult(result).map(order => ({
            ...order,
            items: safeJsonParse(order.items),
            shipping_address: safeJsonParse(order.shipping_address)
        }));

        res.json({ success: true, data: orders });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des commandes');
    }
};

const getOrderById = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const result = await db.query(`SELECT * FROM orders WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`, [id, supplierId]);
        const orders = normalizeResult(result);

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }

        const order = {
            ...orders[0],
            items: safeJsonParse(orders[0].items),
            shipping_address: safeJsonParse(orders[0].shipping_address)
        };

        res.json({ success: true, data: order });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération de la commande');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        const { status, tracking_number } = req.body;
        
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const valid = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!valid.includes(status)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        const result = await db.query(`
            UPDATE orders SET status = ${ph(1)}, tracking_number = ${ph(2)}, updated_at = NOW()
            WHERE id = ${ph(3)} AND supplier_id = ${ph(4)}
        `, [status, tracking_number || null, id, supplierId]);

        if (affected(result) === 0) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }

        res.json({ success: true, message: 'Statut mis à jour' });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour du statut');
    }
};

// ============================================
// CAMPAIGNS - CORRECTIONS MAJEURES
// ============================================

const getCampaigns = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        // 🔥 CORRECTION: Cast explicite de supplier_id en texte pour PostgreSQL
        // ou utilisation de requête paramétrée correcte
        const result = await db.query(`
            SELECT c.*, p.name as product_name, p.images as product_images 
            FROM campaigns c 
            LEFT JOIN products p ON c.product_id::text = p.id::text 
            WHERE c.supplier_id::text = ${ph(1)}::text
            ORDER BY c.created_at DESC
        `, [supplierId.toString()]);

        const campaigns = normalizeResult(result).map(c => ({
            ...c,
            targeting: safeJsonParse(c.targeting),
            ad_creative: safeJsonParse(c.ad_creative),
            product_images: safeJsonParse(c.product_images)
        }));

        res.json({ success: true, data: campaigns });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des campagnes');
    }
};

const getCampaignLimit = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const result = await db.query(`
            SELECT COUNT(*) as count FROM campaigns WHERE supplier_id::text = ${ph(1)}::text AND status != 'ended'
        `, [supplierId.toString()]);

        const count = first(result)?.count || 0;
        
        res.json({
            success: true,
            data: {
                max_campaigns: 5,
                current_campaigns: parseInt(count),
                can_create: count < 5,
                remaining: Math.max(0, 5 - count)
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération de la limite');
    }
};

const createCampaign = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const { name, product_id, budget, start_date, end_date, targeting, ad_creative, ad_format, cta_link, status } = req.body;
        
        // Validation des champs requis
        const missing = validateRequired(['name', 'product_id', 'budget', 'start_date', 'end_date'], req.body);
        
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Champs requis: ${missing.join(', ')}` });
        }

        // Vérifier limite
        const countResult = await db.query(`
            SELECT COUNT(*) as count FROM campaigns WHERE supplier_id::text = ${ph(1)}::text AND status != 'ended'
        `, [supplierId.toString()]);

        if (first(countResult)?.count >= 5) {
            return res.status(400).json({ success: false, message: 'Limite de 5 campagnes atteinte' });
        }

        // Vérifier produit - 🔥 CORRECTION: Comparaison de types cohérents
        let productCheckQuery;
        if (DB_TYPE === 'postgres') {
            productCheckQuery = `SELECT id FROM products WHERE id::text = ${ph(1)}::text AND supplier_id::text = ${ph(2)}::text`;
        } else {
            productCheckQuery = `SELECT id FROM products WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`;
        }
        
        const product = await db.query(productCheckQuery, [product_id.toString(), supplierId.toString()]);
        
        if (normalizeResult(product).length === 0) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        const id = generateUUID();
        const now = new Date().toISOString();

        // 🔥 CORRECTION: Gestion correcte des types pour PostgreSQL
        const query = DB_TYPE === 'postgres' 
            ? `INSERT INTO campaigns (id, supplier_id, name, product_id, budget, daily_budget, start_date, end_date,
                targeting, ad_creative, ad_format, status, spent, impressions, clicks, conversions, created_at, cta_link)
            VALUES (${ph(1)}, ${ph(2)}::text, ${ph(3)}, ${ph(4)}::integer, ${ph(5)}, ${ph(6)}, ${ph(7)}, ${ph(8)},
                ${ph(9)}::jsonb, ${ph(10)}::jsonb, ${ph(11)}, ${ph(12)}, 0, 0, 0, 0, ${ph(13)}, ${ph(14)})`
            : `INSERT INTO campaigns (id, supplier_id, name, product_id, budget, daily_budget, start_date, end_date,
                targeting, ad_creative, ad_format, status, spent, impressions, clicks, conversions, created_at, cta_link)
            VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, ${ph(6)}, ${ph(7)}, ${ph(8)},
                ${ph(9)}, ${ph(10)}, ${ph(11)}, ${ph(12)}, 0, 0, 0, 0, ${ph(13)}, ${ph(14)})`;

        await db.query(query, [
            id, 
            supplierId.toString(), 
            name, 
            parseInt(product_id) || product_id, 
            parseFloat(budget) || 100, 
            req.body.daily_budget || null,
            start_date, 
            end_date,
            safeJsonStringify(targeting || {}),
            safeJsonStringify(ad_creative || {}),
            ad_format || 'overlay',
            status || 'pending',
            now,
            cta_link || null
        ]);

        const result = await db.query(`SELECT * FROM campaigns WHERE id = ${ph(1)}`, [id]);
        res.status(201).json({ success: true, message: 'Campagne créée', data: first(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création de la campagne');
    }
};

const updateCampaign = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        // 🔥 CORRECTION: Vérification avec cast de type
        const existingQuery = DB_TYPE === 'postgres'
            ? `SELECT id FROM campaigns WHERE id::text = ${ph(1)}::text AND supplier_id::text = ${ph(2)}::text`
            : `SELECT id FROM campaigns WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`;
            
        const existing = await db.query(existingQuery, [id.toString(), supplierId.toString()]);
        
        if (normalizeResult(existing).length === 0) {
            return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
        }

        const allowed = ['name', 'budget', 'daily_budget', 'start_date', 'end_date', 'targeting', 'ad_creative', 'ad_format', 'status', 'cta_link'];
        const updates = [];
        const values = [];

        allowed.forEach(field => {
            if (req.body[field] !== undefined) {
                // 🔥 CORRECTION: Gestion JSON pour PostgreSQL
                if (DB_TYPE === 'postgres' && ['targeting', 'ad_creative'].includes(field)) {
                    updates.push(`${field} = ${ph(values.length + 1)}::jsonb`);
                    values.push(safeJsonStringify(req.body[field]));
                } else {
                    updates.push(`${field} = ${ph(values.length + 1)}`);
                    values.push(req.body[field]);
                }
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }

        values.push(id);
        
        const updateQuery = DB_TYPE === 'postgres'
            ? `UPDATE campaigns SET ${updates.join(', ')}, updated_at = NOW() WHERE id::text = ${ph(values.length)}::text`
            : `UPDATE campaigns SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${ph(values.length)}`;
            
        await db.query(updateQuery, values);

        const result = await db.query(`SELECT * FROM campaigns WHERE id = ${ph(1)}`, [id]);
        res.json({ success: true, message: 'Campagne mise à jour', data: first(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour de la campagne');
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const query = DB_TYPE === 'postgres'
            ? `SELECT spent FROM campaigns WHERE id::text = ${ph(1)}::text AND supplier_id::text = ${ph(2)}::text`
            : `SELECT spent FROM campaigns WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`;
            
        const campaign = await db.query(query, [id.toString(), supplierId.toString()]);
        
        const data = first(campaign);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
        }

        if (parseFloat(data.spent) > 0) {
            return res.status(400).json({ success: false, message: 'Impossible de supprimer une campagne avec dépenses' });
        }

        const deleteQuery = DB_TYPE === 'postgres'
            ? `DELETE FROM campaigns WHERE id::text = ${ph(1)}::text AND supplier_id::text = ${ph(2)}::text`
            : `DELETE FROM campaigns WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`;
            
        await db.query(deleteQuery, [id.toString(), supplierId.toString()]);
        res.json({ success: true, message: 'Campagne supprimée' });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression de la campagne');
    }
};

const toggleCampaignStatus = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        const { status } = req.body;
        
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const valid = ['active', 'paused', 'pending', 'ended'];
        if (!valid.includes(status)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        const query = DB_TYPE === 'postgres'
            ? `SELECT id FROM campaigns WHERE id::text = ${ph(1)}::text AND supplier_id::text = ${ph(2)}::text`
            : `SELECT id FROM campaigns WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`;
            
        const existing = await db.query(query, [id.toString(), supplierId.toString()]);
        
        if (normalizeResult(existing).length === 0) {
            return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
        }

        const updateQuery = DB_TYPE === 'postgres'
            ? `UPDATE campaigns SET status = ${ph(1)}, updated_at = NOW() WHERE id::text = ${ph(2)}::text`
            : `UPDATE campaigns SET status = ${ph(1)}, updated_at = NOW() WHERE id = ${ph(2)}`;
            
        await db.query(updateQuery, [status, id]);
        res.json({ success: true, message: `Campagne ${status === 'active' ? 'activée' : 'mise en pause'}` });
    } catch (error) {
        return handleError(res, error, 'Erreur lors du changement de statut');
    }
};

// Méthodes publiques
const getActiveCampaignForProduct = async (req, res) => {
    try {
        const { supplier, product } = req.query;
        if (!supplier || !product) {
            return res.status(400).json({ success: false, message: 'supplier et product requis' });
        }

        const query = DB_TYPE === 'postgres'
            ? `SELECT c.*, p.name as product_name, p.images as product_images, p.price
            FROM campaigns c
            JOIN products p ON c.product_id::text = p.id::text
            WHERE c.supplier_id::text = ${ph(1)}::text AND c.product_id::text = ${ph(2)}::text
                AND c.status = 'active' AND c.start_date <= NOW() AND c.end_date >= NOW()
            ORDER BY c.created_at DESC LIMIT 1`
            : `SELECT c.*, p.name as product_name, p.images as product_images, p.price
            FROM campaigns c
            JOIN products p ON c.product_id = p.id
            WHERE c.supplier_id = ${ph(1)} AND c.product_id = ${ph(2)}
                AND c.status = 'active' AND c.start_date <= NOW() AND c.end_date >= NOW()
            ORDER BY c.created_at DESC LIMIT 1`;

        const result = await db.query(query, [supplier.toString(), product.toString()]);
        const campaigns = normalizeResult(result);
        
        if (campaigns.length === 0) {
            return res.json({ success: true, data: null });
        }

        res.json({
            success: true,
            data: {
                ...campaigns[0],
                targeting: safeJsonParse(campaigns[0].targeting),
                ad_creative: safeJsonParse(campaigns[0].ad_creative),
                product_images: safeJsonParse(campaigns[0].product_images)
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération de la campagne');
    }
};

const trackCampaignView = async (req, res) => {
    try {
        const { campaign_id } = req.body;
        if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

        const query = DB_TYPE === 'postgres'
            ? `UPDATE campaigns SET impressions = impressions + 1 WHERE id::text = ${ph(1)}::text`
            : `UPDATE campaigns SET impressions = impressions + 1 WHERE id = ${ph(1)}`;
            
        await db.query(query, [campaign_id.toString()]);
        res.json({ success: true, message: 'View tracked' });
    } catch (error) {
        return handleError(res, error, 'Erreur tracking');
    }
};

const trackCampaignClick = async (req, res) => {
    try {
        const { campaign_id } = req.body;
        if (!campaign_id) return res.status(400).json({ success: false, message: 'campaign_id requis' });

        const query = DB_TYPE === 'postgres'
            ? `UPDATE campaigns SET clicks = clicks + 1 WHERE id::text = ${ph(1)}::text`
            : `UPDATE campaigns SET clicks = clicks + 1 WHERE id = ${ph(1)}`;
            
        await db.query(query, [campaign_id.toString()]);
        res.json({ success: true, message: 'Click tracked' });
    } catch (error) {
        return handleError(res, error, 'Erreur tracking');
    }
};

// ============================================
// UPLOAD - CORRECTIONS MULTER
// ============================================

// Configuration multer pour upload
let uploadMiddleware;
try {
    const multer = require('multer');
    const storage = multer.memoryStorage();
    uploadMiddleware = multer({ 
        storage,
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
        fileFilter: (req, file, cb) => {
            const allowedImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime'];
            
            if (allowedImages.includes(file.mimetype) || allowedVideos.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Type de fichier non supporté. Utilisez: JPEG, PNG, GIF, WEBP, MP4, WEBM'), false);
            }
        }
    });
} catch (e) {
    console.log('[SupplierController] Multer not available, upload disabled');
    uploadMiddleware = null;
}

// Upload vers Cloudinary (ou stockage local si Cloudinary non config)
const uploadToCloudinary = async (fileBuffer, filename, resourceType = 'image') => {
    try {
        const cloudinary = require('cloudinary').v2;
        
        // Vérifier config Cloudinary
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            throw new Error('Cloudinary not configured');
        }

        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    folder: 'brandia/campaigns',
                    public_id: `${Date.now()}_${filename.replace(/\.[^/.]+$/, '')}`
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );
            stream.end(fileBuffer);
        });
    } catch (e) {
        // Fallback: sauvegarder localement si Cloudinary non dispo
        if (process.env.NODE_ENV === 'development') {
            const fs = require('fs').promises;
            const path = require('path');
            const uploadDir = path.join(__dirname, '../../../uploads');
            
            await fs.mkdir(uploadDir, { recursive: true });
            const localPath = path.join(uploadDir, `${Date.now()}_${filename}`);
            await fs.writeFile(localPath, fileBuffer);
            
            return `/uploads/${path.basename(localPath)}`;
        }
        throw e;
    }
};

const uploadImage = async (req, res) => {
    try {
        if (!uploadMiddleware) {
            return res.status(501).json({ success: false, message: 'Upload non configuré' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
        }

        const url = await uploadToCloudinary(req.file.buffer, req.file.originalname, 'image');

        res.json({
            success: true,
            message: 'Image uploadée',
            data: { url, filename: req.file.originalname }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de l\\'upload de l\\'image');
    }
};

const uploadVideo = async (req, res) => {
    try {
        if (!uploadMiddleware) {
            return res.status(501).json({ success: false, message: 'Upload non configuré' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
        }

        const url = await uploadToCloudinary(req.file.buffer, req.file.originalname, 'video');

        res.json({
            success: true,
            message: 'Vidéo uploadée',
            data: { url, filename: req.file.originalname }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de l\\'upload de la vidéo');
    }
};

// ============================================
// PAYMENTS (avec graceful degradation)
// ============================================

const getPayments = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        // Essayer de récupérer les paiements, retourner des valeurs par défaut si tables manquantes
        let balance = 0;
        let pending = 0;
        let transactions = [];

        try {
            const balanceResult = await db.query(`
                SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
                FROM transactions WHERE supplier_id::text = ${ph(1)}::text
            `, [supplierId.toString()]);
            balance = parseFloat(first(balanceResult)?.balance || 0);
        } catch (e) {
            console.log('[Payments] transactions table not available');
        }

        try {
            const pendingResult = await db.query(`
                SELECT COALESCE(SUM(amount), 0) as pending 
                FROM payouts WHERE supplier_id::text = ${ph(1)}::text AND status = 'pending'
            `, [supplierId.toString()]);
            pending = parseFloat(first(pendingResult)?.pending || 0);
        } catch (e) {
            console.log('[Payments] payouts table not available');
        }

        try {
            const transResult = await db.query(`
                SELECT * FROM transactions WHERE supplier_id::text = ${ph(1)}::text ORDER BY created_at DESC LIMIT 50
            `, [supplierId.toString()]);
            transactions = normalizeResult(transResult);
        } catch (e) {
            console.log('[Payments] transactions table not available for list');
        }

        res.json({
            success: true,
            data: {
                balance,
                pending_payout: pending,
                transactions,
                note: transactions.length === 0 ? 'Système de paiement en cours de configuration' : undefined
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des paiements');
    }
};

const requestPayout = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const { amount, method } = req.body;
        if (!amount || parseFloat(amount) < 50) {
            return res.status(400).json({ success: false, message: 'Montant minimum: 50€' });
        }

        // Vérifier solde
        const balanceResult = await db.query(`
            SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
            FROM transactions WHERE supplier_id::text = ${ph(1)}::text
        `, [supplierId.toString()]);

        const balance = parseFloat(first(balanceResult)?.balance || 0);
        if (parseFloat(amount) > balance) {
            return res.status(400).json({ success: false, message: 'Solde insuffisant' });
        }

        const id = generateUUID();
        const now = new Date().toISOString();

        await db.query(`
            INSERT INTO payouts (id, supplier_id, amount, method, status, created_at) 
            VALUES (${ph(1)}, ${ph(2)}::text, ${ph(3)}, ${ph(4)}, 'pending', ${ph(5)})
        `, [id, supplierId.toString(), parseFloat(amount), method || 'bank_transfer', now]);

        await db.query(`
            INSERT INTO transactions (id, supplier_id, type, amount, description, created_at) 
            VALUES (${ph(1)}, ${ph(2)}::text, 'debit', ${ph(3)}, ${ph(4)}, ${ph(5)})
        `, [generateUUID(), supplierId.toString(), parseFloat(amount), `Retrait #${id}`, now]);

        res.json({ success: true, message: 'Demande de retrait créée', data: { payout_id: id } });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création du retrait');
    }
};

const getPayouts = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const result = await db.query(`
            SELECT * FROM payouts WHERE supplier_id::text = ${ph(1)}::text ORDER BY created_at DESC
        `, [supplierId.toString()]);

        res.json({ success: true, data: normalizeResult(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des retraits');
    }
};

// ============================================
// PROMOTIONS
// ============================================

const getPromotions = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const result = await db.query(`
            SELECT * FROM promotions WHERE supplier_id::text = ${ph(1)}::text ORDER BY created_at DESC
        `, [supplierId.toString()]);

        res.json({ success: true, data: normalizeResult(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des promotions');
    }
};

const createPromotion = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const { code, discount_type, discount_value } = req.body;
        const missing = validateRequired(['code', 'discount_type', 'discount_value'], req.body);
        
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Champs requis: ${missing.join(', ')}` });
        }

        const id = generateUUID();
        const now = new Date().toISOString();

        await db.query(`
            INSERT INTO promotions (id, supplier_id, code, discount_type, discount_value,
                minimum_order, start_date, end_date, usage_limit, usage_count, status, created_at)
            VALUES (${ph(1)}, ${ph(2)}::text, ${ph(3)}, ${ph(4)}, ${ph(5)},
                ${ph(6)}, ${ph(7)}, ${ph(8)}, ${ph(9)}, 0, 'active', ${ph(10)})
        `, [
            id, supplierId.toString(), code, discount_type, parseFloat(discount_value) || 0,
            req.body.minimum_order || 0, req.body.start_date || now, req.body.end_date || null,
            req.body.usage_limit || null, now
        ]);

        const result = await db.query(`SELECT * FROM promotions WHERE id = ${ph(1)}`, [id]);
        res.status(201).json({ success: true, message: 'Promotion créée', data: first(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création de la promotion');
    }
};

const updatePromotion = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const allowed = ['code', 'discount_type', 'discount_value', 'minimum_order', 'start_date', 'end_date', 'usage_limit', 'status'];
        const updates = [];
        const values = [];

        allowed.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ${ph(values.length + 1)}`);
                values.push(req.body[field]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }

        values.push(id);
        values.push(supplierId);

        const query = DB_TYPE === 'postgres'
            ? `UPDATE promotions SET ${updates.join(', ')}, updated_at = NOW() 
               WHERE id::text = ${ph(values.length - 1)}::text AND supplier_id::text = ${ph(values.length)}::text`
            : `UPDATE promotions SET ${updates.join(', ')}, updated_at = NOW() 
               WHERE id = ${ph(values.length - 1)} AND supplier_id = ${ph(values.length)}`;

        await db.query(query, values);

        const result = await db.query(`SELECT * FROM promotions WHERE id = ${ph(1)}`, [id]);
        res.json({ success: true, message: 'Promotion mise à jour', data: first(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour de la promotion');
    }
};

const deletePromotion = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const query = DB_TYPE === 'postgres'
            ? `DELETE FROM promotions WHERE id::text = ${ph(1)}::text AND supplier_id::text = ${ph(2)}::text`
            : `DELETE FROM promotions WHERE id = ${ph(1)} AND supplier_id = ${ph(2)}`;

        await db.query(query, [id.toString(), supplierId.toString()]);
        res.json({ success: true, message: 'Promotion supprimée' });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression de la promotion');
    }
};

// ============================================
// AD SETTINGS
// ============================================

const getAdSettings = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) return res.status(401).json({ success: false, message: 'Non authentifié' });

        const result = await db.query(`SELECT * FROM supplier_ad_settings WHERE supplier_id::text = ${ph(1)}::text`, [supplierId.toString()]);
        const settings = normalizeResult(result);

        if (settings.length === 0) {
            return res.json({
                success: true,
                data: {
                    max_ads_per_session: 1,
                    priority: 5,
                    is_active: true
                }
            });
        }

        res.json({ success: true, data: settings[0] });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des paramètres');
    }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Stats
    getStats,
    
    // Products
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    
    // Orders
    getOrders,
    getOrderById,
    updateOrderStatus,
    
    // Campaigns
    getCampaigns,
    getCampaignLimit,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaignStatus,
    getActiveCampaignForProduct,
    trackCampaignView,
    trackCampaignClick,
    
    // Upload - 🔥 CORRECTION: Utiliser 'media' comme nom de champ pour correspondre au frontend
    uploadImageMiddleware: uploadMiddleware?.single('media') || null,
    uploadVideoMiddleware: uploadMiddleware?.single('media') || null,
    uploadImage,
    uploadVideo,
    
    // Payments
    getPayments,
    requestPayout,
    getPayouts,
    
    // Promotions
    getPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    
    // Ad Settings
    getAdSettings
};
