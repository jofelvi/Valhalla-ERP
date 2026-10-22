#  Vigilante del supervisor de impresion (PC de caja). Corre como SYSTEM.
#  ---------------------------------------------------------------------------
#  Cada minuto comprueba que el servicio de impresion responda en su puerto.
#  Si no responde y el supervisor no esta corriendo, reinicia la tarea del
#  supervisor. Si el supervisor ya esta corriendo, no se toca: el supervisor
#  es quien reinicia el servicio. Idempotente.
#  Configuracion: caja.env (ver caja.env.example).
# ===========================================================================

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'caja-config.ps1')
$cfg     = Get-CajaConfig
$inst    = Get-InstanciaCaja $cfg
$dir     = Get-DirCaja $cfg
$log     = "$dir\vigilante.log"
$api     = $cfg['API_URL']
$puerto  = if ($cfg['PUERTO_SERVICIO']) { [int]$cfg['PUERTO_SERVICIO'] } else { 6441 }
$tarea   = "$inst-impresion"

function Escribir($m) {
  $l = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Write-Output $l
  try { Add-Content -Path $log -Value $l -Encoding UTF8 } catch { }
}

function Avisar($nivel, $mensaje, $contexto) {
  if (-not $api) { return }
  try {
    $body = @{
      level = $nivel; source = 'vigilante-impresion'; message = $mensaje
      context = $contexto; platform = "print-service@$env:COMPUTERNAME"
    } | ConvertTo-Json -Depth 6 -Compress
    Invoke-WebRequest "$api/api/client-logs" -Method POST -Body $body `
      -ContentType 'application/json' -UseBasicParsing -TimeoutSec 15 | Out-Null
  } catch {
    Escribir ('(no se pudo avisar al servidor: ' + $_.Exception.Message + ')')
  }
}

function Test-ServicioEscucha {
  return [bool](Get-NetTCPConnection -LocalPort $puerto -State Listen -EA SilentlyContinue)
}

function Test-SupervisorCorriendo {
  $p = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -EA SilentlyContinue |
    Where-Object { $_.CommandLine -like '*supervisor-impresion.ps1*' }
  return [bool]$p
}

while ($true) {
  try {
    if (-not (Test-ServicioEscucha) -and -not (Test-SupervisorCorriendo)) {
      Escribir "El servicio no responde en el puerto $puerto y el supervisor no corre. Reiniciando la tarea $tarea."
      Start-ScheduledTask -TaskName $tarea -ErrorAction Stop
      Avisar 'warn' 'El servicio de impresion no respondia; el vigilante reinicio el supervisor' @{ tarea = $tarea }
    }
  } catch {
    Escribir ('ERROR al reiniciar la tarea: ' + $_.Exception.Message)
    Avisar 'error' 'El servicio de impresion esta caido y el vigilante no pudo reiniciarlo' @{
      error = $_.Exception.Message; tarea = $tarea
    }
  }
  Start-Sleep -Seconds 60
}
