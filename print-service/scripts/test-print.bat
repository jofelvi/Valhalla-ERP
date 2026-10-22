@echo off
echo.
echo ============================================================
echo   Print Service - Test de Impresion
echo ============================================================
echo.
echo Verificando servicio...
curl -s --max-time 3 http://127.0.0.1:6441/status > nul
if %errorlevel% neq 0 (
    echo ERROR: El servicio no esta corriendo. Ejecuta start.bat primero.
    pause
    exit /b 1
)
echo Servicio activo.
echo.
echo Enviando COMANDA DE PRUEBA...
echo ------------------------------------------------------------
curl -s -X POST http://127.0.0.1:6441/print-comanda -H "Content-Type: application/json" -d "{\"orderNumber\":\"TEST001\",\"date\":\"23/02/2026\",\"time\":\"12:00\",\"table\":\"PRUEBA\",\"orderType\":\"Prueba\",\"items\":[{\"quantity\":2,\"name\":\"Prueba Cocina\",\"notes\":\"Funciona!\",\"station\":\"KITCHEN\"},{\"quantity\":1,\"name\":\"Prueba Barra\",\"station\":\"BAR\"}]}"
echo.
echo.
echo Enviando FACTURA DE PRUEBA...
echo ------------------------------------------------------------
curl -s -X POST http://127.0.0.1:6441/print -H "Content-Type: application/json" -d "{\"businessName\":\"Prueba\",\"orderNumber\":\"TEST001\",\"date\":\"23/02/2026\",\"time\":\"12:00\",\"items\":[{\"quantity\":1,\"name\":\"PRUEBA DE IMPRESION\",\"unitPrice\":10.00,\"total\":10.00}],\"subtotal\":10.00,\"tax\":0,\"total\":10.00,\"payments\":[{\"method\":\"CASH_USD\",\"methodLabel\":\"Efectivo USD\",\"amount\":10.00}]}"
echo.
echo.
echo ============================================================
echo Si nada salio, revisa los logs en la ventana de start.bat
echo ============================================================
echo.
pause
