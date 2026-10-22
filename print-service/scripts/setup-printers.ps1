# Print Service - Configuracion automatica de impresoras POS
# Ejecutar como Administrador: powershell -ExecutionPolicy Bypass -File setup-printers.ps1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Print Service - Configuracion de Impresoras POS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Ver impresoras actuales y sus puertos ──
Write-Host "Impresoras actuales:" -ForegroundColor Yellow
Get-Printer | Select-Object Name, PortName, DriverName | Format-Table -AutoSize

# ── Ver puertos disponibles ──
Write-Host "Puertos disponibles:" -ForegroundColor Yellow
Get-PrinterPort | Where-Object { $_.Name -match "USB|COM|LPT" } | Select-Object Name, Description | Format-Table -AutoSize

# ── Obtener info de POS-58 (impresora base) ──
$pos58 = Get-Printer -Name "POS-58" -ErrorAction SilentlyContinue
if (-not $pos58) {
    Write-Host "ERROR: No se encontro la impresora POS-58" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

$driverName = $pos58.DriverName
$pos58Port  = $pos58.PortName
Write-Host "POS-58 usa driver: $driverName" -ForegroundColor Green
Write-Host "POS-58 esta en puerto: $pos58Port" -ForegroundColor Green
Write-Host ""

# ── Buscar puertos USB que NO sean el de POS-58 ──
$allUsbPorts = Get-PrinterPort | Where-Object { $_.Name -match "^USB" }
$otherPorts  = $allUsbPorts | Where-Object { $_.Name -ne $pos58Port }

Write-Host "Puertos USB disponibles (sin contar POS-58):" -ForegroundColor Yellow
if ($otherPorts.Count -eq 0) {
    Write-Host "No se encontraron otros puertos USB." -ForegroundColor Red
    Write-Host ""
    Write-Host "Intenta desconectar y volver a conectar la segunda impresora," -ForegroundColor White
    Write-Host "luego ejecuta este script de nuevo." -ForegroundColor White
    Read-Host "Presiona Enter para salir"
    exit 1
}

$otherPorts | Format-Table -AutoSize

# Si hay exactamente un puerto libre, usarlo directamente
# Si hay varios, preguntar
$targetPort = $null
if ($otherPorts.Count -eq 1) {
    $targetPort = $otherPorts[0].Name
    Write-Host "Se usara el puerto: $targetPort" -ForegroundColor Green
} else {
    Write-Host "Se encontraron varios puertos. Elige cual usar:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $otherPorts.Count; $i++) {
        Write-Host "  [$($i+1)] $($otherPorts[$i].Name)  -  $($otherPorts[$i].Description)"
    }
    do {
        $choice = Read-Host "Numero de puerto (1-$($otherPorts.Count))"
        $idx = [int]$choice - 1
    } while ($idx -lt 0 -or $idx -ge $otherPorts.Count)
    $targetPort = $otherPorts[$idx].Name
}

Write-Host ""

# ── Elegir que impresora instalar ──
Write-Host "Que rol tendra esta segunda impresora?" -ForegroundColor Yellow
Write-Host "  [1] Cocina  (platos, pizzas, hamburguesas...)"
Write-Host "  [2] Barra   (bebidas, refrescos, alcohol...)"
Write-Host "  [3] Factura (tickets de cobro al cliente)"
$roleChoice = Read-Host "Elige [1/2/3]"

switch ($roleChoice) {
    "1" { $printerName = "POS-COCINA";  $envKey = "KITCHEN_PRINTER" }
    "2" { $printerName = "POS-BARRA";   $envKey = "BAR_PRINTER" }
    "3" { $printerName = "POS-FACTURA"; $envKey = "RECEIPT_PRINTER" }
    default {
        Write-Host "Opcion invalida." -ForegroundColor Red
        Read-Host "Presiona Enter para salir"
        exit 1
    }
}

# ── Instalar la nueva impresora ──
Write-Host ""
Write-Host "Instalando '$printerName' en puerto $targetPort con driver '$driverName'..." -ForegroundColor Yellow

# Eliminar si ya existe
$existing = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Ya existe '$printerName', eliminando para reinstalar..." -ForegroundColor DarkYellow
    Remove-Printer -Name $printerName -ErrorAction SilentlyContinue
}

try {
    Add-Printer -Name $printerName -DriverName $driverName -PortName $targetPort
    Write-Host "Impresora '$printerName' instalada correctamente." -ForegroundColor Green
} catch {
    Write-Host "Error al instalar: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Intentando con driver generico..." -ForegroundColor Yellow
    try {
        Add-Printer -Name $printerName -DriverName "Generic / Text Only" -PortName $targetPort
        Write-Host "Instalada con driver generico." -ForegroundColor Green
    } catch {
        Write-Host "Error con driver generico: $_" -ForegroundColor Red
        Read-Host "Presiona Enter para salir"
        exit 1
    }
}

# ── Actualizar .env automaticamente ──
Write-Host ""
Write-Host "Actualizando .env..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot "..\.env"

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    # Reemplazar la linea del printer correspondiente
    $envContent = $envContent -replace "(?m)^$envKey=.*$", "$envKey=$printerName"
    Set-Content -Path $envPath -Value $envContent -Encoding UTF8
    Write-Host ".env actualizado: $envKey=$printerName" -ForegroundColor Green
} else {
    Write-Host "No se encontro .env, creando..." -ForegroundColor DarkYellow
    Add-Content -Path $envPath -Value "$envKey=$printerName"
}

# ── Test de impresion en la nueva impresora ──
Write-Host ""
Write-Host "Enviando ticket de prueba a '$printerName'..." -ForegroundColor Yellow
try {
    $testData = @{
        orderNumber = "SETUP"
        date        = (Get-Date -Format "dd/MM/yyyy")
        time        = (Get-Date -Format "HH:mm")
        table       = "PRUEBA"
        orderType   = "Configuracion"
        items       = @(
            @{
                quantity = 1
                name     = "** $printerName **"
                notes    = "Configuracion exitosa!"
                station  = if ($envKey -eq "KITCHEN_PRINTER") { "KITCHEN" } else { "BAR" }
            }
        )
    } | ConvertTo-Json -Depth 5

    $result = Invoke-RestMethod -Uri "http://127.0.0.1:6441/print-comanda" `
        -Method POST -ContentType "application/json" -Body $testData -TimeoutSec 5
    Write-Host "Ticket enviado: $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "No se pudo enviar ticket de prueba (el servicio esta corriendo?): $_" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  LISTO! Impresora '$printerName' configurada." -ForegroundColor Green
Write-Host "  Reinicia start.bat para aplicar los cambios del .env" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona Enter para salir"
