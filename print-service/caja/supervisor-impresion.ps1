# ===========================================================================
#  Supervisor de impresion de la PC de caja: UN SOLO script
#  ---------------------------------------------------------------------------
#  Los cortes de luz y los reinicios reparten de nuevo los puertos USB de las
#  impresoras de igual modelo, que no traen numero de serie: lo unico estable
#  es su CONECTOR FISICO. Por eso el mapeo conector -> nombre va en caja.env.
#
#  Es UN bucle unico que hace todo en orden y no se pisa a si mismo. Tres piezas
#  separadas (arranque, corrector y vigilante) se peleaban entre si y se
#  apilaban arranques en paralelo; por eso el candado de abajo impide una
#  segunda instancia.
#
#     [cada 30s]  puertos correctos?  ->  servicio vivo?  ->  si no, levantar
#  Configuracion: caja.env (ver caja.env.example) y caja-config.ps1.
#
#  Corre como SYSTEM (maximo privilegio, sin UAC, sin necesidad de que nadie
#  inicie sesion). Un candado de archivo impide una segunda instancia.
# ===========================================================================

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'caja-config.ps1')
# Configuracion de ESTA instalacion (caja.env junto a estos scripts).
$cfg       = Get-CajaConfig
$inst      = if ($cfg['INSTANCIA']) { $cfg['INSTANCIA'] } else { 'impresion' }
$dir       = if ($cfg['DIR_INSTALACION']) { $cfg['DIR_INSTALACION'] } else { "$env:ProgramData\$inst" }
$log       = "$dir\supervisor.log"
$candado   = "$dir\.corriendo.lock"
$estadoArc = "$dir\estado-impresoras.json"
# El servicio corre de DIR_SERVICIO. Si el dist no esta ahi, se avisa a gritos:
# una actualizacion que no llega al servicio que corre no se detecta sola.
$proyecto  = if ($cfg['DIR_SERVICIO']) { $cfg['DIR_SERVICIO'] } else { $dir }
$node      = if ($cfg['NODE_EXE']) { $cfg['NODE_EXE'] } else { (Get-Command node -EA SilentlyContinue).Source }
$modo      = if ($cfg['STATION_MODE']) { $cfg['STATION_MODE'] } else { 'both' }
$api       = $cfg['API_URL']
$muerto    = "$dir\sin-impresora.prn"

# Clave del print-service (misma del .env del servicio). La API la exige en
# /api/print-queue/incident cuando PRINT_SERVICE_KEY_ENFORCE=true.
$claveServicio = ''
$envServicio = "$proyecto\.env"
if (Test-Path $envServicio) {
  $linea = Get-Content $envServicio | Where-Object { $_ -match '^\s*PRINT_SERVICE_KEY\s*=' } | Select-Object -First 1
  if ($linea) { $claveServicio = ($linea -split '=', 2)[1].Trim() }
}

# Tolerancia antes de dar por caida una impresora que no enumera.
#
# Una sola lectura fallida de PnP no significa nada: Win32_PnPEntity devuelve
# la lista incompleta de vez en cuando y la impresora esta perfecta. Sin esta
# tolerancia el watchdog la aislaba al puerto muerto y ~30s despues la devolvia
# (el 29/08 hubo seis pares AISLADA/CORREGIDA en un dia), y TODA comanda que
# cayera en esa ventana se desviaba a otra estacion sin que hubiera nada roto.
# El atasco de cola ya exigia varias vueltas seguidas; la enumeracion no exigia
# ninguna.
$script:noEnumSeg = @{}   # lecturas seguidas sin enumerar, por impresora
$FALLOS_ENUM      = 3     # lecturas seguidas (~90s) antes de aislar

# Conector fisico -> nombre en Windows. Viene de MAPA_PUERTOS en caja.env. Verificar
# con un ticket rotulado (identificar-impresoras.ps1) y actualizarlo si una
# impresora cambia de conector.
$MAPA = Get-MapaPuertos $cfg

if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

function Escribir($m) {
  $l = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Write-Output $l
  try { Add-Content -Path $log -Value $l -Encoding UTF8 } catch { }
}

function Avisar($nivel, $mensaje, $ctx) {
  try {
    $body = @{ level = $nivel; source = 'supervisor-impresion'; message = $mensaje
               context = $ctx; platform = "print-service@$env:COMPUTERNAME" } |
            ConvertTo-Json -Depth 6 -Compress
    Invoke-WebRequest "$api/api/client-logs" -Method POST -Body $body `
      -ContentType 'application/json' -UseBasicParsing -TimeoutSec 12 | Out-Null
  } catch { }
}

# Reporta un incidente de impresion al servidor para que dispare la alerta por
# correo. Separado de Avisar porque esto SI tiene que despertar a alguien.
function Reportar-Incidente($cuerpo) {
  try {
    $cuerpo['equipo'] = $env:COMPUTERNAME
    $body = $cuerpo | ConvertTo-Json -Depth 6 -Compress
    $cabeceras = @{}
    if ($claveServicio) { $cabeceras['X-Print-Service-Key'] = $claveServicio }
    Invoke-WebRequest "$api/api/print-queue/incident" -Method POST -Body $body `
      -Headers $cabeceras -ContentType 'application/json' -UseBasicParsing -TimeoutSec 12 | Out-Null
  } catch { }
}

# -- Candado: una sola instancia, pase lo que pase -------------------------
# Es lo que faltaba: la tarea permitia instancias paralelas y se apilaban.
try {
  $lock = [System.IO.File]::Open($candado, 'OpenOrCreate', 'ReadWrite', 'None')
} catch {
  Write-Output 'Ya hay otra instancia corriendo. Esta se retira.'
  exit 0
}

Escribir '=========== supervisor de impresion arranca ==========='
if (-not $api) { Escribir 'API_URL vacia en caja.env: no hay avisos ni incidentes al servidor' }
Escribir ("usuario: $env:USERNAME | equipo encendido hace " +
  [math]::Round(((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalMinutes,1) + ' min')

# Antes que nada: el bus USB en condiciones. Si el ahorro de energia esta
# activo, la impresora puede enumerar y aun asi no recibir datos.
Blindar-Energia-USB | Out-Null

# El servicio DEBE estar en $proyecto. Si no esta, se grita: es preferible un
# error ruidoso a arrancar en silencio una version vieja de otra carpeta.
if (-not (Test-Path "$proyecto\dist\index.js")) {
  Escribir "ERROR GRAVE: no existe $proyecto\dist\index.js"
  Avisar 'error' 'No existe el dist del print-service; NO SE PUEDE IMPRIMIR' @{ ruta = "$proyecto\dist\index.js" }
}

# Reaplica el blindaje de energia USB. NO es cosmetico: es el fix del 07/08 que
# resolvio "la impresora enumera OK pero no imprime" (suspension selectiva) y
# que se REVIERTE SOLO. Verificado el 16/08: los 11 hubs habian vuelto a
# Enable=True. Se revierte porque aqui hay apagones a diario (4 eventos 6008
# entre el 14 y el 16) y al recrearse el nodo del dispositivo vuelve al default.
#
# Por eso se aplica en CADA arranque del loop en vez de una sola vez a mano:
# un fix que hay que acordarse de reaplicar despues de cada apagon no es un fix.
function Blindar-Energia-USB {
  $tocados = 0
  try {
    # Suspension selectiva del plan de energia (sobrevive mejor, pero se
    # comprueba igual: un cambio de plan la devuelve al default).
    $sub = '2a737441-1930-4402-8d77-b2bebba308a3'
    $set = '48e6b7a6-50f5-4782-a5d4-53bb8f07e226'
    & powercfg /SETACVALUEINDEX SCHEME_CURRENT $sub $set 0 2>&1 | Out-Null
    & powercfg /SETDCVALUEINDEX SCHEME_CURRENT $sub $set 0 2>&1 | Out-Null
    & powercfg /SETACTIVE SCHEME_CURRENT 2>&1 | Out-Null
  } catch { }
  try {
    Get-CimInstance -ClassName MSPower_DeviceEnable -Namespace root\wmi -EA SilentlyContinue |
      ForEach-Object {
        if ($_.Enable) {
          try { $_ | Set-CimInstance -Property @{ Enable = $false } -EA Stop; $tocados++ } catch { }
        }
      }
  } catch { }
  if ($tocados -gt 0) {
    Escribir "Ahorro de energia USB desactivado en $tocados dispositivo(s) (se habia revertido)"
    Avisar 'warn' "Se reaplico el blindaje de energia USB en $tocados dispositivos" @{ dispositivos = $tocados }
  }
  return $tocados
}

function Impresoras-Conectadas {
  $r = @{}
  Get-CimInstance Win32_PnPEntity -EA SilentlyContinue |
    Where-Object { $_.PNPDeviceID -like 'USBPRINT*' } | ForEach-Object {
      $pt = (Get-ItemProperty ("HKLM:\SYSTEM\CurrentControlSet\Enum\" + $_.PNPDeviceID + "\Device Parameters") -Name PortName -EA SilentlyContinue).PortName
      if (-not $pt) { return }
      $padre = (Get-PnpDeviceProperty -InstanceId $_.PNPDeviceID -KeyName 'DEVPKEY_Device_Parent' -EA SilentlyContinue).Data
      if (-not $padre) { return }
      $rutas = (Get-PnpDeviceProperty -InstanceId $padre -KeyName 'DEVPKEY_Device_LocationPaths' -EA SilentlyContinue).Data
      $con = $rutas | Where-Object { $_ -like 'PCIROOT*' } | Select-Object -First 1
      if ($con) { $r[$con] = $pt }
    }
  return $r
}

# Busca el puerto de un conector tolerando el sufijo de aparato compuesto
# ("<conector>#USBMI(0)"). Devuelve $null si esa impresora no esta enumerada.
function Puerto-De($vivas, $conector) {
  if ($vivas.ContainsKey($conector)) { return $vivas[$conector] }
  foreach ($k in $vivas.Keys) {
    if ($k.StartsWith($conector)) { return $vivas[$k] }
  }
  return $null
}

# Amarra cada nombre a su conector. Una impresora que NO enumera se manda al
# puerto muerto SIEMPRE (antes solo si su puerto viejo era de otra estacion).
# Apuntando a un puerto muerto los trabajos fallan rapido; apuntando a un USB
# fantasma se apilan en 'Error, Printing, Retained' y no sale nada por dias.
function Verificar-Cola-Existe($nombre) {
  $cola = Get-Printer -Name $nombre -EA SilentlyContinue
  if (-not $cola) { return $false }
  return $true
}

function Corregir-Puertos {
  $vivas = Impresoras-Conectadas
  $cambios = 0
  foreach ($e in $MAPA.GetEnumerator()) {
    $nombre = $e.Value
    $imp = Get-Printer -Name $nombre -EA SilentlyContinue
    if (-not $imp) { Escribir "ERROR: no existe la cola de Windows '$nombre'"; continue }

    $pt = Puerto-De $vivas $e.Key
    if ($pt) {
      $script:noEnumSeg[$nombre] = 0
      if ($imp.PortName -ne $pt) {
        try { Set-Printer -Name $nombre -PortName $pt -EA Stop
              Escribir "CORREGIDA $nombre : $($imp.PortName) -> $pt"; $cambios++ } catch { }
      }
    } else {
      # Se cuenta SIEMPRE que no enumere, aunque ya este aislada: si el contador
      # solo subiera mientras tiene puerto bueno, una impresora ya aislada se
      # publicaria como sana estando muerta, y el print-service le mandaria
      # tickets a un puerto que se los traga. Ese silencio costo 493 comandas.
      $fallos = 0
      if ($script:noEnumSeg.ContainsKey($nombre)) { $fallos = $script:noEnumSeg[$nombre] }
      $fallos++
      $script:noEnumSeg[$nombre] = $fallos

      if ($imp.PortName -ne $muerto) {
        if ($fallos -lt $FALLOS_ENUM) {
          Escribir "$nombre no enumera (lectura $fallos de $FALLOS_ENUM) - se deja donde esta"
        } else {
          if (-not (Get-PrinterPort -Name $muerto -EA SilentlyContinue)) {
            try { Add-PrinterPort -Name $muerto -EA Stop } catch { }
          }
          try { Set-Printer -Name $nombre -PortName $muerto -EA Stop
                Escribir "AISLADA $nombre (no enumera en $fallos lecturas; estaba en $($imp.PortName))"; $cambios++ } catch { }
        }
      }
    }
  }
  return $cambios
}

function Servicio-Vivo {
  return [bool](Get-NetTCPConnection -LocalPort 6441 -State Listen -EA SilentlyContinue)
}

function Levantar-Servicio {
  Escribir 'Servicio caido: levantando...'
  Corregir-Puertos | Out-Null           # puertos ANTES que la app, siempre
  $patronImp = if ($cfg['PATRON_IMPRESORAS']) { $cfg['PATRON_IMPRESORAS'] } else { '*' }
  $mapa = (Get-Printer | Where-Object Name -like $patronImp | ForEach-Object { $_.Name + '=' + $_.PortName }) -join ' | '
  Escribir "   $mapa"
  Start-Process -FilePath $node -ArgumentList 'dist\index.js',"--$modo" `
    -WorkingDirectory $proyecto -WindowStyle Hidden `
    -RedirectStandardOutput "$dir\service-out.log" -RedirectStandardError "$dir\service-err.log"
  for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep 5
    if (Servicio-Vivo) {
      Escribir ("   ARRIBA tras " + (($i+1)*5) + 's')
      Avisar 'warn' 'Print-service levantado' @{ segundos = ($i+1)*5; impresoras = $mapa }
      return $true
    }
  }
  Escribir '   NO levanto en 60s'
  Avisar 'error' 'El print-service NO levanta. NO SE ESTA IMPRIMIENDO' @{ impresoras = $mapa }
  return $false
}

# Cicla (apaga/enciende) el aparato POS-58 que cuelga de un conector fisico.
# Reestablece el canal de datos cuando el puerto queda "presente pero dormido"
# tras un apagon (enumera OK pero no imprime).
#
# ANTES filtraba por VID_0416&PID_5011 y exigia que la ruta fuera EXACTAMENTE
# igual al conector. Con POS-BARRA devolvia False las 199 veces por dos motivos:
# el chipset puede reportar otro VID/PID, y un aparato compuesto no cuelga en
# la ruta pelada sino en "<conector>#USBMI(0)". Ahora se busca por prefijo del
# conector fisico, que es el unico dato estable en estas tres impresoras.
#
# El ")" final del conector evita confundir USB(1) con USB(10): "...USB(10)"
# no empieza por "...USB(1)".
# Espera a que el aparato de un conector vuelva a dar puerto de impresora.
# Enumerar en el arbol USB NO basta: mientras no exista el nodo USBPRINT no hay
# puerto y no se puede imprimir.
function Enumera-De-Nuevo($conector, $intentos = 6) {
  for ($i = 0; $i -lt $intentos; $i++) {
    Start-Sleep 2
    if (Puerto-De (Impresoras-Conectadas) $conector) { return $true }
  }
  return $false
}

# Nodos "Unknown USB Device (Device Descriptor Request Failed)": el aparato esta
# enchufado y con corriente, pero Windows no logro leerle el descriptor. El nodo
# fallido se queda OCUPANDO el puerto y ningun re-escaneo lo despeja: hay que
# borrarlo. Ojo: estos nodos NO reportan LocationPaths, asi que no se pueden
# casar por conector — se casan por el numero de puerto con que Windows numera
# al hijo del hub, que es el final del InstanceId ("...&0&3" para USB(3)).
function Fantasmas-Del-Puerto($conector) {
  if ($conector -notmatch 'USB\((\d+)\)\s*$') { return @() }
  $puerto = $Matches[1]
  return @(Get-PnpDevice -EA SilentlyContinue | Where-Object {
    $_.FriendlyName -like '*Device Descriptor Request Failed*' -and $_.InstanceId -match "&$puerto$"
  })
}

function Ciclar-Device($conector) {
  $candidatos = @()
  foreach ($d in @(Get-PnpDevice -PresentOnly -EA SilentlyContinue | Where-Object { $_.InstanceId -like 'USB*' })) {
    $loc = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_LocationPaths' -EA SilentlyContinue).Data |
           Where-Object { $_ -like 'PCIROOT*' } | Select-Object -First 1
    if ($loc -and $loc.StartsWith($conector)) {
      $candidatos += [pscustomobject]@{ Dev = $d; Loc = $loc; Exacta = ($loc -eq $conector) }
    }
  }
  # Se prefiere el aparato que cuelga de la ruta pelada (el padre compuesto):
  # ciclarlo reinicia el puerto entero. Si no esta, sirve cualquier interfaz.
  $dev = ($candidatos | Sort-Object -Property Exacta -Descending | Select-Object -First 1).Dev

  if ($dev) {
    try {
      Disable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -EA Stop
      Start-Sleep 3
      Enable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -EA Stop
    } catch {
      Escribir "   fallo el ciclado de $conector : $($_.Exception.Message)"
    }
    # SE COMPRUEBA QUE VOLVIO. Antes se devolvia $true nada mas ciclar y nadie
    # verificaba: el 29/08 la barra no volvio del ciclo y se quedo muerta cuatro
    # horas sin una sola alerta, mientras el log decia "device ciclado: True".
    if (Enumera-De-Nuevo $conector) { return $true }
    Escribir "   ciclado hecho pero $conector NO reaparecio - limpiando el puerto"
  }

  # No volvio (o no habia nada que ciclar): despejar el puerto y re-escanear.
  foreach ($x in (Fantasmas-Del-Puerto $conector)) {
    Escribir "   nodo fallido en el puerto -> se elimina: $($x.InstanceId)"
    try { & pnputil /remove-device $x.InstanceId 2>&1 | Out-Null } catch { }
  }
  try { & pnputil /scan-devices 2>&1 | Out-Null } catch { }
  if (Enumera-De-Nuevo $conector) {
    Escribir "   $conector volvio tras limpiar el puerto"
    return $true
  }

  Escribir "   $conector SIGUE SIN ENUMERAR: hace falta desenchufar y volver a enchufar el cable"
  return $false
}

# Auto-recuperacion de una impresora atascada: limpia la cola (y si hay un
# trabajo basura trabado, reinicia el Spooler), luego cicla su aparato para
# despertar el puerto.
#
# ANTES borraba la cola sin dejar rastro. Ahora se anota QUE se esta botando
# (documento, hora de envio, estado) y se manda al servidor: si se pierde una
# comanda, tiene que quedar constancia de cual.
function Recuperar-Impresora($nombre, $conector) {
  Escribir "AUTO-RECUPERANDO $nombre (atascada, sin drenar)"

  $victimas = @()
  foreach ($j in @(Get-PrintJob -PrinterName $nombre -EA SilentlyContinue)) {
    $enviado = ''
    if ($j.SubmittedTime) { $enviado = $j.SubmittedTime.ToString('s') }
    $victimas += @{ id      = [string]$j.Id
                    papel   = [string]$j.DocumentName
                    enviado = $enviado
                    estado  = [string]$j.JobStatus }
    Escribir "   se pierde: job $($j.Id) '$($j.DocumentName)' enviado $enviado"
  }

  Get-PrintJob -PrinterName $nombre -EA SilentlyContinue | Remove-PrintJob -EA SilentlyContinue
  Start-Sleep 2
  if (@(Get-PrintJob -PrinterName $nombre -EA SilentlyContinue).Count -gt 0) {
    Escribir "   trabajo basura trabado -> reinicio Spooler"
    try {
      Stop-Service Spooler -Force -EA Stop; Start-Sleep 2
      Remove-Item "$env:SystemRoot\System32\spool\PRINTERS\*" -Force -EA SilentlyContinue
      Start-Service Spooler -EA Stop; Start-Sleep 4
    } catch { }
  }

  $ciclado = Ciclar-Device $conector
  Escribir "   device ciclado: $ciclado"
  Avisar 'warn' "$nombre estaba atascada; auto-recuperada (cola limpiada + device ciclado=$ciclado)" @{ impresora = $nombre; conector = $conector; perdidos = $victimas.Count }

  if ($victimas.Count -gt 0) {
    Reportar-Incidente @{ tipo = 'purga'; impresora = $nombre; conector = $conector
                          ciclado = $ciclado; trabajos = $victimas }
  }
  return $ciclado
}

# Publica el estado para que el print-service lo lea ANTES de mandar un ticket
# y lo desvie a otra impresora en vez de darlo por impreso.
function Publicar-Estado($estados) {
  try {
    $doc = @{ actualizado = (Get-Date).ToString('o'); impresoras = $estados }
    $json = $doc | ConvertTo-Json -Depth 6
    # SIN BOM a proposito: "Set-Content -Encoding UTF8" en PowerShell 5.1 mete
    # BOM y el JSON.parse de Node revienta con el. El print-service tambien lo
    # limpia por su lado, pero el archivo debe nacer bien.
    $sinBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($estadoArc, $json, $sinBom)
  } catch { }
}

# -- Bucle unico -----------------------------------------------------------
$vueltas     = 0
$headPrev    = @{}   # id del trabajo de cabeza en la vuelta anterior por impresora
$atascoSeg   = @{}   # vueltas consecutivas atascada por impresora
$ultimaRecup = @{}   # en que vuelta se recupero por ultima vez (cooldown)
$cicladoFall = @{}   # recuperaciones seguidas en las que NO se pudo ciclar
$caidaDesde  = @{}   # desde cuando esta caida cada impresora
$gritoDado   = @{}   # ya se pidio intervencion fisica para esta impresora
$SEGUIDAS    = 3     # vueltas seguidas atascada (~90s) antes de actuar
$ENFRIAR     = 10    # vueltas de espera tras recuperar (~5 min) antes de reintentar
$BULK        = 20    # backlog enorme: recuperar aunque el id cambie
$GRITAR      = 3     # recuperaciones fallidas seguidas -> pedir mano humana
while ($true) {
  try {
    # Cada ~30 min se recomprueba el blindaje de energia: si Windows lo
    # revirtio (pasa al recrearse un nodo tras un apagon), se vuelve a poner.
    if ($vueltas -gt 0 -and $vueltas % 60 -eq 0) { Blindar-Energia-USB | Out-Null }

    $cambios = Corregir-Puertos
    if (-not (Servicio-Vivo)) {
      Levantar-Servicio | Out-Null
    } elseif ($cambios -gt 0) {
      Escribir "Puertos reacomodados ($cambios) con el servicio en marcha"
    }

    $vivas   = Impresoras-Conectadas
    $estados = @{}

    # Deteccion de atasco + AUTO-RECUPERACION (cada vuelta).
    # "Atascada" = hay trabajos y el de CABEZA no avanza: el mismo job queda
    # clavado entre vueltas, o su estado es de Error/Retenido. Una impresora sana
    # termina el de cabeza en segundos (su id cambia), asi que un rush normal NO
    # dispara esto; una POS-58 dormida tras un apagon deja el mismo job clavado SI.
    foreach ($e in $MAPA.GetEnumerator()) {
      $conector = $e.Key
      $n = $e.Value
      $enumera = [bool](Puerto-De $vivas $conector)

      $jobs = @(Get-PrintJob -PrinterName $n -EA SilentlyContinue | Sort-Object Id)
      $c = $jobs.Count
      $head = -1;  if ($c -gt 0) { $head = [int]$jobs[0].Id }
      $hstat = ''; if ($c -gt 0) { $hstat = [string]$jobs[0].JobStatus }
      $prevHead = -1; if ($headPrev.ContainsKey($n)) { $prevHead = $headPrev[$n] }
      $seg = 0; if ($atascoSeg.ContainsKey($n)) { $seg = $atascoSeg[$n] }

      $trabada = ($c -ge 1 -and $head -eq $prevHead) -or ($hstat -match 'Error|Retained') -or ($c -ge $BULK)
      if ($trabada) { $atascoSeg[$n] = $seg + 1 } else { $atascoSeg[$n] = 0 }
      $headPrev[$n] = $head

      # Estado publicado: no enumerar es caida dura; atascada es caida blanda.
      # Misma tolerancia que el aislamiento: el print-service lee este archivo
      # antes de CADA ticket, asi que marcar 'caida' por una lectura suelta
      # desviaba comandas con las tres impresoras sanas.
      $fallosEnum = 0
      if ($script:noEnumSeg.ContainsKey($n)) { $fallosEnum = $script:noEnumSeg[$n] }
      if (-not $enumera -and $fallosEnum -ge $FALLOS_ENUM) {
        if (-not $caidaDesde.ContainsKey($n)) { $caidaDesde[$n] = (Get-Date).ToString('o') }
        $estados[$n] = @{ estado = 'caida'; motivo = 'no enumera en su conector USB'
                          desde = $caidaDesde[$n]; conector = $conector }
      } elseif ($atascoSeg[$n] -ge $SEGUIDAS) {
        if (-not $caidaDesde.ContainsKey($n)) { $caidaDesde[$n] = (Get-Date).ToString('o') }
        $estados[$n] = @{ estado = 'caida'; motivo = "cola atascada ($hstat)"
                          desde = $caidaDesde[$n]; conector = $conector }
      } elseif (-not (Verificar-Cola-Existe $n)) {
        # La cola desapareci del sistema (se borro accidentalmente o Windows la retiró)
        if (-not $caidaDesde.ContainsKey($n)) { $caidaDesde[$n] = (Get-Date).ToString('o') }
        $estados[$n] = @{ estado = 'caida'; motivo = "cola de Windows no existe"
                          desde = $caidaDesde[$n]; conector = $conector }
        Escribir "FALTANTE $n (la cola de Windows desaparecio del sistema)"
        Avisar 'error' "${n}: la cola de Windows no existe en el sistema" @{ impresora = $n; conector = $conector }
      } else {
        $caidaDesde.Remove($n) | Out-Null
        $gritoDado.Remove($n)  | Out-Null
        $estados[$n] = @{ estado = 'ok'; conector = $conector }
      }

      $enfriando = $ultimaRecup.ContainsKey($n) -and (($vueltas - $ultimaRecup[$n]) -lt $ENFRIAR)
      if ($atascoSeg[$n] -ge $SEGUIDAS -and -not $enfriando) {
        Escribir "ATASCO $n ($c trabajos, cabeza clavada $($atascoSeg[$n]) vueltas, estado '$hstat')"
        Avisar 'error' "$n atascada: el trabajo de cabeza no avanza" @{ impresora = $n; pendientes = $c; estado = $hstat }
        $ciclado = Recuperar-Impresora $n $conector
        $ultimaRecup[$n] = $vueltas
        $atascoSeg[$n] = 0
        $headPrev[$n] = -1

        # Escalado: si el ciclado falla varias veces seguidas, no hay nada mas
        # que el software pueda hacer. Es cable, puerto o aparato: hay que ir.
        if ($ciclado) {
          $cicladoFall[$n] = 0
        } else {
          $f = 0; if ($cicladoFall.ContainsKey($n)) { $f = $cicladoFall[$n] }
          $cicladoFall[$n] = $f + 1
          if ($cicladoFall[$n] -ge $GRITAR -and -not $gritoDado.ContainsKey($n)) {
            $gritoDado[$n] = $true
            Escribir "$n NO se puede recuperar por software tras $($cicladoFall[$n]) intentos"
            Reportar-Incidente @{ tipo = 'requiere_intervencion'; impresora = $n
                                  conector = $conector; intentos = $cicladoFall[$n]
                                  desde = $caidaDesde[$n]
                                  motivo = 'el aparato no responde al ciclado; revisar cable, puerto USB o impresora' }
          }
        }
      }
    }

    Publicar-Estado $estados
  } catch {
    Escribir ('Error en el ciclo: ' + $_.Exception.Message)
  }
  $vueltas++
  Start-Sleep 30
}
