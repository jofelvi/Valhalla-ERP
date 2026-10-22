# Print Service - Diagnostico
# Ejecutar: powershell -ExecutionPolicy Bypass -File diagnose.ps1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Print Service - Diagnostico" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Impresoras instaladas
Write-Host "[1/3] Impresoras instaladas en Windows:" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
try {
    $printers = Get-Printer | Select-Object Name, PrinterStatus, PortName
    $printers | Format-Table -AutoSize
} catch {
    Write-Host "Error al obtener impresoras: $_" -ForegroundColor Red
}

# 2. Estado del servicio
Write-Host "[2/3] Verificando servicio en puerto 6441..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:6441/status" -TimeoutSec 3
    Write-Host "SERVICIO ACTIVO" -ForegroundColor Green
    Write-Host "  Factura: $($response.printers.receipt)"
    Write-Host "  Cocina:  $($response.printers.kitchen)"
    Write-Host "  Barra:   $($response.printers.bar)"
} catch {
    Write-Host "SERVICIO NO DISPONIBLE - Ejecuta start.bat primero" -ForegroundColor Red
}
Write-Host ""

# 3. Configuracion .env
Write-Host "[3/3] Configuracion actual (.env):" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
$envPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envPath) {
    Get-Content $envPath
} else {
    Write-Host "Archivo .env no encontrado en: $envPath" -ForegroundColor Red
}
Write-Host ""

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Copia el nombre EXACTO de la impresora del paso [1]" -ForegroundColor White
Write-Host "  y pega en print-service\.env:" -ForegroundColor White
Write-Host "    RECEIPT_PRINTER=NombreExacto" -ForegroundColor Green
Write-Host "    KITCHEN_PRINTER=NombreExacto" -ForegroundColor Green
Write-Host "    BAR_PRINTER=NombreExacto" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona Enter para salir"
