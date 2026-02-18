const fs = require('fs');
const path = require('path');

console.log('=== BRANDIA STRUCTURE CHECK ===\n');

// Vérifier le répertoire courant
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

// Vérifier les chemins possibles du frontend
const pathsToCheck = [
    '../../frontend',
    '../public',
    '../../public',
    '../frontend',
    '/opt/render/project/src/frontend',
    '/opt/render/project/src/public',
    './public',
    './frontend'
];

console.log('\n--- Checking Frontend Paths ---');
pathsToCheck.forEach(p => {
    const fullPath = path.resolve(__dirname, p);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${p}`);
    console.log(`   Full: ${fullPath}`);
    
    if (exists) {
        try {
            const files = fs.readdirSync(fullPath);
            console.log(`   Contents: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
            
            // Vérifier si index.html existe
            const indexExists = fs.existsSync(path.join(fullPath, 'index.html'));
            console.log(`   index.html: ${indexExists ? '✅' : '❌'}`);
        } catch (e) {
            console.log(`   Error reading: ${e.message}`);
        }
    }
});

// Vérifier les modules
console.log('\n--- Checking Backend Modules ---');
const modulesPath = path.join(__dirname, '../src/modules');
if (fs.existsSync(modulesPath)) {
    const modules = fs.readdirSync(modulesPath);
    console.log('Modules found:', modules.join(', '));
    
    modules.forEach(mod => {
        const modPath = path.join(modulesPath, mod);
        if (fs.statSync(modPath).isDirectory()) {
            const files = fs.readdirSync(modPath);
            console.log(`  📁 ${mod}: ${files.join(', ')}`);
        }
    });
} else {
    console.log('❌ Modules directory not found at:', modulesPath);
}

console.log('\n=== END CHECK ===');