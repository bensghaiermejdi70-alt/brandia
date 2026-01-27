@echo off
echo ===================================
echo    BRANDIA - Lancement complet
echo ===================================
echo.

echo [1/2] Lancement du backend sur http://localhost:4000
start "Brandia Backend" cmd /k "cd /d C:\brandia\backendpro && npm start"

timeout /t 3 /nobreak >nul

echo [2/2] Lancement du frontend sur http://localhost:3000
start "Brandia Frontend" cmd /k "cd /d C:\brandia\frontend && npx serve -p 3000"

echo.
echo ===================================
echo  Backend : http://localhost:4000
echo  Frontend: http://localhost:3000
echo ===================================
pause