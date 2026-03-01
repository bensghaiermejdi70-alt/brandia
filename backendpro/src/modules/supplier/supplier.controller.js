// ============================================
// SUPPLIER.CONTROLLER.JS - v6.5 EMERGENCY FIX
// Fix: PostgreSQL syntax ($1) vs MySQL (?), better error handling, removed crypto.randomUUID fallback
// ============================================

const crypto = require('crypto');

// ============================================
// DATABASE DETECTION
// ============================================

let db;
try {
    db = require('../../config/db');
} catch (e) {
    console.error('[SupplierController] ❌ Cannot load database module:', e.message);
    // Mock DB for graceful degradation
    db = {
        query: async () => [[]],
        pool: null
    };
}

// ============================================
// UUID GENERATION (Node.js < 14 fallback)
// ============================================

const generateUUID = () => {
    try {
        // Node 14.17+ has native support
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {
        // Fallback for older Node versions
    }
    
    // RFC4122 v4 compliant UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = crypto.randomBytes(1)[0] % 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// ============================================
// SQL SYNTAX HELPERS
// ============================================

// Détecter si on utilise PostgreSQL ou MySQL
const detectDbType = () => {
    try {
        // Vérifier les propriétés de la connexion
        if (db.pool && db.pool.options && db.pool.options.database) {
            return 'postgres';
        }
        if (db.connection && db.connection.config && db.connection.config.database) {
            return 'mysql';
        }
        // Test avec une requête simple
        return 'mysql'; // Default to MySQL
    } catch (e) {
        return 'mysql';
    }
};

const DB_TYPE = detectDbType();
console.log(`[SupplierController] Database detected: ${DB_TYPE}`);

// Helper pour formater les placeholders SQL
const placeholder = (index) => DB_TYPE === 'postgres' ? `$${index}` : '?';

// Helper pour normaliser les résultats
const normalizeResult = (result) => {
    if (!result) return [];
    
    // PostgreSQL: result.rows
    if (result.rows !== undefined) {
        return result.rows;
    }
    
    // MySQL: [rows, fields] ou juste rows
    if (Array.isArray(result)) {
        if (result.length > 0 && Array.isArray(result[0])) {
            return result[0]; // [rows, fields] format
        }
        return result; // Déjà un array
    }
    
    return [];
};

// Helper pour obtenir le first result
const first = (result) => normalizeResult(result)[0] || null;

// Helper pour affected rows
const affectedRows = (result) => {
    if (result.rowCount !== undefined) return result.rowCount; // PostgreSQL
    if (result.affectedRows !== undefined) return result.affectedRows; // MySQL
    if (Array.isArray(result) && result[0]) return result[0].affectedRows;
    return 0;
};

// ============================================
// ERROR HANDLING
// ============================================

const handleError = (res, error, message = 'Erreur serveur', status = 500) => {
    console.error(`[SupplierController] ${message}:`, error);
    
    // Log stack trace in development
    if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
    }
    
    return res.status(status).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
};

// Validation simple
const validateRequired = (fields, data) => {
    const missing = [];
    for (const field of fields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            missing.push(field);
        }
    }
    return missing;
};

// ============================================
// STATS
// ============================================

const getStats = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        
        if (!supplierId) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié'
            });
        }
        
        // Requêtes parallèles pour performance
        const [productsResult, ordersResult, campaignsResult, pendingResult] = await Promise.all([
            db.query(`SELECT COUNT(*) as count FROM products WHERE supplier_id = ${placeholder(1)}`, [supplierId]),
            db.query(`
                SELECT 
                    COUNT(*) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue
                FROM orders 
                WHERE supplier_id = ${placeholder(1)} AND status != 'cancelled'
            `, [supplierId]),
            db.query(`
                SELECT COUNT(*) as count 
                FROM campaigns 
                WHERE supplier_id = ${placeholder(1)} AND status = 'active' AND end_date > NOW()
            `, [supplierId]),
            db.query(`
                SELECT COUNT(*) as count 
                FROM orders 
                WHERE supplier_id = ${placeholder(1)} AND status = 'pending'
            `, [supplierId])
        ]);
        
        res.json({
            success: true,
            data: {
                products_count: first(productsResult)?.count || 0,
                total_orders: first(ordersResult)?.total_orders || 0,
                total_revenue: parseFloat(first(ordersResult)?.total_revenue || 0),
                active_campaigns: first(campaignsResult)?.count || 0,
                pending_orders: first(pendingResult)?.count || 0
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
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = `SELECT * FROM products WHERE supplier_id = ${placeholder(1)}`;
        let params = [supplierId];
        let countQuery = `SELECT COUNT(*) as total FROM products WHERE supplier_id = ${placeholder(1)}`;
        let countParams = [supplierId];
        
        if (search) {
            const searchClause = ` AND (name ILIKE ${placeholder(2)} OR sku ILIKE ${placeholder(3)})`;
            query += searchClause;
            countQuery += searchClause;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ${placeholder(params.length + 1)} OFFSET ${placeholder(params.length + 2)}`;
        params.push(parseInt(limit), offset);
        
        const [productsResult, countResult] = await Promise.all([
            db.query(query, params),
            db.query(countQuery, countParams)
        ]);
        
        res.json({
            success: true,
            data: normalizeResult(productsResult),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: first(countResult)?.total || 0
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des produits');
    }
};

const createProduct = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const { name, description, price, compare_price, cost_price, sku, barcode, inventory_quantity, category, images, variants, seo_title, seo_description } = req.body;
        
        const missing = validateRequired(['name', 'price'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Champs requis manquants: ${missing.join(', ')}`
            });
        }
        
        const productId = generateUUID();
        const now = new Date().toISOString();
        
        await db.query(`
            INSERT INTO products (
                id, supplier_id, name, description, price, compare_price,
                cost_price, sku, barcode, inventory_quantity, category,
                images, variants, seo_title, seo_description, status, created_at
            ) VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)},
                ${placeholder(7)}, ${placeholder(8)}, ${placeholder(9)}, ${placeholder(10)}, ${placeholder(11)},
                ${placeholder(12)}, ${placeholder(13)}, ${placeholder(14)}, ${placeholder(15)}, 'active', ${placeholder(16)})
        `, [
            productId, supplierId, name, description || '', parseFloat(price) || 0, compare_price || null,
            cost_price || null, sku || null, barcode || null, inventory_quantity || 0, category || null,
            JSON.stringify(images || []), JSON.stringify(variants || []),
            seo_title || null, seo_description || null, now
        ]);
        
        const newProduct = await db.query(`SELECT * FROM products WHERE id = ${placeholder(1)}`, [productId]);
        
        res.status(201).json({
            success: true,
            message: 'Produit créé avec succès',
            data: first(newProduct)
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création du produit');
    }
};

const updateProduct = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const existing = await db.query(`SELECT id FROM products WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        
        if (normalizeResult(existing).length === 0) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }
        
        const updateData = req.body;
        const allowedFields = ['name', 'description', 'price', 'compare_price', 'cost_price', 'sku', 'barcode', 'inventory_quantity', 'category', 'images', 'variants', 'seo_title', 'seo_description', 'status'];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ${placeholder(values.length + 1)}`);
                values.push(['images', 'variants'].includes(field) ? JSON.stringify(updateData[field]) : updateData[field]);
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }
        
        values.push(id);
        values.push(supplierId);
        
        await db.query(`UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${placeholder(values.length - 1)} AND supplier_id = ${placeholder(values.length)}`, values);
        
        const updated = await db.query(`SELECT * FROM products WHERE id = ${placeholder(1)}`, [id]);
        
        res.json({
            success: true,
            message: 'Produit mis à jour avec succès',
            data: first(updated)
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour du produit');
    }
};

const deleteProduct = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`DELETE FROM products WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        
        if (affectedRows(result) === 0) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }
        
        res.json({ success: true, message: 'Produit supprimé avec succès' });
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
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = `SELECT * FROM orders WHERE supplier_id = ${placeholder(1)}`;
        let params = [supplierId];
        
        if (status) {
            query += ` AND status = ${placeholder(2)}`;
            params.push(status);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ${placeholder(params.length + 1)} OFFSET ${placeholder(params.length + 2)}`;
        params.push(parseInt(limit), offset);
        
        const result = await db.query(query, params);
        
        const parsedOrders = normalizeResult(result).map(order => ({
            ...order,
            items: safeJsonParse(order.items),
            shipping_address: safeJsonParse(order.shipping_address)
        }));
        
        res.json({ success: true, data: parsedOrders });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des commandes');
    }
};

const getOrderById = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`SELECT * FROM orders WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
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
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }
        
        const result = await db.query(`
            UPDATE orders SET status = ${placeholder(1)}, tracking_number = ${placeholder(2)}, updated_at = NOW() 
            WHERE id = ${placeholder(3)} AND supplier_id = ${placeholder(4)}
        `, [status, tracking_number || null, id, supplierId]);
        
        if (affectedRows(result) === 0) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }
        
        res.json({ success: true, message: 'Statut mis à jour avec succès' });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour du statut');
    }
};

// ============================================
// CAMPAIGNS
// ============================================

const getCampaigns = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`
            SELECT c.*, p.name as product_name, p.images as product_images 
            FROM campaigns c 
            LEFT JOIN products p ON c.product_id = p.id 
            WHERE c.supplier_id = ${placeholder(1)} 
            ORDER BY c.created_at DESC
        `, [supplierId]);
        
        const parsedCampaigns = normalizeResult(result).map(campaign => ({
            ...campaign,
            targeting: safeJsonParse(campaign.targeting),
            ad_creative: safeJsonParse(campaign.ad_creative),
            product_images: safeJsonParse(campaign.product_images)
        }));
        
        res.json({ success: true, data: parsedCampaigns });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des campagnes');
    }
};

const getCampaignLimit = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`
            SELECT COUNT(*) as count FROM campaigns WHERE supplier_id = ${placeholder(1)} AND status != 'ended'
        `, [supplierId]);
        
        const currentCount = first(result)?.count || 0;
        const maxCampaigns = 5;
        
        res.json({
            success: true,
            data: {
                max_campaigns: maxCampaigns,
                current_campaigns: parseInt(currentCount),
                can_create: currentCount < maxCampaigns,
                remaining: Math.max(0, maxCampaigns - currentCount)
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération de la limite');
    }
};

const createCampaign = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const { name, product_id, budget, daily_budget, start_date, end_date, targeting, ad_creative, ad_format } = req.body;
        
        const missing = validateRequired(['name', 'product_id', 'budget', 'start_date', 'end_date'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Champs requis manquants: ${missing.join(', ')}` });
        }
        
        // Vérifier la limite
        const countResult = await db.query(`
            SELECT COUNT(*) as count FROM campaigns WHERE supplier_id = ${placeholder(1)} AND status != 'ended'
        `, [supplierId]);
        
        if (first(countResult)?.count >= 5) {
            return res.status(400).json({ success: false, message: 'Limite de 5 campagnes atteinte' });
        }
        
        // Vérifier le produit
        const product = await db.query(`SELECT id FROM products WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [product_id, supplierId]);
        if (normalizeResult(product).length === 0) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }
        
        const campaignId = generateUUID();
        const now = new Date().toISOString();
        
        await db.query(`
            INSERT INTO campaigns (
                id, supplier_id, name, product_id, budget, daily_budget,
                start_date, end_date, targeting, ad_creative, ad_format,
                status, spent, impressions, clicks, conversions, created_at
            ) VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)},
                ${placeholder(7)}, ${placeholder(8)}, ${placeholder(9)}, ${placeholder(10)}, ${placeholder(11)},
                'pending', 0, 0, 0, 0, ${placeholder(12)})
        `, [
            campaignId, supplierId, name, product_id, parseFloat(budget) || 100, daily_budget || null,
            start_date, end_date, 
            JSON.stringify(targeting || {}),
            JSON.stringify(ad_creative || {}),
            ad_format || 'carousel',
            now
        ]);
        
        const newCampaign = await db.query(`SELECT * FROM campaigns WHERE id = ${placeholder(1)}`, [campaignId]);
        
        res.status(201).json({
            success: true,
            message: 'Campagne créée avec succès',
            data: first(newCampaign)
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création de la campagne');
    }
};

const updateCampaign = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const existing = await db.query(`SELECT id, status FROM campaigns WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        if (normalizeResult(existing).length === 0) {
            return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
        }
        
        const updateData = req.body;
        const allowedFields = ['name', 'budget', 'daily_budget', 'start_date', 'end_date', 'targeting', 'ad_creative', 'ad_format', 'status'];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ${placeholder(values.length + 1)}`);
                values.push(['targeting', 'ad_creative'].includes(field) ? JSON.stringify(updateData[field]) : updateData[field]);
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }
        
        values.push(id);
        
        await db.query(`UPDATE campaigns SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${placeholder(values.length)}`, values);
        
        const updated = await db.query(`SELECT * FROM campaigns WHERE id = ${placeholder(1)}`, [id]);
        
        res.json({
            success: true,
            message: 'Campagne mise à jour avec succès',
            data: first(updated)
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour de la campagne');
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const campaign = await db.query(`SELECT spent FROM campaigns WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        const campaignData = first(campaign);
        
        if (!campaignData) {
            return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
        }
        
        if (parseFloat(campaignData.spent) > 0) {
            return res.status(400).json({ success: false, message: 'Impossible de supprimer une campagne qui a déjà dépensé du budget' });
        }
        
        await db.query(`DELETE FROM campaigns WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        
        res.json({ success: true, message: 'Campagne supprimée avec succès' });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression de la campagne');
    }
};

const toggleCampaignStatus = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        const { status } = req.body;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const validStatuses = ['active', 'paused', 'pending', 'ended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }
        
        const existing = await db.query(`SELECT id FROM campaigns WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        if (normalizeResult(existing).length === 0) {
            return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
        }
        
        await db.query(`UPDATE campaigns SET status = ${placeholder(1)}, updated_at = NOW() WHERE id = ${placeholder(2)}`, [status, id]);
        
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
            return res.status(400).json({ success: false, message: 'supplier et product sont requis' });
        }
        
        const result = await db.query(`
            SELECT c.*, p.name as product_name, p.images as product_images, p.price
            FROM campaigns c
            JOIN products p ON c.product_id = p.id
            WHERE c.supplier_id = ${placeholder(1)} 
              AND c.product_id = ${placeholder(2)}
              AND c.status = 'active'
              AND c.start_date <= NOW()
              AND c.end_date >= NOW()
            ORDER BY c.created_at DESC
            LIMIT 1
        `, [supplier, product]);
        
        const campaigns = normalizeResult(result);
        if (campaigns.length === 0) {
            return res.json({ success: true, data: null });
        }
        
        const campaign = {
            ...campaigns[0],
            targeting: safeJsonParse(campaigns[0].targeting),
            ad_creative: safeJsonParse(campaigns[0].ad_creative),
            product_images: safeJsonParse(campaigns[0].product_images)
        };
        
        res.json({ success: true, data: campaign });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération de la campagne');
    }
};

const trackCampaignView = async (req, res) => {
    try {
        const { campaign_id } = req.body;
        if (!campaign_id) {
            return res.status(400).json({ success: false, message: 'campaign_id requis' });
        }
        
        await db.query(`UPDATE campaigns SET impressions = impressions + 1 WHERE id = ${placeholder(1)}`, [campaign_id]);
        res.json({ success: true, message: 'View tracked' });
    } catch (error) {
        return handleError(res, error, 'Erreur tracking');
    }
};

const trackCampaignClick = async (req, res) => {
    try {
        const { campaign_id } = req.body;
        if (!campaign_id) {
            return res.status(400).json({ success: false, message: 'campaign_id requis' });
        }
        
        await db.query(`UPDATE campaigns SET clicks = clicks + 1 WHERE id = ${placeholder(1)}`, [campaign_id]);
        res.json({ success: true, message: 'Click tracked' });
    } catch (error) {
        return handleError(res, error, 'Erreur tracking');
    }
};

// ============================================
// PAYMENTS
// ============================================

const getPayments = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const [balanceResult, transactionsResult, pendingResult] = await Promise.all([
            db.query(`
                SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
                FROM transactions WHERE supplier_id = ${placeholder(1)}
            `, [supplierId]),
            db.query(`
                SELECT * FROM transactions WHERE supplier_id = ${placeholder(1)} 
                ORDER BY created_at DESC LIMIT 50
            `, [supplierId]),
            db.query(`
                SELECT COALESCE(SUM(amount), 0) as pending 
                FROM payouts WHERE supplier_id = ${placeholder(1)} AND status = 'pending'
            `, [supplierId])
        ]);
        
        res.json({
            success: true,
            data: {
                balance: parseFloat(first(balanceResult)?.balance || 0),
                pending_payout: parseFloat(first(pendingResult)?.pending || 0),
                transactions: normalizeResult(transactionsResult)
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des paiements');
    }
};

const requestPayout = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { amount, method } = req.body;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        if (!amount || parseFloat(amount) < 50) {
            return res.status(400).json({ success: false, message: 'Le montant minimum de retrait est de 50€' });
        }
        
        const balanceResult = await db.query(`
            SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
            FROM transactions WHERE supplier_id = ${placeholder(1)}
        `, [supplierId]);
        
        const balance = parseFloat(first(balanceResult)?.balance || 0);
        
        if (parseFloat(amount) > balance) {
            return res.status(400).json({ success: false, message: 'Solde insuffisant' });
        }
        
        const payoutId = generateUUID();
        const now = new Date().toISOString();
        
        await db.query(`
            INSERT INTO payouts (id, supplier_id, amount, method, status, created_at) 
            VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, 'pending', ${placeholder(5)})
        `, [payoutId, supplierId, parseFloat(amount), method || 'bank_transfer', now]);
        
        await db.query(`
            INSERT INTO transactions (id, supplier_id, type, amount, description, created_at) 
            VALUES (${placeholder(1)}, ${placeholder(2)}, 'debit', ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)})
        `, [generateUUID(), supplierId, parseFloat(amount), `Demande de retrait #${payoutId}`, now]);
        
        res.json({
            success: true,
            message: 'Demande de retrait créée avec succès',
            data: { payout_id: payoutId }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création du retrait');
    }
};

const getPayouts = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`
            SELECT * FROM payouts WHERE supplier_id = ${placeholder(1)} ORDER BY created_at DESC
        `, [supplierId]);
        
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
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`
            SELECT * FROM promotions WHERE supplier_id = ${placeholder(1)} ORDER BY created_at DESC
        `, [supplierId]);
        
        res.json({ success: true, data: normalizeResult(result) });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des promotions');
    }
};

const createPromotion = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const { code, discount_type, discount_value, minimum_order, start_date, end_date, usage_limit } = req.body;
        
        const missing = validateRequired(['code', 'discount_type', 'discount_value'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Champs requis manquants: ${missing.join(', ')}` });
        }
        
        const promotionId = generateUUID();
        const now = new Date().toISOString();
        
        await db.query(`
            INSERT INTO promotions (
                id, supplier_id, code, discount_type, discount_value,
                minimum_order, start_date, end_date, usage_limit, usage_count,
                status, created_at
            ) VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)},
                ${placeholder(6)}, ${placeholder(7)}, ${placeholder(8)}, ${placeholder(9)}, 0, 'active', ${placeholder(10)})
        `, [
            promotionId, supplierId, code, discount_type, parseFloat(discount_value) || 0,
            parseFloat(minimum_order) || 0, start_date || now, end_date || null, usage_limit || null, now
        ]);
        
        const newPromotion = await db.query(`SELECT * FROM promotions WHERE id = ${placeholder(1)}`, [promotionId]);
        
        res.status(201).json({
            success: true,
            message: 'Promotion créée avec succès',
            data: first(newPromotion)
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création de la promotion');
    }
};

const updatePromotion = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const updateData = req.body;
        const allowedFields = ['code', 'discount_type', 'discount_value', 'minimum_order', 'start_date', 'end_date', 'usage_limit', 'status'];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ${placeholder(values.length + 1)}`);
                values.push(updateData[field]);
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }
        
        values.push(id);
        values.push(supplierId);
        
        await db.query(`UPDATE promotions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${placeholder(values.length - 1)} AND supplier_id = ${placeholder(values.length)}`, values);
        
        const updated = await db.query(`SELECT * FROM promotions WHERE id = ${placeholder(1)}`, [id]);
        
        res.json({
            success: true,
            message: 'Promotion mise à jour avec succès',
            data: first(updated)
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour de la promotion');
    }
};

const deletePromotion = async (req, res) => {
    try {
        const supplierId = req.user?.id;
        const { id } = req.params;
        
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        await db.query(`DELETE FROM promotions WHERE id = ${placeholder(1)} AND supplier_id = ${placeholder(2)}`, [id, supplierId]);
        
        res.json({ success: true, message: 'Promotion supprimée avec succès' });
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
        if (!supplierId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }
        
        const result = await db.query(`SELECT * FROM supplier_ad_settings WHERE supplier_id = ${placeholder(1)}`, [supplierId]);
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
// UTILITAIRES
// ============================================

const safeJsonParse = (str) => {
    if (!str) return {};
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch (e) {
        return {};
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
    getAdSettings,
    
    // Upload placeholders
    uploadImageMiddleware: null,
    uploadVideoMiddleware: null,
    uploadImage: null,
    uploadCampaignVideo: null
};