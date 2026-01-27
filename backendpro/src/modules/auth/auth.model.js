// ============================================
// AUTH MODEL - Requêtes DB pour l'authentification
// ============================================

const { query } = require('../../config/db');

const AuthModel = {
    // Créer un utilisateur
    createUser: async ({ email, password_hash, first_name, last_name, role = 'customer', country_code = 'FR' }) => {
        const sql = `
            INSERT INTO users (email, password_hash, first_name, last_name, role, country_code)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, first_name, last_name, role, created_at
        `;
        const result = await query(sql, [email, password_hash, first_name, last_name, role, country_code]);
        return result.rows[0];
    },

    // Trouver un utilisateur par email
    findByEmail: async (email) => {
        const sql = `SELECT * FROM users WHERE email = $1 AND is_active = true`;
        const result = await query(sql, [email]);
        return result.rows[0];
    },

    // Trouver un utilisateur par ID
    findById: async (id) => {
        const sql = `
            SELECT id, email, first_name, last_name, role, country_code, created_at 
            FROM users 
            WHERE id = $1 AND is_active = true
        `;
        const result = await query(sql, [id]);
        return result.rows[0];
    },

    // Mettre à jour le refresh token
    updateRefreshToken: async (userId, refreshToken) => {
        const sql = `UPDATE users SET refresh_token = $1 WHERE id = $2`;
        await query(sql, [refreshToken, userId]);
    }
};

module.exports = AuthModel;