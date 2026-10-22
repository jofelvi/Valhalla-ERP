#!/usr/bin/env bash
#
# desplegar-servidor.sh — despliegue automatico de UNA instancia, EN EL VPS.
#
#   Uso:  bash desplegar-servidor.sh <instancia> [--todo]
#
# Lo lanza scripts/deploy/webhook-runner.mjs en cada push a la rama de la
# instancia (RAMA, por defecto main). A mano sirve igual; --todo recompila la
# API y la web aunque el diff no las toque.
#
# La configuracion no secreta sale de /etc/<instancia>/instancia.env (la deja
# nueva-instancia.sh). Los secretos viven en /etc/<instancia>/ y nunca en el
# repositorio.
#
# Como funciona:
#   Fase 1  candado de la instancia, `git reset` del checkout de compilacion a la
#           rama, y se relanza desde el archivo ya actualizado (sin esto bash
#           sigue leyendo la version vieja que tenia abierta).
#   Fase 2  decide QUE compilar mirando el diff contra lo ultimo desplegado de
#           cada parte (un cambio solo de otra carpeta no reinicia nada),
#           respalda Mongo si toca la API, compila en el checkout aparte (lo que
#           se sirve sigue intacto), instala, VERIFICA el artefacto servido y
#           revierte solo si no responde. Al final avisa por correo.
#   Bucle   si llego otro push mientras tanto, lo despliega tambien.
#
# La web se compila en una carpeta de release y se cambia un enlace simbolico al
# final: no hay ventana sin CSS al desplegar, y revertir es re-apuntar el enlace.
#
# OJO al cambiar ESTE archivo: el despliegue que lo trae arranca con la version
# que ya estaba en el servidor (la fase 1); solo la fase 2 corre la nueva.

set -Eeuo pipefail

INSTANCIA="${1:-}"
TODO="${2:-}"
if [ -z "$INSTANCIA" ]; then
  echo "Uso: desplegar-servidor.sh <instancia> [--todo]"
  exit 1
fi

ENV_INSTANCIA="/etc/$INSTANCIA/instancia.env"
if [ ! -f "$ENV_INSTANCIA" ]; then
  echo "Falta $ENV_INSTANCIA (lo deja scripts/instancia/nueva-instancia.sh)."
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_INSTANCIA"
set +a

# Lo que no viene en el env de la instancia toma el valor generico.
RAMA="${RAMA:-main}"
CSS_MINIMO_BYTES="${CSS_MINIMO_BYTES:-20000}"
CSS_MINIMO_UTILIDADES="${CSS_MINIMO_UTILIDADES:-20}"
CSS_CANARIO="${CSS_CANARIO:-flex}"
RUTA_VERIFICAR_WEB="${RUTA_VERIFICAR_WEB:-/}"
ETIQUETA="${ETIQUETA:-PRODUCCION}"
: "${PUERTO_API:?falta PUERTO_API en $ENV_INSTANCIA}"
: "${PUERTO_WEB:?falta PUERTO_WEB en $ENV_INSTANCIA}"
: "${BASE_MONGO:?falta BASE_MONGO en $ENV_INSTANCIA}"
: "${DOMINIO_WEB:?falta DOMINIO_WEB en $ENV_INSTANCIA}"

# Rutas y nombres de la instancia: todo cuelga de INSTANCIA, asi dos
# instancias en el mismo VPS no se pisan.
DIR_WWW="${DIR_BASE:-/var/www}"
CHECKOUT="$DIR_WWW/$INSTANCIA-build"
API_DIR="$DIR_WWW/$INSTANCIA-api"
PM2_API="$INSTANCIA-api"
PM2_WEB="$INSTANCIA-web"
WEB_RELEASES="$DIR_WWW/$INSTANCIA-web-releases"
WEB_ACTUAL="$DIR_WWW/$INSTANCIA-web-actual"
WEB_ENV="/etc/$INSTANCIA/web.env"
ESTADO="/var/lib/$INSTANCIA-deploy"
CANDADO="/var/lock/$INSTANCIA-deploy.lock"
# Un solo build a la vez en TODO el VPS (compartido por las instancias): la web
# pide varios GB de RAM y el servidor es uno.
CANDADO_BUILD="/var/lock/instancias-build.lock"
LOG="/var/log/$INSTANCIA-deploy.log"
RESPALDOS="/var/backups/$INSTANCIA-mongo"
URL_WEB="https://$DOMINIO_WEB"
SCRIPT="$CHECKOUT/scripts/deploy/desplegar-servidor.sh"

ahora() { date '+%F %T'; }
paso() { echo "[$(ahora)] $*"; }

# `grep -o | wc -l` y no `grep -c`: el CSS viene minificado en UNA linea.
contar_canario() { grep -o "$CSS_CANARIO" 2>/dev/null | wc -l || true; }

# ── Fase 1 ────────────────────────────────────────────────────────────────────
if [ "${DEPLOY_FASE:-1}" != "2" ]; then
  exec 200>"$CANDADO"
  if ! flock -n 200; then
    paso "[$INSTANCIA] ya hay un despliegue en curso: al terminar toma este push."
    exit 0
  fi
  paso "=== [$INSTANCIA] Iniciando despliegue ($ETIQUETA) ==="
  git -C "$CHECKOUT" fetch -q origin "$RAMA"
  git -C "$CHECKOUT" reset -q --hard "origin/$RAMA"
  git -C "$CHECKOUT" clean -fdq
  export DEPLOY_INICIO
  DEPLOY_INICIO=$(date +%s)
  DEPLOY_FASE=2 exec bash "$SCRIPT" "$INSTANCIA" "$TODO"
fi

# ── Fase 2 ────────────────────────────────────────────────────────────────────
# Hereda el candado de la fase 1 (el descriptor 200 sigue abierto con `exec`).
flock -n 200 2>/dev/null || { paso "La fase 2 no recibio el candado. Abortando."; exit 1; }
mkdir -p "$ESTADO" "$WEB_RELEASES" "$RESPALDOS"
cd "$CHECKOUT"

OBJETIVO=$(git rev-parse HEAD)
CORTO=$(git rev-parse --short HEAD)
STAMP=$(date +%Y%m%d-%H%M%S)
HECHO_API=0
HECHO_WEB=0
HACER_API=0
HACER_WEB=0
SALUD="—"
# Un solo aviso por despliegue: con `set -E` el trap de error tambien corre en
# las subshells, y una falla dentro de `( ... )` avisaba dos veces.
rm -f "$ESTADO/.avisado"

avisar() {
  local resultado="$1" detalle="${2:-}"
  [ -e "$ESTADO/.avisado" ] && return 0
  touch "$ESTADO/.avisado"
  printf '%s %s %s %s\n' "$OBJETIVO" "$resultado" "$(date -Is)" "$detalle" >"$ESTADO/ultimo"
  [ -f "$CHECKOUT/scripts/deploy/avisar-despliegue.mjs" ] || return 0
  INSTANCIA="$INSTANCIA" AVISO_AMBIENTE="$ETIQUETA" AVISO_URL="$URL_WEB" AVISO_RESULTADO="$resultado" \
    AVISO_DESDE="${DESDE:-}" AVISO_HASTA="$OBJETIVO" AVISO_INICIO="${DEPLOY_INICIO:-}" \
    AVISO_PARTES="$(partes_texto)" AVISO_SALUD="$SALUD" AVISO_DETALLE="$detalle" \
    AVISO_LOG="$LOG" AVISO_REPO="$CHECKOUT" AVISO_MARCA="${MARCA:-$INSTANCIA}" \
    node "$CHECKOUT/scripts/deploy/avisar-despliegue.mjs" || true
}

partes_texto() {
  local p=""
  [ "$HACER_API" = "1" ] && p="API"
  [ "$HACER_WEB" = "1" ] && p="${p:+$p y }web"
  echo "${p:-nada (solo cambios fuera de la API y la web)}"
}

trap 'rc=$?; paso "ERROR: fallo la linea $LINENO (salida $rc): $BASH_COMMAND"; avisar FALLIDO "Linea $LINENO (salida $rc): $BASH_COMMAND"' ERR

# Lo ultimo desplegado de cada parte. Sin registro, o si el sha ya no existe
# (historia reescrita), se compila todo.
toca() {
  local previo="$1" filtro="$2"
  [ -n "$previo" ] && git cat-file -e "$previo^{commit}" 2>/dev/null || return 0
  [ -n "$(git diff --name-only "$previo" "$OBJETIVO" | grep -E "$filtro" || true)" ]
}
API_PREVIO=$(cat "$ESTADO/api.sha" 2>/dev/null || true)
WEB_PREVIO=$(cat "$ESTADO/web.sha" 2>/dev/null || true)
DESDE="${WEB_PREVIO:-$API_PREVIO}"

if [ "$TODO" = "--todo" ]; then
  HACER_API=1
  HACER_WEB=1
else
  # La API depende de su carpeta, del paquete de tipos compartido y del lockfile.
  toca "$API_PREVIO" '^(apps/api/|packages/types/|pnpm-lock\.yaml$)' && HACER_API=1
  # La web es la raiz: todo lo que NO sea de otra app ni documentacion.
  toca "$WEB_PREVIO" '^([^/]+$|src/|public/|packages/types/)' && HACER_WEB=1
  # ...salvo los .md sueltos de la raiz, que no entran al build.
  if [ "$HACER_WEB" = "1" ] && [ -n "$WEB_PREVIO" ] && git cat-file -e "$WEB_PREVIO^{commit}" 2>/dev/null; then
    [ -z "$(git diff --name-only "$WEB_PREVIO" "$OBJETIVO" | grep -E '^([^/]+$|src/|public/|packages/types/)' | grep -vE '^[^/]+\.md$' || true)" ] && HACER_WEB=0
  fi
fi

paso "[$INSTANCIA] $CORTO · $(git log -1 --format=%s) · compila: $(partes_texto)"

if [ "$HACER_API" = "0" ] && [ "$HACER_WEB" = "0" ]; then
  echo "$OBJETIVO" >"$ESTADO/api.sha"
  echo "$OBJETIVO" >"$ESTADO/web.sha"
  printf '%s %s %s %s\n' "$OBJETIVO" SIN_CAMBIOS "$(date -Is)" "" >"$ESTADO/ultimo"
  paso "Nada que compilar: el commit no toca la API ni la web."
else
  # ── Respaldo ──────────────────────────────────────────────────────────────
  if [ "$HACER_API" = "1" ]; then
    paso "Respaldo de Mongo ($BASE_MONGO)"
    mongodump --quiet --db "$BASE_MONGO" --gzip --archive="$RESPALDOS/auto-deploy-$STAMP.archive.gz"
    ls -1t "$RESPALDOS"/auto-deploy-*.archive.gz | tail -n +6 | xargs -r rm -f
  fi

  # ── Compilar (en el checkout; lo que se sirve no se toca) ─────────────────
  exec 201>"$CANDADO_BUILD"
  paso "Esperando el turno de compilacion"
  flock 201
  paso "pnpm install"
  pnpm install --frozen-lockfile --prefer-offline 2>&1 | tail -3
  TIPOS_NOMBRE=$(node -p "require('./packages/types/package.json').name")
  paso "$TIPOS_NOMBRE"
  rm -rf packages/types/dist
  (cd packages/types && npx tsc -p tsconfig.json)

  if [ "$HACER_API" = "1" ]; then
    paso "API: compilar"
    rm -rf apps/api/dist
    (cd apps/api && API_COMMIT_SHA="$CORTO" node scripts/gen-version.mjs && npx nest build)
    test -f apps/api/dist/main.js
    grep -q "COMMIT_SHA = '$CORTO'" apps/api/src/version.generated.ts
  fi

  if [ "$HACER_WEB" = "1" ]; then
    paso "Web: compilar"
    # NEXT_PUBLIC_* se hornea en el build: el env va ANTES.
    cp "$WEB_ENV" .env.production
    cp "$WEB_ENV" .env
    rm -rf .next
    NEXT_PUBLIC_COMMIT_SHA="$CORTO" pnpm exec next build 2>&1 | tail -5
    # El artefacto, no el proceso: un build en verde puede emitir un CSS vacio.
    css=$(find .next/static -name '*.css' -printf '%s %p\n' | sort -rn | head -1)
    css_bytes=${css%% *}
    utilidades=$(contar_canario <"${css#* }")
    paso "Web: CSS emitido $css_bytes bytes, $utilidades veces '$CSS_CANARIO'"
    if [ "${css_bytes:-0}" -lt "$CSS_MINIMO_BYTES" ] || [ "$utilidades" -lt "$CSS_MINIMO_UTILIDADES" ]; then
      trap - ERR
      avisar FALLIDO "Tailwind emitio un CSS vacio ($css_bytes bytes, $utilidades utilidades). No se instalo nada."
      exit 1
    fi
  fi
  flock -u 201

  # ── Instalar la API ───────────────────────────────────────────────────────
  # Copia real del paquete de tipos que resuelve el runtime de la API: pnpm la
  # COPIA (no la enlaza), asi que un dist nuevo con una copia vieja calcula
  # distinto o no arranca. Se refresca en cada despliegue de la API.
  TYPES_COPY="$API_DIR/node_modules/.pnpm/${TIPOS_NOMBRE/\//+}@file+packages+types/node_modules/$TIPOS_NOMBRE"

  api_sana() {
    local estado sha i
    for i in $(seq 1 30); do
      estado=$(pm2 jlist | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='$PM2_API');console.log(p?p.pm2_env.status:'missing')})")
      sha=$(curl -s --max-time 5 "http://127.0.0.1:$PUERTO_API/api/version" | grep -o '"sha":"[^"]*"' | cut -d'"' -f4 || true)
      [ "$estado" = "online" ] && [ "$sha" = "$1" ] && return 0
      [ "$estado" = "errored" ] && return 1
      sleep 3
    done
    return 1
  }

  # Primera vez: el proceso de la API aun no existe en PM2 y se crea desde el dist.
  pm2_reiniciar_api() {
    if pm2 describe "$PM2_API" >/dev/null 2>&1; then
      pm2 restart "$PM2_API" >/dev/null
    else
      PORT="$PUERTO_API" pm2 start "$API_DIR/dist/main.js" --name "$PM2_API" --cwd "$API_DIR" >/dev/null
    fi
    pm2 save >/dev/null
  }

  if [ "$HACER_API" = "1" ]; then
    paso "API: instalar"
    if [ ! -f "$API_DIR/package.json" ]; then
      # Primera instalacion de la instancia: la carpeta de la API esta vacia. Se deja lista para que
      # el flujo normal (que reemplaza dist y la copia de los tipos) funcione igual que en los demas.
      paso "API: primera instalacion, armando $API_DIR"
      mkdir -p "$API_DIR/packages/types" "$API_DIR/dist"
      cp -a packages/types/dist packages/types/package.json "$API_DIR/packages/types/"
      sed "s#\"$TIPOS_NOMBRE\": *\"workspace:\*\"#\"$TIPOS_NOMBRE\": \"file:./packages/types\"#" \
        apps/api/package.json >"$API_DIR/package.json"
      (cd "$API_DIR" && pnpm install --prod --prefer-offline 2>&1 | tail -3)
    fi
    test -d "$TYPES_COPY"
    anterior_api=$(curl -s --max-time 5 "http://127.0.0.1:$PUERTO_API/api/version" | grep -o '"sha":"[^"]*"' | cut -d'"' -f4 || true)
    # El runtime de la API se instala con `file:` en vez de `workspace:*`.
    tmp_pkg="$ESTADO/api-package-$STAMP.json"
    sed "s#\"$TIPOS_NOMBRE\": *\"workspace:\*\"#\"$TIPOS_NOMBRE\": \"file:./packages/types\"#" \
      apps/api/package.json >"$tmp_pkg"
    deps_cambiaron=0
    if ! diff -q "$tmp_pkg" "$API_DIR/package.json" >/dev/null; then
      deps_cambiaron=1
      cp "$API_DIR/package.json" "$API_DIR/package.json.bak-$STAMP"
      cp "$tmp_pkg" "$API_DIR/package.json"
      paso "API: package.json cambio, pnpm install --prod"
      (cd "$API_DIR" && pnpm install --prod --prefer-offline 2>&1 | tail -3)
    fi
    rm -f "$tmp_pkg"

    rm -rf "$API_DIR/dist.auto-anterior"
    mv "$API_DIR/dist" "$API_DIR/dist.auto-anterior"
    cp -a apps/api/dist "$API_DIR/dist"
    rm -rf "$TYPES_COPY/dist.auto-anterior"
    mv "$TYPES_COPY/dist" "$TYPES_COPY/dist.auto-anterior"
    cp -a packages/types/dist "$TYPES_COPY/dist"
    cp packages/types/package.json "$TYPES_COPY/package.json"
    rm -rf "$API_DIR/packages/types/dist"
    cp -a packages/types/dist "$API_DIR/packages/types/dist"
    pm2_reiniciar_api

    if api_sana "$CORTO"; then
      paso "API: sana, sirve $CORTO"
      HECHO_API=1
      echo "$OBJETIVO" >"$ESTADO/api.sha"
      rm -rf "$TYPES_COPY/dist.auto-anterior"
    else
      paso "API: NO responde con $CORTO. Revirtiendo a ${anterior_api:-la anterior}."
      pm2 logs "$PM2_API" --err --lines 25 --nostream 2>&1 | tail -25
      rm -rf "$API_DIR/dist" "$TYPES_COPY/dist"
      mv "$API_DIR/dist.auto-anterior" "$API_DIR/dist"
      mv "$TYPES_COPY/dist.auto-anterior" "$TYPES_COPY/dist"
      if [ "$deps_cambiaron" = "1" ]; then
        cp "$API_DIR/package.json.bak-$STAMP" "$API_DIR/package.json"
        (cd "$API_DIR" && pnpm install --prod --prefer-offline 2>&1 | tail -3)
      fi
      pm2_reiniciar_api
      trap - ERR
      if api_sana "$anterior_api"; then
        SALUD="API revertida a $anterior_api y en linea"
        avisar REVERTIDO "La API $CORTO no respondio. Se volvio a $anterior_api. La web no se toco."
      else
        SALUD="API caida tras revertir"
        avisar FALLIDO "La API $CORTO no respondio y TAMPOCO tras volver a $anterior_api. Revisar a mano."
      fi
      exit 1
    fi
  fi

  # ── Instalar la web ───────────────────────────────────────────────────────
  web_sana() {
    local sha html hojas u cuerpo total=0 utilidades=0 i
    for i in $(seq 1 30); do
      sha=$(curl -s --max-time 5 "http://127.0.0.1:$PUERTO_WEB/api/version" | grep -o '"sha":"[^"]*"' | cut -d'"' -f4 || true)
      [ "$sha" = "$1" ] && break
      sleep 3
    done
    [ "$sha" = "$1" ] || return 1
    # Que sirva el sha no prueba que la pantalla se vea: se sigue el CSS que
    # enlaza una pagina real y se mide lo que trae.
    html=$(curl -s --max-time 20 "http://127.0.0.1:$PUERTO_WEB$RUTA_VERIFICAR_WEB" || true)
    hojas=$(printf '%s' "$html" | grep -o '/_next/static/[^"]*\.css' | sort -u || true)
    for u in $hojas; do
      cuerpo=$(curl -s --max-time 20 "http://127.0.0.1:$PUERTO_WEB$u" || true)
      total=$((total + $(printf '%s' "$cuerpo" | wc -c)))
      utilidades=$((utilidades + $(printf '%s' "$cuerpo" | contar_canario)))
    done
    paso "Web: CSS servido $total bytes, $utilidades veces '$CSS_CANARIO'"
    [ "$total" -ge "$CSS_MINIMO_BYTES" ] && [ "$utilidades" -ge "$CSS_MINIMO_UTILIDADES" ]
  }

  apuntar_web() {
    ln -sfn "$1" "$WEB_ACTUAL.nuevo"
    mv -T "$WEB_ACTUAL.nuevo" "$WEB_ACTUAL"
    local ruta
    ruta=$(pm2 jlist | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='$PM2_WEB');console.log(p?p.pm2_env.pm_exec_path:'')})")
    # Sin --update-env y sin exportar nada en este shell: PM2 conserva el env
    # guardado de cada proceso (un export aqui se heredaria al siguiente restart).
    if [ "$ruta" = "$WEB_ACTUAL/server.js" ]; then
      pm2 reload "$PM2_WEB" >/dev/null
    else
      # Primera vez: el proceso venia del directorio viejo compilado en su lugar.
      pm2 delete "$PM2_WEB" >/dev/null 2>&1 || true
      PORT="$PUERTO_WEB" HOSTNAME="${BIND_WEB:-127.0.0.1}" NODE_ENV=production \
        pm2 start "$WEB_ACTUAL/server.js" --name "$PM2_WEB" --cwd "$WEB_ACTUAL" >/dev/null
    fi
    pm2 save >/dev/null
  }

  if [ "$HACER_WEB" = "1" ]; then
    paso "Web: armar release"
    release="$WEB_RELEASES/$STAMP-$CORTO"
    cp -a .next/standalone "$release"
    mkdir -p "$release/.next"
    cp -a .next/static "$release/.next/static"
    cp -a public "$release/public"
    cp "$WEB_ENV" "$release/.env.production"
    cp "$WEB_ENV" "$release/.env"
    anterior_web=$(readlink -f "$WEB_ACTUAL" 2>/dev/null || true)
    anterior_web_sha=$(curl -s --max-time 5 "http://127.0.0.1:$PUERTO_WEB/api/version" | grep -o '"sha":"[^"]*"' | cut -d'"' -f4 || true)
    apuntar_web "$release"

    if web_sana "$CORTO"; then
      paso "Web: sana, sirve $CORTO"
      HECHO_WEB=1
      echo "$OBJETIVO" >"$ESTADO/web.sha"
      # Se guardan las 4 ultimas releases para volver atras a mano.
      ls -1dt "$WEB_RELEASES"/*/ | tail -n +5 | xargs -r rm -rf
    else
      trap - ERR
      if [ -n "$anterior_web" ] && [ -d "$anterior_web" ]; then
        paso "Web: NO sana con $CORTO. Volviendo a $anterior_web"
        apuntar_web "$anterior_web"
        if web_sana "$anterior_web_sha"; then
          SALUD="web revertida a $anterior_web_sha y en linea"
          avisar REVERTIDO "La web $CORTO no paso la verificacion (sha o CSS). Se volvio a $anterior_web_sha."
        else
          SALUD="web caida tras revertir"
          avisar FALLIDO "La web $CORTO no paso la verificacion y TAMPOCO tras volver a $anterior_web_sha."
        fi
      else
        SALUD="web sin release anterior a la cual volver"
        avisar FALLIDO "La web $CORTO no paso la verificacion y no hay release anterior. Revisar a mano."
      fi
      exit 1
    fi
  fi

  [ "$HACER_API" = "0" ] && echo "$OBJETIVO" >"$ESTADO/api.sha"
  [ "$HACER_WEB" = "0" ] && echo "$OBJETIVO" >"$ESTADO/web.sha"

  SALUD="API $([ "$HECHO_API" = "1" ] && echo "sirve $CORTO" || echo "sin cambios") · web $([ "$HECHO_WEB" = "1" ] && echo "sirve $CORTO con CSS" || echo "sin cambios")"
  paso "=== [$INSTANCIA] Despliegue EXITOSO: $CORTO ($SALUD) ==="
  avisar EXITOSO
fi

# ── Bucle: si llego otro push mientras tanto, desplegarlo tambien ─────────────
trap - ERR
git fetch -q origin "$RAMA"
if [ "$(git rev-parse "origin/$RAMA")" != "$OBJETIVO" ]; then
  paso "Llego otro push a $RAMA durante el despliegue: sigo con ese."
  git reset -q --hard "origin/$RAMA"
  git clean -fdq
  export DEPLOY_INICIO
  DEPLOY_INICIO=$(date +%s)
  exec bash "$SCRIPT" "$INSTANCIA"
fi
