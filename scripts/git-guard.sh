#!/usr/bin/env bash
#
# git-guard.sh — chequeo previo a commitear o desplegar. Falla (exit 1) si:
#   - hay archivos de secretos versionados (.env, llaves, credenciales de apps);
#   - hay contenido con apariencia de secreto en archivos versionados;
#   - .gitignore tiene llaves {} (el scanner de Tailwind v4 las expande mal y
#     deja el CSS vacio: ver CLAUDE.md, seccion de despliegue);
#   - hay conflictos de merge sin resolver.
#
#   Uso:  bash scripts/git-guard.sh
#
# No es una politica de ramas: en este repo la rama de integracion es main.

set -u

RAIZ="$(git rev-parse --show-toplevel)"
cd "$RAIZ" || exit 1

fallos=0
mal() { echo "FALLA: $*"; fallos=$((fallos + 1)); }

# 1. Archivos de secretos versionados. Los .env.example son plantillas, no cuentan.
archivos_secretos=$(git ls-files | grep -E '(^|/)\.env(\..*)?$|\.p8$|\.jks$|\.keystore$|(^|/)google-services\.json$|GoogleService-Info\.plist$|(^|/)serviceAccountKey\.json$|\.pfx$|(^|/)caja/caja\.env$|(^|/)instancias/[^/]+\.env$' | grep -vE '\.env\.example$' || true)
if [ -n "$archivos_secretos" ]; then
  while IFS= read -r f; do mal "archivo de secretos versionado: $f"; done <<<"$archivos_secretos"
fi

# 2. Contenido con forma de secreto en lo versionado (no es un escaner completo:
#    solo atrapa los patrones mas obvios).
patrones='BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{10,}|sk_live_[0-9A-Za-z]{16,}'
while IFS= read -r linea; do
  mal "posible secreto en: $linea"
done < <(git grep -n -I -E "$patrones" -- ':!*.lock' ':!pnpm-lock.yaml' ':!package-lock.json' ':!scripts/git-guard.sh' 2>/dev/null | cut -c1-160 || true)

# 3. Llaves en .gitignore (ver CLAUDE.md: rompen el escaner de Tailwind).
if grep -n '[{}]' .gitignore >/dev/null 2>&1; then
  mal "llaves {} en .gitignore: usar una clase de caracteres ([{]) en su lugar"
  grep -n '[{}]' .gitignore
fi

# 4. Conflictos de merge sin resolver.
if git diff --name-only --diff-filter=U | grep -q .; then
  mal "conflictos de merge sin resolver:"
  git diff --name-only --diff-filter=U
fi

if [ "$fallos" -gt 0 ]; then
  echo "git-guard: $fallos problema(s). No commitear ni desplegar hasta corregirlos."
  exit 1
fi
echo "git-guard: OK"
