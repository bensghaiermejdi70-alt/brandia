const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'brandia',
    password: 'votre_mot_de_postgres',  // ← Remplacez par votre vrai mot de passe PostgreSQL
    port: 5432,
});

async function createUser() {
    const password = 'Test1234!';
    const hash = await bcrypt.hash(password, 10);
    
    // D'abord, voyons la structure de la table
    try {
        const tableInfo = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Structure de la table users :');
        console.table(tableInfo.rows);
    } catch (err) {
        console.log('Impossible de voir la structure :', err.message);
    }
    
    // Essai d'insertion avec les colonnes minimales
    const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET password_hash = $2
        RETURNING *;
    `;
    
    const values = ['test@brandia.com', hash, 'Test', 'User', 'client', true];
    
    try {
        const result = await pool.query(query, values);
        console.log('✅ Utilisateur créé/mis à jour :', result.rows[0].email);
        console.log('🔑 Mot de passe :', password);
    } catch (err) {
        console.error('❌ Erreur insertion :', err.message);
        
        // Si ça ne marche toujours pas, essayons sans first_name/last_name
        console.log('\n🔄 Tentative avec structure minimale...');
        
        const minimalQuery = `
            INSERT INTO users (email, password_hash, role, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO UPDATE SET password_hash = $2
            RETURNING *;
        `;
        
        try {
            const result2 = await pool.query(minimalQuery, ['test@brandia.com', hash, 'client', true]);
            console.log('✅ Utilisateur créé avec structure minimale :', result2.rows[0].email);
            console.log('🔑 Mot de passe :', password);
        } catch (err2) {
            console.error('❌ Échec total :', err2.message);
        }
    } finally {
        pool.end();
    }
}

createUser();