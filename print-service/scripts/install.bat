@echo off
echo ============================================
echo   Servicio de impresion - Instalacion
echo ============================================
echo.

cd /d "%~dp0.."

echo [1/2] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo ERROR: Fallo npm install
    pause
    exit /b 1
)

echo.
echo [2/2] Compilando TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Fallo la compilacion
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Instalacion completada!
echo   Ejecuta start.bat para iniciar el servicio
echo ============================================
pause
