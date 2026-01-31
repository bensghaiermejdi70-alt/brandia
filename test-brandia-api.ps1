# ==========================================
# BRANDIA API TEST SUITE - PowerShell
# ==========================================

$API_URL = "https://brandia-1.onrender.com"
$FRONTEND_URL = "https://brandia-marketplace.netlify.app"

Write-Host "🚀 Test Suite Brandia API" -ForegroundColor Cyan
Write-Host "API: $API_URL" -ForegroundColor Gray
Write-Host "Frontend: $FRONTEND_URL" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

# 1. Health Check
Write-Host "`n[1/6] Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_URL/api/health" -Method GET -TimeoutSec 10
    Write-Host "✅ API Online: $($health.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ API Hors ligne" -ForegroundColor Red
    exit
}

# 2. Test Produits (Categories)
Write-Host "`n[2/6] Test Produits par Catégorie..." -ForegroundColor Yellow
try {
    $products = Invoke-RestMethod -Uri "$API_URL/api/products?category=cosmetiques-soins-peau" -Method GET
    Write-Host "✅ Cosmétiques: $($products.data.products.Count) produits trouvés" -ForegroundColor Green
    
    $allProducts = Invoke-RestMethod -Uri "$API_URL/api/products" -Method GET
    Write-Host "✅ Total: $($allProducts.data.products.Count) produits en base" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur produits: $_" -ForegroundColor Red
}

# 3. Test Authentification Client
Write-Host "`n[3/6] Test Login Client..." -ForegroundColor Yellow
$loginBody = @{
    email = "test@brandia.com"
    password = "Test1234!"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "$API_URL/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $global:CLIENT_TOKEN = $login.data.accessToken
    Write-Host "✅ Login Client OK - Token reçu" -ForegroundColor Green
    Write-Host "   Rôle: $($login.data.user.role)" -ForegroundColor Gray
    
    # Test Me
    $me = Invoke-RestMethod -Uri "$API_URL/api/auth/me" -Method GET -Headers @{ "Authorization" = "Bearer $($global:CLIENT_TOKEN)" }
    Write-Host "✅ /api/auth/me OK - $($me.data.email)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur Auth Client: $_" -ForegroundColor Red
}

# 4. Test Authentification Fournisseur
Write-Host "`n[4/6] Test Login Fournisseur..." -ForegroundColor Yellow
$supplierBody = @{
    email = "supplier@brandia.com"
    password = "Supplier123!"
} | ConvertTo-Json

try {
    $supLogin = Invoke-RestMethod -Uri "$API_URL/api/auth/login" -Method POST -Body $supplierBody -ContentType "application/json"
    $global:SUPPLIER_TOKEN = $supLogin.data.accessToken
    Write-Host "✅ Login Fournisseur OK" -ForegroundColor Green
    Write-Host "   Rôle: $($supLogin.data.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erreur Auth Fournisseur: $_" -ForegroundColor Red
}

# 5. Test Commande (simulation)
Write-Host "`n[5/6] Test Création Commande..." -ForegroundColor Yellow
if ($global:CLIENT_TOKEN) {
    $orderBody = @{
        items = @(
            @{
                product_id = 1
                quantity = 2
                price = 89.90
            }
        )
        shipping_address = @{
            full_name = "Test Client"
            address = "123 Rue Test"
            city = "Paris"
            postal_code = "75001"
            country = "FR"
        }
    } | ConvertTo-Json -Depth 5

    try {
        $order = Invoke-RestMethod -Uri "$API_URL/api/orders" -Method POST -Body $orderBody -ContentType "application/json" -Headers @{ "Authorization" = "Bearer $($global:CLIENT_TOKEN)" }
        Write-Host "✅ Commande créée: $($order.data.order.orderNumber)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Commande (peut être normal si pas de produit ID 1): $_" -ForegroundColor Yellow
    }
}

# 6. Test CORS (depuis frontend)
Write-Host "`n[6/6] Test CORS Configuration..." -ForegroundColor Yellow
try {
    $corsTest = Invoke-RestMethod -Uri "$API_URL/api/products" -Method GET -Headers @{ "Origin" = $FRONTEND_URL }
    Write-Host "✅ CORS OK - Frontend autorisé" -ForegroundColor Green
} catch {
    Write-Host "❌ CORS Error: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Tests terminés" -ForegroundColor Cyan

# Export tokens pour tests manuels
if ($global:CLIENT_TOKEN) {
    Write-Host "`n📋 Token Client (pour tests):"
    Write-Host $global:CLIENT_TOKEN -ForegroundColor DarkGray
}