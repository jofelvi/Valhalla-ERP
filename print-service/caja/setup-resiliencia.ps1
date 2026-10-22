# ===========================================================================
#  Blindaje de la PC de caja contra cortes de luz (IDEMPOTENTE)
#  ---------------------------------------------------------------------------
#  Deja la caja funcionando tras un corte de luz SIN que nadie inicie sesion.
#  Se puede correr las veces que haga falta. Como Administrador:
#     powershell -ExecutionPolicy Bypass -File setup-resiliencia.ps1
#
#  Que garantiza:
#   1. La PC nunca duerme ni hiberna (un POS dormido = local sin imprimir).
#   2. El USB no se suspende (evita el puerto "presente pero dormido").
#   3. Las tareas corren como SYSTEM y arrancan SOLAS al boot, con el prefijo
#      de INSTANCIA de caja.env:
#        <instancia>-impresion   -> supervisor de impresion
#        <instancia>-vigilante   -> reinicia el supervisor si se cae
#        <instancia>-tunel       -> tunel de soporte al VPS (si VPS_HOST esta)
#   4. La llave del tunel se copia desde TUNEL_CLAVE_ORIGEN a la carpeta de la
#      instalacion, con ACL solo-SYSTEM.
# ===========================================================================

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'caja-config.ps1')
$cfg  = Get-CajaConfig
$inst = Get-InstanciaCaja $cfg
$dir  = Get-DirCaja $cfg
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

Write-Host '== 1. Energia: nunca dormir ni hibernar ==' -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0   | Out-Null
powercfg /change standby-timeout-dc 0   | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-dc 0 | Out-Null
powercfg /change disk-timeout-ac 0      | Out-Null
powercfg /hibernate off                 | Out-Null
# Suspension selectiva de USB = 0 (AC + DC)
$gUSB = '2a737441-1930-4402-8d77-b2bebba308a3'; $sUSB = '48e6b7a6-50f5-4782-a5d4-53bb8f07e226'
powercfg /SETACVALUEINDEX SCHEME_CURRENT $gUSB $sUSB 0 | Out-Null
powercfg /SETDCVALUEINDEX SCHEME_CURRENT $gUSB $sUSB 0 | Out-Null
powercfg /SETACTIVE SCHEME_CURRENT | Out-Null
Write-Host '   OK'

Write-Host '== 2. Llave del tunel con ACL solo-SYSTEM ==' -ForegroundColor Cyan
$llaveOrigen = $cfg['TUNEL_CLAVE_ORIGEN']
$llaveDestino = "$dir\tunel.key"
if ($llaveOrigen -and (Test-Path $llaveOrigen)) {
  Copy-Item $llaveOrigen $llaveDestino -Force
  icacls $llaveDestino /inheritance:r | Out-Null
  icacls $llaveDestino /grant:r "NT AUTHORITY\SYSTEM:R" | Out-Null
  Write-Host "   OK ($llaveDestino)"
} else {
  Write-Host '   (sin TUNEL_CLAVE_ORIGEN en caja.env o archivo inexistente: se omite)' -ForegroundColor Yellow
}

Write-Host '== 3. Tareas SYSTEM + arranque al boot ==' -ForegroundColor Cyan
$pr = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$trgBoot = New-ScheduledTaskTrigger -AtStartup
$trgBoot.Delay = 'PT30S'   # espera a que el USB enumere tras el arranque
function New-SetTarea {
  $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -MultipleInstances IgnoreNew
  $s.DisallowStartIfOnBatteries = $false; $s.StopIfGoingOnBatteries = $false
  return $s
}
function Register-Tarea($nombre, $script) {
  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
  Register-ScheduledTask -TaskName $nombre -Action $accion -Principal $pr `
    -Trigger $trgBoot -Settings (New-SetTarea) -Force | Out-Null
  Write-Host ("   {0,-24} OK" -f $nombre)
}

$tareas = @("$inst-impresion", "$inst-vigilante")
Register-Tarea "$inst-impresion" (Join-Path $PSScriptRoot 'supervisor-impresion.ps1')
Register-Tarea "$inst-vigilante" (Join-Path $PSScriptRoot 'vigilante.ps1')
if ($cfg['VPS_HOST']) {
  Register-Tarea "$inst-tunel" (Join-Path $PSScriptRoot 'vpstunnel-system.ps1')
  $tareas += "$inst-tunel"
}

foreach ($t in $tareas) { Start-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue }

Write-Host ''
Write-Host '== RESUMEN ==' -ForegroundColor Green
foreach ($t in $tareas) {
  $tarea = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
  if ($tarea) { Write-Host ("  {0,-24} usuario={1} estado={2}" -f $t, $tarea.Principal.UserId, $tarea.State) }
}
Write-Host ''
Write-Host 'Listo. Tras un corte de luz la caja levanta sola, sin que nadie inicie sesion.'
