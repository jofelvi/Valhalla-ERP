#!/usr/bin/env bash
set -e

echo "============================================"
echo "  Print Service v2.3"
echo "============================================"
echo

cd "$(dirname "$0")/.."

# Verificar Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js no está instalado."
  echo "  Ubuntu/Debian: sudo apt install nodejs npm"
  echo "  O descarga: https://nodejs.org"
  exit 1
fi

# Instalar deps si faltan
if [ ! -d "node_modules" ]; then
  echo "[Setup] Instalando dependencias..."
  npm install
fi

# Verificar permisos para /dev/usb/lp* (Linux)
if [ -d /dev/usb ] && ls /dev/usb/lp* >/dev/null 2>&1; then
  FIRST_LP=$(ls /dev/usb/lp* 2>/dev/null | head -n1)
  if [ -n "$FIRST_LP" ] && [ ! -w "$FIRST_LP" ]; then
    echo "[Aviso] No tienes permisos de escritura en $FIRST_LP"
    echo "  Ejecuta: sudo usermod -aG lp \$USER && newgrp lp"
    echo "  O corre el servicio con sudo (no recomendado)."
  fi
fi

# El modo se puede pasar como argumento: ./start.sh --kitchen, --bar, etc.
# O por variable de entorno STATION_MODE
STATION_ARG="${1:-}"
if [ -z "$STATION_ARG" ] && [ -n "${STATION_MODE:-}" ]; then
  STATION_ARG="--${STATION_MODE}"
fi

echo "Iniciando servicio... (Ctrl+C para detener)"
echo
exec npx tsx src/index.ts ${STATION_ARG}
