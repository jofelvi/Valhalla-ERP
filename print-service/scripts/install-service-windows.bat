@echo off
setlocal enabledelayedexpansion
title Print Service - Instalar como Servicio Windows
color 0A

:: ============================================================
:: Print Service - Instalar Print Service como servicio Windows
:: Usa NSSM (Non-Sucking Service Manager) - no requiere login.
:: Ejecutar como Administrador.
:: ============================================================

net session >nul 2>&1
if errorlevel 1 (
    echo [Info] Requiere permisos de administrador. Elevando...
    powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    exit /b 0
)

cd /d "%~dp0.."
set "PROJECT_DIR=%CD%"
set "SVC_NAME=PrintService"
set "NSSM_EXE=%PROJECT_DIR%\tools\nssm.exe"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "LOG=%LOG_DIR%\install-service.log"
set "NODE_EXE="

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
> "%LOG%" echo === Print Service - Instalacion como servicio Windows ===
>>"%LOG%" echo Fecha: %DATE% %TIME%
>>"%LOG%" echo Usuario: %USERNAME%  PC: %COMPUTERNAME%
>>"%LOG%" echo PROJECT_DIR: %PROJECT_DIR%
>>"%LOG%" echo.

cls
echo.
echo ============================================================
echo   Print Service como Servicio Windows
echo   El servicio arrancara automaticamente con Windows,
echo   sin necesidad de iniciar sesion ni abrir ventanas.
echo ============================================================
echo.

:: ---- 1) Node.js ----
echo [1/5] Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no encontrado.
    echo         Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar este script.
    >>"%LOG%" echo [ERROR] Node.js no encontrado
    goto end_error
)
for /f "delims=" %%p in ('where node') do set "NODE_EXE=%%p"
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo        Node: %NODE_VER%  [%NODE_EXE%]
>>"%LOG%" echo [OK] Node: %NODE_VER% en %NODE_EXE%

:: ---- 2) Dependencias + Build ----
echo.
echo [2/5] Build de TypeScript...
if not exist "node_modules" (
    echo        Instalando dependencias (primera vez, puede tardar 1-2 min)...
    >>"%LOG%" echo --- npm install ---
    call npm install >>"%LOG%" 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install fallo. Ver: %LOG%
        goto end_error
    )
)
echo        Compilando...
>>"%LOG%" echo --- npm run build ---
call npm run build >>"%LOG%" 2>&1
if errorlevel 1 (
    echo [ERROR] Build fallo. Ver: %LOG%
    goto end_error
)
if not exist "dist\index.js" (
    echo [ERROR] dist\index.js no fue generado.
    goto end_error
)
echo        Build OK - dist\index.js listo
>>"%LOG%" echo [OK] Build completado

:: ---- 3) Descargar NSSM si no existe ----
echo.
echo [3/5] Verificando NSSM...
if not exist "%NSSM_EXE%" (
    echo        Descargando NSSM (herramienta de servicios Windows)...
    if not exist "%PROJECT_DIR%\tools" mkdir "%PROJECT_DIR%\tools"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '$env:TEMP\nssm.zip'; Expand-Archive -Path '$env:TEMP\nssm.zip' -DestinationPath '$env:TEMP\nssm-tmp' -Force; Copy-Item '$env:TEMP\nssm-tmp\nssm-2.24\win64\nssm.exe' -Destination '%NSSM_EXE%' -Force; Write-Host 'NSSM descargado OK' } catch { Write-Host ('ERROR descargando NSSM: ' + $_.Exception.Message) }" >>"%LOG%" 2>&1
    if not exist "%NSSM_EXE%" (
        echo [ERROR] No se pudo descargar NSSM.
        echo         1. Verifica la conexion a internet.
        echo         2. Descarga manualmente: https://nssm.cc/release/nssm-2.24.zip
        echo            Extrae  win64\nssm.exe  a:  %PROJECT_DIR%\tools\nssm.exe
        echo         3. Vuelve a ejecutar este script.
        goto end_error
    )
    echo        NSSM descargado OK
)
echo        NSSM OK: %NSSM_EXE%
>>"%LOG%" echo [OK] NSSM presente

:: ---- 4) Instalar / actualizar servicio ----
echo.
echo [4/5] Instalando servicio "%SVC_NAME%"...

:: Detener y eliminar si ya existe
sc query "%SVC_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo        Servicio existente detectado. Actualizando...
    >>"%LOG%" echo [Info] Deteniendo y eliminando servicio existente
    "%NSSM_EXE%" stop "%SVC_NAME%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    "%NSSM_EXE%" remove "%SVC_NAME%" confirm >>"%LOG%" 2>&1
)

:: Crear el servicio con node dist/index.js
>>"%LOG%" echo --- nssm install ---
"%NSSM_EXE%" install         "%SVC_NAME%"  "%NODE_EXE%"  "dist\index.js" >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppDirectory  "%PROJECT_DIR%"               >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" DisplayName   "Print Service" >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" Description   "Impresion termica. No cerrar." >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" Start         SERVICE_AUTO_START             >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppStdout     "%LOG_DIR%\service.log"        >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppStderr     "%LOG_DIR%\service-err.log"    >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppRotateFiles 1                             >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppRotateOnline 1                            >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppRotateBytes 5242880                       >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppRestartDelay 5000                         >>"%LOG%" 2>&1
"%NSSM_EXE%" set "%SVC_NAME%" AppThrottle 10000                            >>"%LOG%" 2>&1

if errorlevel 1 (
    echo [ERROR] No se pudo instalar el servicio. Ver: %LOG%
    goto end_error
)
echo        Servicio instalado correctamente.
>>"%LOG%" echo [OK] Servicio instalado

:: ---- 5) Iniciar servicio ----
echo.
echo [5/5] Iniciando el servicio...
>>"%LOG%" echo --- sc start ---
sc start "%SVC_NAME%" >>"%LOG%" 2>&1
timeout /t 4 /nobreak >nul

sc query "%SVC_NAME%" | find "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo [WARN] El servicio no reporta RUNNING todavia.
    echo        Puede tardar unos segundos en arrancar.
    echo        Revisa el log: %LOG_DIR%\service.log
    sc query "%SVC_NAME%"
) else (
    echo        Servicio CORRIENDO
    start "" "http://localhost:6441/status"
)

echo.
echo ============================================================
echo   INSTALACION COMPLETADA
echo.
echo   Servicio:    %SVC_NAME%
echo   Estado:      Arranca automaticamente con Windows
echo   Sin login:   Si (servicio real, no tarea programada)
echo.
echo   Log:         %LOG_DIR%\service.log
echo   Errores:     %LOG_DIR%\service-err.log
echo   Verificar:   http://localhost:6441/status
echo.
echo   Comandos utiles:
echo     sc start %SVC_NAME%
echo     sc stop  %SVC_NAME%
echo     sc query %SVC_NAME%
echo     "%NSSM_EXE%" edit %SVC_NAME%    (GUI de configuracion)
echo     "%NSSM_EXE%" remove %SVC_NAME% confirm   (desinstalar)
echo ============================================================
echo.
goto end_ok

:end_error
echo.
echo ============================================================
echo   ERROR - Instalacion no completada
echo   Ver log completo: %LOG%
echo ============================================================
echo.
pause
exit /b 1

:end_ok
pause
endlocal
exit /b 0
