#!/usr/bin/env bash
set -e

echo "============================================"
echo " Instalar Print Service como servicio systemd"
echo "============================================"
echo

if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Ejecuta con sudo: sudo $0"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
START_SH="${PROJECT_DIR}/scripts/start.sh"

if [ ! -f "$START_SH" ]; then
  echo "[ERROR] No se encontró $START_SH"
  exit 1
fi

chmod +x "$START_SH"

# Detectar usuario no-root para correr el servicio
SERVICE_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"

echo "Usuario para el servicio: $SERVICE_USER"
echo

# Preguntar modo de estación
echo "Selecciona el modo de estación por defecto:"
echo "  1. Cocina + Barra (todo)"
echo "  2. Solo Cocina"
echo "  3. Barra completa"
echo "  4. Barra 1 (arriba)"
echo "  5. Barra 2 (abajo)"
echo "  6. Cocina + Barra 1"
read -rp "Opción [1-6] (Enter=1): " STATION_OPT

STATION_MODE=""
case "${STATION_OPT:-1}" in
  2) STATION_MODE="kitchen" ;;
  3) STATION_MODE="bar" ;;
  4) STATION_MODE="bar-1" ;;
  5) STATION_MODE="bar-2" ;;
  6) STATION_MODE="kitchen+1" ;;
  *) STATION_MODE="both" ;;
esac

SERVICE_FILE=/etc/systemd/system/print-service.service

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Print Service
After=network.target cups.service
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
Environment=STATION_MODE=$STATION_MODE
Environment=NODE_ENV=production
ExecStart=/bin/bash $START_SH
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo
echo "[Setup] Archivo de servicio creado: $SERVICE_FILE"

systemctl daemon-reload
systemctl enable print-service.service
systemctl restart print-service.service

echo
echo "[OK] Servicio instalado y arrancado."
echo
echo "Comandos útiles:"
echo "  sudo systemctl status print-service     # Ver estado"
echo "  sudo systemctl restart print-service    # Reiniciar"
echo "  sudo systemctl stop print-service       # Detener"
echo "  sudo journalctl -u print-service -f     # Ver logs en vivo"
echo
echo "Para desinstalar:"
echo "  sudo systemctl disable --now print-service"
echo "  sudo rm $SERVICE_FILE"
echo
