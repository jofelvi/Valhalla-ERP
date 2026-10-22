# Print Service - Test de Impresion
# Ejecutar: powershell -ExecutionPolicy Bypass -File test-print.ps1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Test de impresion" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar servicio
Write-Host "Verificando servicio..." -NoNewline
try {
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:6441/status" -TimeoutSec 3
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Factura: $($status.printers.receipt)"
    Write-Host "  Cocina:  $($status.printers.kitchen)"
    Write-Host "  Barra:   $($status.printers.bar)"
} catch {
    Write-Host " ERROR" -ForegroundColor Red
    Write-Host "El servicio no esta corriendo. Ejecuta start.bat primero." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host ""

# Test comanda de cocina + barra
Write-Host "Enviando COMANDA DE PRUEBA (cocina + barra)..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
$comanda = @{
    orderNumber = "TEST001"
    date        = (Get-Date -Format "dd/MM/yyyy")
    time        = (Get-Date -Format "HH:mm")
    table       = "MESA-PRUEBA"
    orderType   = "Prueba"
    items       = @(
        @{ quantity = 2; name = "** PRUEBA COCINA **"; notes = "Si ves esto, funciona!"; station = "KITCHEN" },
        @{ quantity = 1; name = "** PRUEBA BARRA **";  notes = "Bebida de prueba";       station = "BAR" }
    )
}

try {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:6441/print-comanda" `
        -Method POST `
        -ContentType "application/json" `
        -Body ($comanda | ConvertTo-Json -Depth 5)
    Write-Host "EXITO: $($result.message)" -ForegroundColor Green
    Write-Host "  Items cocina: $($result.kitchenItems)"
    Write-Host "  Items barra:  $($result.barItems)"
} catch {
    Write-Host "ERROR al imprimir comanda: $_" -ForegroundColor Red
}
Write-Host ""

# Test factura
Write-Host "Enviando FACTURA DE PRUEBA..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
$factura = @{
    businessName    = "Prueba"
    orderNumber     = "TEST001"
    date            = (Get-Date -Format "dd/MM/yyyy")
    time            = (Get-Date -Format "HH:mm")
    items           = @(
        @{ quantity = 1; name = "PRUEBA DE FACTURA"; unitPrice = 10.00; total = 10.00 }
    )
    subtotal  = 10.00
    tax       = 0
    total     = 10.00
    payments  = @(
        @{ method = "CASH_USD"; methodLabel = "Efectivo USD"; amount = 10.00 }
    )
}

try {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:6441/print" `
        -Method POST `
        -ContentType "application/json" `
        -Body ($factura | ConvertTo-Json -Depth 5)
    Write-Host "EXITO: $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "ERROR al imprimir factura: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Si nada salio, revisa los logs en la ventana de start.bat" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona Enter para salir"
