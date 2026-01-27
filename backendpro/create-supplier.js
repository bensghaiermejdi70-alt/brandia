// Créez un fichier create-supplier.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'brandia',
    password: 'votre_mot_de_postgres',  // ← Votre mot de passe
    port: 5432,
});

async function createSupplier() {
    const password = 'Supplier123!';
    const hash = await bcrypt.hash(password, 10);
    
    const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $5
        RETURNING *;
    `;
    
    const values = ['supplier@brandia.com', hash, 'Marque', 'Test', 'supplier', true, true];
    
    try {
        const result = await pool.query(query, values);
        console.log('✅ Fournisseur créé :', result.rows[0].email);
        console.log('🔑 Mot de passe :', password);
    } catch (err) {
        console.error('❌ Erreur :', err.message);
    } finally {
        pool.end();
    }
}

createSupplier();