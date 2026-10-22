#  Tunel inverso de soporte al VPS, como SYSTEM: sube tras un corte de luz sin
#  que nadie inicie sesion. Se deja de lado si caja.env no trae VPS_HOST.
#  La llave del tunel la copia setup-resiliencia.ps1 a la carpeta de la
#  instalacion, con ACL solo-SYSTEM (ssh como SYSTEM ignora llaves "demasiado
#  abiertas").
# ===========================================================================

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'caja-config.ps1')
$cfg      = Get-CajaConfig
$dir      = Get-DirCaja $cfg
$vpsHost  = $cfg['VPS_HOST']
if (-not $vpsHost) { exit 0 }
$vpsUser  = if ($cfg['VPS_USUARIO']) { $cfg['VPS_USUARIO'] } else { 'root' }
$puerto   = if ($cfg['VPS_PUERTO_REMOTO']) { $cfg['VPS_PUERTO_REMOTO'] } else { '2222' }
$llave    = "$dir\tunel.key"

while ($true) {
  & ssh -N -R "${puerto}:localhost:22" -o StrictHostKeyChecking=accept-new `
    -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 `
    -i $llave "$vpsUser@$vpsHost"
  Start-Sleep -Seconds 15
}
