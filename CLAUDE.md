# CLAUDE.md

POS de restaurante **genérico y revendible**, sin marca propia. Nació como copia sin historial de
un POS de restaurante en producción (su código original sigue su propio camino) y se desplegará en un VPS compartido, como
instalación separada.

Monorepo con 4 apps:

| App | Ruta | Stack |
| --- | ---- | ----- |
| API | `apps/api/` | NestJS 10 + Mongoose + MongoDB + WebSockets |
| Web POS | `src/` (raíz) | Next.js 15, Tailwind v4, Zustand |
| Móvil | `mobile/` | React Native (Expo 54). Sus dependencias se instalan aparte: `pnpm install --ignore-workspace` |
| Print service | `print-service/` | Node + Express + ESC/POS, corre en la PC del local |

Tipos y reglas compartidas: `packages/types` (`@odin6/types`). Se compila con
`node_modules/.bin/tsc -p packages/types/tsconfig.json` (el `pnpm build:packages` falla en pnpm 11 por scripts sin aprobar).

## Lo primero que hay que leer

- `docs/contrato-config.md`: el contrato de configuración (nombre, tarifas, comisión, módulos…) y las reglas
  del dinero. Es la regla del repo: **ningún dato de un negocio vive en el código**.
- `docs/estado.md`: qué está hecho, probado y pendiente.

## Reglas

- `main` es la única rama larga. Commits `tipo(área): descripción en español`, con el porqué.
- `git add` selectivo por archivo. Nada de `git add -A` en trabajo de varios agentes, ni `git stash`.
- Un agente en un carril **no commitea** y no toca fuera de su carril; el coordinador revisa e integra.
- Sin `any` en TypeScript (`unknown` + guard). Sin colores crudos de Tailwind (tokens del design system).
- Versionado semver independiente por app (`package.json`); sube el último número en el mismo commit del cambio.
- Nunca commitear claves, `.env`, `.p8`, `google-services.json` ni dumps. Valores por defecto de secretos: vacíos.
- Ambientes en el VPS compartido: puertos `3201` (API), `3202` (web), `9092` (webhook); base `odin6`; PM2 `odin6-*`.
  No tocar nada de los demás procesos PM2 ni vhosts que ya existan en el VPS.

## Verificación

```bash
cd apps/api && npx jest                         # API
npx tsc --noEmit && npx eslint src              # web (línea base: 2 errores de logos, los quita el carril de marca)
node --experimental-strip-types --test "src/shared/**/*.test.ts" "src/features/**/*.test.ts" "src/app/private/pos/**/*.test.ts"
```

Toda prueba en navegador se graba en video (ver instrucciones globales del usuario).
