#!/usr/bin/env bash
#
# nueva-instancia.sh — da de alta una instancia (un cliente) en el VPS compartido.
#
#   Uso:  bash scripts/instancia/nueva-instancia.sh <nombre> [--dry-run]
#
# Lee instancias/<nombre>.env (plantilla: instancias/odin6.env.example) y, antes
# de tocar nada, valida y ABORTA si el puerto, el nombre de PM2, el vhost, la
# carpeta, la base de Mongo o las rutas de la instancia ya existen. Las demas
# instancias y los servicios del VPS no se tocan.
#
# Instala: carpetas y secretos (/etc/<nombre>, 600), checkout del repo, base de
# Mongo (siembra), vhosts de nginx con certbot, proceso PM2 del webhook y, si
# los secretos ya estan cargados, el primer despliegue (la API y la web se
# compilan y se verifican igual que en cada push).
#
# --sin-nginx: instala todo MENOS los vhosts y los certificados (para probar por IP o por un
# tunel SSH antes de lanzar el subdominio). Con URL_API_PUBLICA / URL_WEB_PUBLICA en el .env de la
# instancia se hornea esa direccion en la web (p. ej. http://localhost:3201 con el tunel).
#
# --dry-run: valida y muestra cada paso sin ejecutar nada. Sin instancias/<nombre>.env
# usa la plantilla (instancias/<nombre>.env.example) solo para mostrar el plan.

set -Eeuo pipefail

NOMBRE="${1:-}"
DRY=0
SIN_NGINX=0
for arg in "${@:2}"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --sin-nginx) SIN_NGINX=1 ;;
    *) echo "Argumento desconocido: $arg"; exit 1 ;;
  esac
done
if [ -z "$NOMBRE" ]; then
  echo "Uso: nueva-instancia.sh <nombre> [--dry-run]"
  exit 1
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$RAIZ/instancias/$NOMBRE.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ "$DRY" = "1" ] && [ -f "$RAIZ/instancias/$NOMBRE.env.example" ]; then
    ENV_FILE="$RAIZ/instancias/$NOMBRE.env.example"
    echo "AVISO: no existe instancias/$NOMBRE.env; el plan se muestra con la plantilla."
  else
    echo "Falta instancias/$NOMBRE.env. Copia instancias/$NOMBRE.env.example y completalo."
    exit 1
  fi
fi

# Los errores de validacion se acumulan y se muestran juntos.
errores=0
avisos=0
error() { echo "ERROR: $*"; errores=$((errores + 1)); }
aviso() { echo "AVISO: $*"; avisos=$((avisos + 1)); }
paso() { echo "  - $*"; }
ejecutar() {
  if [ "$DRY" = "1" ]; then
    echo "    [dry-run] $*"
  else
    "$@"
  fi
}

# ── 1. Lectura y validacion del archivo de la instancia ─────────────────────
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "== Instancia $NOMBRE ($(basename "$ENV_FILE")) =="

if ! [[ "$NOMBRE" =~ ^[a-z][a-z0-9]{1,15}$ ]]; then
  error "el nombre debe ser minusculas y digitos, 2 a 16 caracteres, empezando por letra"
fi
for var in INSTANCIA DOMINIO_WEB DOMINIO_API PUERTO_API PUERTO_WEB PUERTO_WEBHOOK BASE_MONGO REPO_URL EMAIL_AVISOS; do
  if [ -z "${!var:-}" ]; then error "falta $var en $(basename "$ENV_FILE")"; fi
done
[ "${INSTANCIA:-}" = "$NOMBRE" ] || error "INSTANCIA ($INSTANCIA) debe ser igual al nombre ($NOMBRE)"
[ -n "${RAMA:-}" ] || RAMA=main
DIR_BASE="${DIR_BASE:-/var/www}"

for var in PUERTO_API PUERTO_WEB PUERTO_WEBHOOK; do
  valor="${!var:-}"
  if ! [[ "$valor" =~ ^[0-9]+$ ]] || [ "$valor" -lt 1024 ] || [ "$valor" -gt 65535 ]; then
    error "$var ($valor) debe ser un puerto entre 1024 y 65535"
  fi
done
if [ "$PUERTO_API" = "$PUERTO_WEB" ] || [ "$PUERTO_API" = "$PUERTO_WEBHOOK" ] || [ "$PUERTO_WEB" = "$PUERTO_WEBHOOK" ]; then
  error "los puertos de API, web y webhook deben ser distintos"
fi

for var in DOMINIO_WEB DOMINIO_API; do
  valor="${!var:-}"
  if ! [[ "$valor" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
    error "$var ($valor) debe ser un nombre de dominio, sin http:// ni barra"
  fi
  if [[ "$valor" == *example.com ]]; then
    if [ "$DRY" = "1" ]; then aviso "$var es un placeholder ($valor): reemplazar antes de instalar"
    else error "$var es un placeholder ($valor): poner el dominio real"; fi
  fi
done

if ! [[ "${BASE_MONGO:-}" =~ ^[A-Za-z][A-Za-z0-9_]{0,62}$ ]]; then
  error "BASE_MONGO (${BASE_MONGO:-}) debe ser un nombre de base simple"
fi

# Puertos que ya tienen otros servicios del VPS compartido (no se usan jamas).
RESERVADOS="3000 3001 3002 3003 3010 3012 3020 3101 3102 4000 4446 4500 5000 5001 5010 5011 5555 6000 6001 6500 8080 9090 9091"
for var in PUERTO_API PUERTO_WEB PUERTO_WEBHOOK; do
  for r in $RESERVADOS; do
    if [ "${!var}" = "$r" ]; then error "$var (${!var}) es un puerto reservado de otro servicio del VPS"; fi
  done
done

# Las rutas de la instancia van por nombre: ninguna carpeta de otra instancia.
WWW="$DIR_BASE"
rutas=(
  "$WWW/$NOMBRE-build" "$WWW/$NOMBRE-api" "$WWW/$NOMBRE-web-releases" "$WWW/$NOMBRE-web-actual"
  "/etc/$NOMBRE" "/var/lib/$NOMBRE-deploy" "/var/backups/$NOMBRE-mongo" "/var/log/$NOMBRE-deploy.log"
)

# ── 2. Choques con lo que ya existe en el VPS ───────────────────────────────
echo "== Comprobaciones previas =="

if command -v ss >/dev/null 2>&1; then
  escuchando=$(ss -ltn 2>/dev/null | awk 'NR>1 {print $4}')
  for var in PUERTO_API PUERTO_WEB PUERTO_WEBHOOK; do
    if printf '%s\n' "$escuchando" | grep -qE "[:.]${!var}\$"; then
      error "$var (${!var}) ya esta en uso en este equipo"
    fi
  done
  paso "puertos libres (ss)"
else
  if [ "$DRY" = "1" ]; then aviso "sin 'ss' en este equipo: la comprobacion de puertos se hace en el VPS"
  else error "falta 'ss' (iproute2): no se puede comprobar que los puertos esten libres"; fi
fi

if command -v pm2 >/dev/null 2>&1; then
  nombres_pm2=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{try{console.log(JSON.parse(s).map(p=>p.name).join(' '))}catch{}})" || true)
  for suf in api web webhook; do
    if printf ' %s ' "$nombres_pm2" | grep -q " $NOMBRE-$suf "; then error "ya existe el proceso PM2 $NOMBRE-$suf"; fi
  done
  paso "procesos PM2 sin choque"
else
  aviso "sin pm2 en este equipo: no se comprueban los procesos"
fi

for sitio in api web; do
  if [ -e "/etc/nginx/sites-available/$NOMBRE-$sitio" ] || [ -e "/etc/nginx/sites-enabled/$NOMBRE-$sitio" ]; then
    error "ya existe el vhost de nginx $NOMBRE-$sitio"
  fi
done
paso "vhosts de nginx sin choque"

for r in "${rutas[@]}"; do
  if [ -e "$r" ]; then error "ya existe $r"; fi
done
paso "carpetas y rutas de la instancia libres"

if command -v mongosh >/dev/null 2>&1; then
  bases=$(mongosh --quiet "${MONGO_URI:-mongodb://127.0.0.1:27017}" --eval 'db.adminCommand({listDatabases:1}).databases.map(d=>d.name).join(" ")' 2>/dev/null || true)
  if printf ' %s ' "$bases" | grep -q " $BASE_MONGO "; then error "ya existe la base de Mongo $BASE_MONGO"; fi
  paso "base de Mongo libre"
else
  aviso "sin mongosh en este equipo: no se comprueba si la base $BASE_MONGO existe"
fi

if [ "$errores" -gt 0 ]; then
  echo "== $errores error(es). No se hizo nada. =="
  exit 1
fi

# ── 3. Plan ─────────────────────────────────────────────────────────────────
echo "== Plan para $NOMBRE =="
echo "  web:      https://$DOMINIO_WEB    -> 127.0.0.1:$PUERTO_WEB  (PM2 $NOMBRE-web)"
echo "  API:      https://$DOMINIO_API    -> 127.0.0.1:$PUERTO_API  (PM2 $NOMBRE-api)"
echo "  webhook:  https://$DOMINIO_API/webhook/deploy -> 127.0.0.1:$PUERTO_WEBHOOK (PM2 $NOMBRE-webhook)"
echo "  Mongo:    base $BASE_MONGO"
echo "  repo:     $REPO_URL ($RAMA) -> $WWW/$NOMBRE-build"
echo "  secretos: /etc/$NOMBRE/ (600, fuera del repo)"
echo "  avisos:   $EMAIL_AVISOS"

if [ "$DRY" = "1" ]; then
  echo "== Pasos (dry-run: no se ejecuta nada) =="
else
  echo "== Instalando =="
fi

# ── 4. Ejecucion ────────────────────────────────────────────────────────────
secreto() { openssl rand -hex 32; }

paso "carpetas y secretos"
ejecutar install -d -m 700 "/etc/$NOMBRE"
ejecutar install -d "$WWW/$NOMBRE-api" "$WWW/$NOMBRE-web-releases" "/var/lib/$NOMBRE-deploy" "/var/backups/$NOMBRE-mongo"
if [ "$DRY" = "0" ]; then
  install -m 644 "$ENV_FILE" "/etc/$NOMBRE/instancia.env"
  if [ ! -f "/etc/$NOMBRE/api.env" ]; then
    cat >"/etc/$NOMBRE/api.env" <<EOF
# Secretos y claves de la API de $NOMBRE. NO versionar.
PORT=$PUERTO_API
MONGODB_URI=mongodb://127.0.0.1:27017/$BASE_MONGO
JWT_SECRET=$(secreto)
LINK_SECRET=$(secreto)
FICHA_SECRET=$(secreto)
PUBLIC_BASE_URL=${URL_API_PUBLICA:-https://$DOMINIO_API}
PUBLIC_APP_URL=${URL_WEB_PUBLICA:-https://$DOMINIO_WEB}
CORS_ORIGINS=${URL_WEB_PUBLICA:-https://$DOMINIO_WEB}
# Opcional (correo, SMS, push, WhatsApp): ver apps/api/.env.example. Sin ellas esos avisos quedan apagados.
EOF
    chmod 600 "/etc/$NOMBRE/api.env"
  fi
  if [ ! -f "/etc/$NOMBRE/web.env" ]; then
    cat >"/etc/$NOMBRE/web.env" <<EOF
# Variables de la web de $NOMBRE. NO versionar. NEXT_PUBLIC_* se hornean en el build.
NEXT_PUBLIC_API_URL=${URL_API_PUBLICA:-https://$DOMINIO_API}
NEXTAUTH_URL=${URL_WEB_PUBLICA:-https://$DOMINIO_WEB}
NEXTAUTH_SECRET=$(secreto)
# Opcional (correo, WhatsApp, conciliacion): ver .env.example en la raiz del repo.
EOF
    chmod 600 "/etc/$NOMBRE/web.env"
  fi
  if [ ! -f "/etc/$NOMBRE/webhook.env" ]; then
    printf 'WEBHOOK_SECRET=%s\n' "$(secreto)" >"/etc/$NOMBRE/webhook.env"
    chmod 600 "/etc/$NOMBRE/webhook.env"
    WEBHOOK_NUEVO=1
  fi
  if [ ! -f "/etc/$NOMBRE/deploy-notify.env" ]; then
    printf 'DEPLOY_NOTIFY_TO=%s\n# CAMBIAR: servicio de correo que usa la instancia.\nNOTIFICATIONS_SERVICE_URL=\nNOTIFICATIONS_API_KEY=\n' "$EMAIL_AVISOS" >"/etc/$NOMBRE/deploy-notify.env"
    chmod 600 "/etc/$NOMBRE/deploy-notify.env"
  fi
  ln -sfn "/etc/$NOMBRE/api.env" "$WWW/$NOMBRE-api/.env"
  touch "/var/log/$NOMBRE-deploy.log"
else
  paso "[dry-run] escribir /etc/$NOMBRE/{instancia,api,web,webhook,deploy-notify}.env (secretos generados, 600)"
fi

CHECKOUT="$WWW/$NOMBRE-build"
paso "repo: clonar $REPO_URL ($RAMA) en $CHECKOUT"
if [ "$DRY" = "0" ]; then
  git clone --branch "$RAMA" "$REPO_URL" "$CHECKOUT"
else
  echo "    [dry-run] git clone --branch $RAMA $REPO_URL $CHECKOUT"
fi

paso "primer despliegue (compila API y web, las verifica y arranca la API)"
secretos_listos=1
for f in "/etc/$NOMBRE/api.env" "/etc/$NOMBRE/web.env"; do
  if [ "$DRY" = "1" ] || [ ! -f "$f" ] || grep -q 'CAMBIAR' "$f"; then secretos_listos=0; fi
done
if [ "$secretos_listos" = "1" ]; then
  ejecutar bash "$CHECKOUT/scripts/deploy/desplegar-servidor.sh" "$NOMBRE" --todo
else
  paso "  NO se despliega todavia: faltan secretos (CAMBIAR en /etc/$NOMBRE/api.env o web.env)."
  paso "  Cargarlos y luego: bash $CHECKOUT/scripts/deploy/desplegar-servidor.sh $NOMBRE --todo"
fi

paso "base de Mongo $BASE_MONGO (siembra)"
SEMBRADOR="apps/api/scripts/sembrar-instancia.mjs"
if [ "$DRY" = "1" ]; then
  echo "    [dry-run] node $SEMBRADOR --instancia $NOMBRE --base $BASE_MONGO --uri mongodb://127.0.0.1:27017"
elif [ "$secretos_listos" = "1" ] && [ -f "$CHECKOUT/$SEMBRADOR" ]; then
  (cd "$CHECKOUT" && node "$SEMBRADOR" --instancia "$NOMBRE" --base "$BASE_MONGO" --uri "mongodb://127.0.0.1:27017")
else
  paso "  pendiente: correr la siembra cuando el primer despliegue haya compilado la API"
fi

# Vhosts: la plantilla va con el dominio y los puertos sustituidos.
plantilla_vhost() {
  local tipo="$1"
  if [ "$tipo" = "api" ]; then
    cat <<'EOF'
server {
    listen 80;
    server_name __DOMINIO__;
    client_max_body_size 20m;

    # Webhook de despliegue: lo recibe el proceso <instancia>-webhook.
    location /webhook/deploy {
        proxy_pass http://127.0.0.1:__PUERTO_WEBHOOK__;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:__PUERTO_API__;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF
  else
    cat <<'EOF'
server {
    listen 80;
    server_name __DOMINIO__;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:__PUERTO_WEB__;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
  fi
}

paso "vhosts de nginx: $NOMBRE-api ($DOMINIO_API) y $NOMBRE-web ($DOMINIO_WEB)"
if [ "$SIN_NGINX" = "1" ]; then
  paso "  --sin-nginx: no se escriben vhosts ni se piden certificados (la instancia queda en 127.0.0.1)"
elif [ "$DRY" = "0" ]; then
  plantilla_vhost api | sed -e "s|__DOMINIO__|$DOMINIO_API|" -e "s|__PUERTO_API__|$PUERTO_API|" -e "s|__PUERTO_WEBHOOK__|$PUERTO_WEBHOOK|" \
    >"/etc/nginx/sites-available/$NOMBRE-api"
  plantilla_vhost web | sed -e "s|__DOMINIO__|$DOMINIO_WEB|" -e "s|__PUERTO_WEB__|$PUERTO_WEB|" \
    >"/etc/nginx/sites-available/$NOMBRE-web"
  ln -sfn "/etc/nginx/sites-available/$NOMBRE-api" "/etc/nginx/sites-enabled/$NOMBRE-api"
  ln -sfn "/etc/nginx/sites-available/$NOMBRE-web" "/etc/nginx/sites-enabled/$NOMBRE-web"
  nginx -t
  systemctl reload nginx
else
  echo "    [dry-run] escribir /etc/nginx/sites-available/$NOMBRE-{api,web} y enlazarlos; nginx -t; reload"
fi

if [ "$SIN_NGINX" = "0" ]; then
paso "certificados TLS (certbot) para $DOMINIO_WEB y $DOMINIO_API"
ejecutar certbot --nginx --non-interactive --agree-tos -m "$EMAIL_AVISOS" --redirect -d "$DOMINIO_WEB" -d "$DOMINIO_API"
fi

paso "webhook PM2 $NOMBRE-webhook (escucha en 127.0.0.1:$PUERTO_WEBHOOK)"
if [ "$DRY" = "0" ]; then
  INSTANCIA="$NOMBRE" PUERTO_WEBHOOK="$PUERTO_WEBHOOK" RAMA="$RAMA" DIR_BUILD="$CHECKOUT" \
    pm2 start "$CHECKOUT/scripts/deploy/webhook-runner.mjs" --name "$NOMBRE-webhook" --cwd "$CHECKOUT"
  pm2 save >/dev/null
else
  echo "    [dry-run] pm2 start webhook-runner.mjs --name $NOMBRE-webhook (INSTANCIA=$NOMBRE PUERTO_WEBHOOK=$PUERTO_WEBHOOK)"
fi

if [ "$DRY" = "1" ]; then
  echo "== Fin del dry-run: no se ejecuto nada ($avisos aviso(s)) =="
  exit 0
fi

echo "== Listo =="
echo "Webhook de GitHub (repo del cliente, Settings > Webhooks):"
echo "  URL:          https://$DOMINIO_API/webhook/deploy"
echo "  Content type: application/json"
echo "  Eventos:      push"
if [ "${WEBHOOK_NUEVO:-0}" = "1" ]; then
  echo "  Secreto:      el de /etc/$NOMBRE/webhook.env (WEBHOOK_SECRET), copiarlo una vez"
fi
echo "Verificar despues del primer despliegue:"
echo "  curl -s https://$DOMINIO_API/api/version"
echo "  curl -s https://$DOMINIO_WEB/api/version"
[ "$avisos" -gt 0 ] && echo "Avisos: $avisos (revisar arriba)."
exit 0
