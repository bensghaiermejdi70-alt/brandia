# Test complet du flux checkout
$API = "https://brandia-1.onrender.com"

Write-Host "🧪 TEST FLUX CHECKOUT COMPLET" -ForegroundColor Cyan

# 1. Login client
Write-Host "`n[1/4] Connexion client..." -ForegroundColor Yellow
$login = Invoke-RestMethod "$API/api/auth/login" -Method POST -Body (@{email="test@brandia.com";password="Test1234!"} | ConvertTo-Json) -ContentType "application/json"
$token = $login.data.accessToken
Write-Host "✅ Token obtenu" -ForegroundColor Green

# 2. Créer commande (simulation)
Write-Host "`n[2/4] Création commande test..." -ForegroundColor Yellow
$orderData = @{
  items = @(
    @{product_id=1; quantity=2; price=89.90}
  )
  shipping_address = @{
    first_name = "Test"
    last_name = "Client"
    email = "test@brandia.com"
    phone = "+33612345678"
    address = "123 Test Street"
    postal_code = "75001"
    city = "Paris"
    country = "FR"
  }
} | ConvertTo-Json -Depth 5

try {
  $order = Invoke-RestMethod "$API/api/orders" -Method POST -Body $orderData -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
  Write-Host "✅ Commande créée: $($order.data.order_number)" -ForegroundColor Green
  if ($order.data.client_secret) {
    Write-Host "✅ ClientSecret Stripe reçu (paiement possible)" -ForegroundColor Green
  } else {
    Write-Host "⚠️ Pas de ClientSecret (Stripe non config ou erreur)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "❌ Erreur: $_.Exception.Message" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Si vous voyez 'Commande créée', le backend fonctionne." -ForegroundColor White
Write-Host "Pour tester le frontend, allez sur:" -ForegroundColor White
Write-Host "https://brandia-marketplace.netlify.app/checkout.html" -ForegroundColor Cyan