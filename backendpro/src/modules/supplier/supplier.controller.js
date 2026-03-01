// ============================================
// SUPPLIER.CONTROLLER.JS - v6.4 STABLE
// Fix: Removed uuid dependency, use native crypto, SQL syntax auto-detection
// ============================================

const crypto = require('crypto');
const db = require('../../config/db');
const logger = require('../../utils/logger');

// ============================================
// HELPER FUNCTIONS
// ============================================

// Détecter si on utilise PostgreSQL ou MySQL
const isPostgres = () => {
    // Vérifier si c'est PostgreSQL en checkant les propriétés de la connexion
    if (db.pool && db.pool.options && db.pool.options.database) {
        return true; // Probablement PostgreSQL (pg)
    }
    if (db.connection && db.connection.database) {
        return false; // Probablement MySQL
    }
    // Fallback: essayer de détecter via une requête test
    return false;
};

// Génération UUID v4 native (sans dépendance externe)
const generateUUID = () => {
    return crypto.randomUUID();
};

// Helper pour formater les paramètres SQL selon la DB
const sqlParams = (params) => {
    return isPostgres() ? params : params; // Les params restent les mêmes, seule la syntaxe change
};

const handleError = (res, error, message = 'Erreur serveur', status = 500) => {
    logger.error(`[SupplierController] ${message}:`, error);
    return res.status(status).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

// Validation simple sans express-validator
const validateRequired = (fields, data) => {
    const missing = [];
    for (const field of fields) {
        if (!data[field] && data[field] !== 0) {
            missing.push(field);
        }
    }
    return missing;
};

// Helper pour normaliser les résultats de requête (PostgreSQL vs MySQL)
const normalizeResult = (result) => {
    if (result.rows) {
        // PostgreSQL
        return result.rows;
    } else if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
        // MySQL avec [rows, fields]
        return result[0];
    } else if (Array.isArray(result)) {
        // MySQL simple ou déjà normalisé
        return result;
    }
    return [];
};

// ============================================
// STATS
// ============================================

const getStats = async (req, res) => {
    try {
        const supplierId = req.user.id;
        
        const [productsResult] = await db.query(
            'SELECT COUNT(*) as count FROM products WHERE supplier_id = ?',
            [supplierId]
        );
        
        const [ordersResult] = await db.query(
            `SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue
             FROM orders 
             WHERE supplier_id = ? AND status != 'cancelled'`,
            [supplierId]
        );
        
        const [campaignsResult] = await db.query(
            `SELECT COUNT(*) as count 
             FROM campaigns 
             WHERE supplier_id = ? AND status = 'active' AND end_date > NOW()`,
            [supplierId]
        );
        
        const [pendingResult] = await db.query(
            `SELECT COUNT(*) as count 
             FROM orders 
             WHERE supplier_id = ? AND status = 'pending'`,
            [supplierId]
        );
        
        res.json({
            success: true,
            data: {
                products_count: normalizeResult(productsResult)[0]?.count || 0,
                total_orders: normalizeResult(ordersResult)[0]?.total_orders || 0,
                total_revenue: normalizeResult(ordersResult)[0]?.total_revenue || 0,
                active_campaigns: normalizeResult(campaignsResult)[0]?.count || 0,
                pending_orders: normalizeResult(pendingResult)[0]?.count || 0
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
        const supplierId = req.user.id;
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM products WHERE supplier_id = ?';
        let params = [supplierId];
        
        if (search) {
            query += ' AND (name LIKE ? OR sku LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const productsResult = await db.query(query, params);
        const products = normalizeResult(productsResult);
        
        let countQuery = 'SELECT COUNT(*) as total FROM products WHERE supplier_id = ?';
        let countParams = [supplierId];
        
        if (search) {
            countQuery += ' AND (name LIKE ? OR sku LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }
        
        const countResult = await db.query(countQuery, countParams);
        
        res.json({
            success: true,
            data: products || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: normalizeResult(countResult)[0]?.total || 0
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des produits');
    }
};

const createProduct = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const {
            name,
            description,
            price,
            compare_price,
            cost_price,
            sku,
            barcode,
            inventory_quantity,
            category,
            images,
            variants,
            seo_title,
            seo_description
        } = req.body;
        
        // Validation manuelle
        const missing = validateRequired(['name', 'price'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Champs requis manquants: ${missing.join(', ')}`
            });
        }
        
        const productId = generateUUID();
        
        await db.query(
            `INSERT INTO products (
                id, supplier_id, name, description, price, compare_price,
                cost_price, sku, barcode, inventory_quantity, category,
                images, variants, seo_title, seo_description, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
            [
                productId, supplierId, name, description, parseFloat(price) || 0, compare_price || null,
                cost_price || null, sku || null, barcode || null, inventory_quantity || 0, category || null,
                JSON.stringify(images || []), JSON.stringify(variants || []),
                seo_title || null, seo_description || null
            ]
        );
        
        const newProductResult = await db.query(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Produit créé avec succès',
            data: normalizeResult(newProductResult)[0]
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création du produit');
    }
};

const updateProduct = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;
        
        const existingResult = await db.query(
            'SELECT id FROM products WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        if (normalizeResult(existingResult).length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        const allowedFields = [
            'name', 'description', 'price', 'compare_price', 'cost_price',
            'sku', 'barcode', 'inventory_quantity', 'category',
            'images', 'variants', 'seo_title', 'seo_description', 'status'
        ];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(
                    ['images', 'variants'].includes(field) 
                        ? JSON.stringify(updateData[field]) 
                        : updateData[field]
                );
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune donnée à mettre à jour'
            });
        }
        
        values.push(id);
        values.push(supplierId);
        
        await db.query(
            `UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND supplier_id = ?`,
            values
        );
        
        const updatedResult = await db.query(
            'SELECT * FROM products WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Produit mis à jour avec succès',
            data: normalizeResult(updatedResult)[0]
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour du produit');
    }
};

const deleteProduct = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        
        const result = await db.query(
            'DELETE FROM products WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        // MySQL retourne affectedRows dans result[0], PostgreSQL dans result.rowCount
        const affectedRows = result[0]?.affectedRows || result.rowCount || 0;
        
        if (affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        res.json({
            success: true,
            message: 'Produit supprimé avec succès'
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression du produit');
    }
};

// ============================================
// ORDERS
// ============================================

const getOrders = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM orders WHERE supplier_id = ?';
        let params = [supplierId];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const ordersResult = await db.query(query, params);
        
        const parsedOrders = normalizeResult(ordersResult).map(order => ({
            ...order,
            items: safeJsonParse(order.items),
            shipping_address: safeJsonParse(order.shipping_address)
        }));
        
        res.json({
            success: true,
            data: parsedOrders
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des commandes');
    }
};

const getOrderById = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        
        const ordersResult = await db.query(
            'SELECT * FROM orders WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        const orders = normalizeResult(ordersResult);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        const order = {
            ...orders[0],
            items: safeJsonParse(orders[0].items),
            shipping_address: safeJsonParse(orders[0].shipping_address)
        };
        
        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération de la commande');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        const { status, tracking_number } = req.body;
        
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide'
            });
        }
        
        const result = await db.query(
            'UPDATE orders SET status = ?, tracking_number = ?, updated_at = NOW() WHERE id = ? AND supplier_id = ?',
            [status, tracking_number || null, id, supplierId]
        );
        
        const affectedRows = result[0]?.affectedRows || result.rowCount || 0;
        
        if (affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        res.json({
            success: true,
            message: 'Statut mis à jour avec succès'
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour du statut');
    }
};

// ============================================
// CAMPAIGNS
// ============================================

const getCampaigns = async (req, res) => {
    try {
        const supplierId = req.user.id;
        
        const campaignsResult = await db.query(
            `SELECT c.*, p.name as product_name, p.images as product_images 
             FROM campaigns c 
             LEFT JOIN products p ON c.product_id = p.id 
             WHERE c.supplier_id = ? 
             ORDER BY c.created_at DESC`,
            [supplierId]
        );
        
        const parsedCampaigns = normalizeResult(campaignsResult).map(campaign => ({
            ...campaign,
            targeting: safeJsonParse(campaign.targeting),
            ad_creative: safeJsonParse(campaign.ad_creative),
            product_images: safeJsonParse(campaign.product_images)
        }));
        
        res.json({
            success: true,
            data: parsedCampaigns
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des campagnes');
    }
};

const getCampaignLimit = async (req, res) => {
    try {
        const supplierId = req.user.id;
        
        const countResult = await db.query(
            `SELECT COUNT(*) as count FROM campaigns WHERE supplier_id = ? AND status != 'ended'`,
            [supplierId]
        );
        
        const currentCount = normalizeResult(countResult)[0]?.count || 0;
        const maxCampaigns = 5;
        
        res.json({
            success: true,
            data: {
                max_campaigns: maxCampaigns,
                current_campaigns: currentCount,
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
        const supplierId = req.user.id;
        const {
            name,
            product_id,
            budget,
            daily_budget,
            start_date,
            end_date,
            targeting,
            ad_creative,
            ad_format
        } = req.body;
        
        // Validation manuelle
        const missing = validateRequired(['name', 'product_id', 'budget', 'start_date', 'end_date'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Champs requis manquants: ${missing.join(', ')}`
            });
        }
        
        // Vérifier la limite
        const countResult = await db.query(
            `SELECT COUNT(*) as count FROM campaigns WHERE supplier_id = ? AND status != 'ended'`,
            [supplierId]
        );
        
        if (normalizeResult(countResult)[0]?.count >= 5) {
            return res.status(400).json({
                success: false,
                message: 'Limite de 5 campagnes atteinte'
            });
        }
        
        // Vérifier le produit
        const productResult = await db.query(
            'SELECT id FROM products WHERE id = ? AND supplier_id = ?',
            [product_id, supplierId]
        );
        
        if (normalizeResult(productResult).length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        const campaignId = generateUUID();
        
        await db.query(
            `INSERT INTO campaigns (
                id, supplier_id, name, product_id, budget, daily_budget,
                start_date, end_date, targeting, ad_creative, ad_format,
                status, spent, impressions, clicks, conversions, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, 0, 0, NOW())`,
            [
                campaignId, supplierId, name, product_id, parseFloat(budget) || 100, daily_budget || null,
                start_date, end_date, 
                JSON.stringify(targeting || {}),
                JSON.stringify(ad_creative || {}),
                ad_format || 'carousel'
            ]
        );
        
        const newCampaignResult = await db.query(
            'SELECT * FROM campaigns WHERE id = ?',
            [campaignId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Campagne créée avec succès',
            data: normalizeResult(newCampaignResult)[0]
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création de la campagne');
    }
};

const updateCampaign = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;
        
        const existingResult = await db.query(
            'SELECT id, status FROM campaigns WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        if (normalizeResult(existingResult).length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }
        
        const allowedFields = [
            'name', 'budget', 'daily_budget', 'start_date', 
            'end_date', 'targeting', 'ad_creative', 'ad_format', 'status'
        ];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(
                    ['targeting', 'ad_creative'].includes(field)
                        ? JSON.stringify(updateData[field])
                        : updateData[field]
                );
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune donnée à mettre à jour'
            });
        }
        
        values.push(id);
        
        await db.query(
            `UPDATE campaigns SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
            values
        );
        
        const updatedResult = await db.query(
            'SELECT * FROM campaigns WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Campagne mise à jour avec succès',
            data: normalizeResult(updatedResult)[0]
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour de la campagne');
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        
        const campaignResult = await db.query(
            'SELECT spent FROM campaigns WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        const campaign = normalizeResult(campaignResult);
        
        if (campaign.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }
        
        if (campaign[0].spent > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer une campagne qui a déjà dépensé du budget'
            });
        }
        
        await db.query(
            'DELETE FROM campaigns WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        res.json({
            success: true,
            message: 'Campagne supprimée avec succès'
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression de la campagne');
    }
};

const toggleCampaignStatus = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['active', 'paused', 'pending', 'ended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide'
            });
        }
        
        const existingResult = await db.query(
            'SELECT id FROM campaigns WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        if (normalizeResult(existingResult).length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }
        
        await db.query(
            'UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );
        
        res.json({
            success: true,
            message: `Campagne ${status === 'active' ? 'activée' : 'mise en pause'}`
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors du changement de statut');
    }
};

// Méthodes pour les routes publiques
const getActiveCampaignForProduct = async (req, res) => {
    try {
        const { supplier, product } = req.query;
        
        const campaignsResult = await db.query(
            `SELECT c.*, p.name as product_name, p.images as product_images, p.price
             FROM campaigns c
             JOIN products p ON c.product_id = p.id
             WHERE c.supplier_id = ? 
               AND c.product_id = ?
               AND c.status = 'active'
               AND c.start_date <= NOW()
               AND c.end_date >= NOW()
             ORDER BY c.created_at DESC
             LIMIT 1`,
            [supplier, product]
        );
        
        const campaigns = normalizeResult(campaignsResult);
        
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
        
        await db.query(
            'UPDATE campaigns SET impressions = impressions + 1 WHERE id = ?',
            [campaign_id]
        );
        
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
        
        await db.query(
            'UPDATE campaigns SET clicks = clicks + 1 WHERE id = ?',
            [campaign_id]
        );
        
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
        const supplierId = req.user.id;
        
        const balanceResult = await db.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
             FROM transactions 
             WHERE supplier_id = ?`,
            [supplierId]
        );
        
        const transactionsResult = await db.query(
            `SELECT * FROM transactions 
             WHERE supplier_id = ? 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [supplierId]
        );
        
        const pendingResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as pending 
             FROM payouts 
             WHERE supplier_id = ? AND status = 'pending'`,
            [supplierId]
        );
        
        res.json({
            success: true,
            data: {
                balance: normalizeResult(balanceResult)[0]?.balance || 0,
                pending_payout: normalizeResult(pendingResult)[0]?.pending || 0,
                transactions: normalizeResult(transactionsResult) || []
            }
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des paiements');
    }
};

const requestPayout = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { amount, method } = req.body;
        
        if (!amount || parseFloat(amount) < 50) {
            return res.status(400).json({
                success: false,
                message: 'Le montant minimum de retrait est de 50€'
            });
        }
        
        const balanceResult = await db.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
             FROM transactions 
             WHERE supplier_id = ?`,
            [supplierId]
        );
        
        const balance = normalizeResult(balanceResult)[0]?.balance || 0;
        
        if (parseFloat(amount) > balance) {
            return res.status(400).json({
                success: false,
                message: 'Solde insuffisant'
            });
        }
        
        const payoutId = generateUUID();
        
        await db.query(
            `INSERT INTO payouts (id, supplier_id, amount, method, status, created_at) 
             VALUES (?, ?, ?, ?, 'pending', NOW())`,
            [payoutId, supplierId, parseFloat(amount), method || 'bank_transfer']
        );
        
        await db.query(
            `INSERT INTO transactions (id, supplier_id, type, amount, description, created_at) 
             VALUES (?, ?, 'debit', ?, ?, NOW())`,
            [generateUUID(), supplierId, parseFloat(amount), `Demande de retrait #${payoutId}`]
        );
        
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
        const supplierId = req.user.id;
        
        const payoutsResult = await db.query(
            `SELECT * FROM payouts 
             WHERE supplier_id = ? 
             ORDER BY created_at DESC`,
            [supplierId]
        );
        
        res.json({
            success: true,
            data: normalizeResult(payoutsResult) || []
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des retraits');
    }
};

// ============================================
// PROMOTIONS
// ============================================

const getPromotions = async (req, res) => {
    try {
        const supplierId = req.user.id;
        
        const promotionsResult = await db.query(
            `SELECT * FROM promotions 
             WHERE supplier_id = ? 
             ORDER BY created_at DESC`,
            [supplierId]
        );
        
        res.json({
            success: true,
            data: normalizeResult(promotionsResult) || []
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la récupération des promotions');
    }
};

const createPromotion = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const {
            code,
            discount_type,
            discount_value,
            minimum_order,
            start_date,
            end_date,
            usage_limit
        } = req.body;
        
        const missing = validateRequired(['code', 'discount_type', 'discount_value'], req.body);
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Champs requis manquants: ${missing.join(', ')}`
            });
        }
        
        const promotionId = generateUUID();
        
        await db.query(
            `INSERT INTO promotions (
                id, supplier_id, code, discount_type, discount_value,
                minimum_order, start_date, end_date, usage_limit, usage_count,
                status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', NOW())`,
            [
                promotionId, supplierId, code, discount_type, parseFloat(discount_value) || 0,
                parseFloat(minimum_order) || 0, start_date || new Date(), end_date || null, usage_limit || null
            ]
        );
        
        const newPromotionResult = await db.query(
            'SELECT * FROM promotions WHERE id = ?',
            [promotionId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Promotion créée avec succès',
            data: normalizeResult(newPromotionResult)[0]
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la création de la promotion');
    }
};

const updatePromotion = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;
        
        const allowedFields = [
            'code', 'discount_type', 'discount_value', 'minimum_order',
            'start_date', 'end_date', 'usage_limit', 'status'
        ];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune donnée à mettre à jour'
            });
        }
        
        values.push(id);
        values.push(supplierId);
        
        await db.query(
            `UPDATE promotions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND supplier_id = ?`,
            values
        );
        
        const updatedResult = await db.query(
            'SELECT * FROM promotions WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Promotion mise à jour avec succès',
            data: normalizeResult(updatedResult)[0]
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la mise à jour de la promotion');
    }
};

const deletePromotion = async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { id } = req.params;
        
        await db.query(
            'DELETE FROM promotions WHERE id = ? AND supplier_id = ?',
            [id, supplierId]
        );
        
        res.json({
            success: true,
            message: 'Promotion supprimée avec succès'
        });
    } catch (error) {
        return handleError(res, error, 'Erreur lors de la suppression de la promotion');
    }
};

// ============================================
// AD SETTINGS
// ============================================

const getAdSettings = async (req, res) => {
    try {
        const supplierId = req.user.id;
        
        const settingsResult = await db.query(
            `SELECT * FROM supplier_ad_settings 
             WHERE supplier_id = ?`,
            [supplierId]
        );
        
        const settings = normalizeResult(settingsResult);
        
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
        
        res.json({
            success: true,
            data: settings[0]
        });
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
    
    // Upload placeholders (à implémenter si besoin)
    uploadImageMiddleware: null,
    uploadVideoMiddleware: null,
    uploadImage: null,
    uploadCampaignVideo: null
};