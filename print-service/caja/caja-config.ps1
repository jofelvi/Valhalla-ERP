# ===========================================================================
#  Configuracion de la PC de caja. Se carga con:  . "$PSScriptRoot\caja-config.ps1"
#  Lee caja.env (junto a estos scripts). Ver caja.env.example.
#  No hay valores de un negocio aqui: lo que falte en caja.env queda vacio o
#  toma el valor generico indicado en cada script.
# ===========================================================================

function Get-CajaConfig {
  $cfg = @{}
  $archivo = Join-Path $PSScriptRoot 'caja.env'
  if (Test-Path $archivo) {
    Get-Content $archivo | ForEach-Object {
      if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $cfg[$matches[1]] = $matches[2] }
    }
  }
  return $cfg
}

# Nombre de la instalacion (prefija las tareas programadas) y carpeta de los
# archivos de caja. Si caja.env no los trae, toman valores genericos.
function Get-InstanciaCaja($cfg) {
  if ($cfg['INSTANCIA']) { return $cfg['INSTANCIA'] }
  return 'impresion'
}

function Get-DirCaja($cfg) {
  if ($cfg['DIR_INSTALACION']) { return $cfg['DIR_INSTALACION'] }
  return "$env:ProgramData\$(Get-InstanciaCaja $cfg)"
}

# Mapa de conectores fisicos a nombres de impresora. Formato en caja.env:
#   MAPA_PUERTOS=<conector>=<nombre>;<conector>=<nombre>
function Get-MapaPuertos($cfg) {
  $mapa = @{}
  if ($cfg['MAPA_PUERTOS']) {
    foreach ($par in ($cfg['MAPA_PUERTOS'] -split ';')) {
      $kv = $par -split '=', 2
      if ($kv.Count -eq 2 -and $kv[0].Trim()) { $mapa[$kv[0].Trim()] = $kv[1].Trim() }
    }
  }
  return $mapa
}
