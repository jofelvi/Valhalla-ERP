@echo off
setlocal
title Print Service

cd /d "%~dp0.."
set "PROJECT_DIR=%CD%"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "LOG=%LOG_DIR%\service.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

echo ============================================
echo   Print Service v2.3
echo   Log: %LOG%
echo ============================================
echo.
>>"%LOG%" echo === Arranque %DATE% %TIME% ===

:: Verificar que Node.js esta instalado
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado. Descarga: https://nodejs.org
    >>"%LOG%" echo [ERROR] Node.js no esta instalado.
    echo.
    echo Esta ventana NO se cierra sola. Presiona una tecla para salir.
    pause >nul
    exit /b 1
)

:: Instalar deps si faltan
if not exist "node_modules" (
    echo [Setup] Instalando dependencias...
    >>"%LOG%" echo [Setup] npm install
    call npm install >>"%LOG%" 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install fallo. Ver log: %LOG%
        >>"%LOG%" echo [ERROR] npm install fallo.
        echo.
        echo Esta ventana NO se cierra sola. Presiona una tecla para salir.
        pause >nul
        exit /b 1
    )
)

:: Modo de estacion via argumento o env var
set "STATION_ARG=%1"
if "%STATION_ARG%"=="" if not "%STATION_MODE%"=="" (
    set "STATION_ARG=--%STATION_MODE%"
)

echo Iniciando servicio... (Ctrl+C para detener)
echo Toda la salida se duplica en: %LOG%
echo.
>>"%LOG%" echo --- inicio servicio (arg: %STATION_ARG%) ---

:: Usar build compilado si existe (rapido), sino tsx (dev fallback)
if exist "dist\index.js" (
    echo [INFO] Usando build compilado (node dist/index.js)
    >>"%LOG%" echo [INFO] Usando build compilado
    node dist\index.js %STATION_ARG% 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -FilePath '%LOG%' -Append"
) else (
    echo [WARN] dist\index.js no encontrado, usando tsx (modo dev)
    echo [WARN] Ejecuta 'npm run build' para compilar y acelerar el arranque.
    >>"%LOG%" echo [WARN] Usando tsx (sin compilar)
    powershell -NoProfile -ExecutionPolicy Bypass -Command "& { npx tsx src/index.ts %STATION_ARG% 2>&1 | Tee-Object -FilePath '%LOG%' -Append }"
)

:: Si llegamos aca el servicio se detuvo (manual o por error)
set "EXITCODE=%ERRORLEVEL%"
echo.
echo ============================================
echo   Servicio detenido (exit code: %EXITCODE%)
echo   Log completo: %LOG%
echo ============================================
>>"%LOG%" echo [%TIME%] === Servicio detenido (exit code: %EXITCODE%) ===
echo.
echo Esta ventana NO se cierra sola. Presiona una tecla para salir.
pause >nul
endlocal
exit /b %EXITCODE%
