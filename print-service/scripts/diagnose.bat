@echo off
echo.
echo ============================================================
echo   Print Service - Diagnostico
echo ============================================================
echo.
echo [1/4] Impresoras instaladas en Windows:
echo ------------------------------------------------------------
powershell -NoProfile -Command "Get-Printer | Select-Object Name, PrinterStatus | Format-Table -AutoSize"
echo.
echo [2/4] Verificando servicio en puerto 6441...
echo ------------------------------------------------------------
curl -s --max-time 3 http://127.0.0.1:6441/status
if %errorlevel% neq 0 (
    echo.
    echo El servicio NO esta corriendo. Ejecuta start.bat primero.
) else (
    echo.
    echo Servicio activo.
)
echo.
echo [3/4] Configuracion actual (.env):
echo ------------------------------------------------------------
if exist "%~dp0..\.env" (
    type "%~dp0..\.env"
) else (
    echo Archivo .env no encontrado
)
echo.
echo [4/4] Test de impresora (test-print.bat):
echo ------------------------------------------------------------
echo Ejecuta test-print.bat para enviar una prueba a la impresora.
echo.
echo ============================================================
echo Copia el nombre EXACTO de la impresora del paso [1]
echo y editalo en print-service/.env
echo ============================================================
echo.
pause
