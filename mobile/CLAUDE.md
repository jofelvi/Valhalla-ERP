# CLAUDE.md — App móvil (`mobile/`)

App React Native (Expo 54) de un POS de restaurante. **No tiene nombre propio**: la identidad, las
tarifas, el vocabulario y la paleta llegan de la configuración del negocio. Léase antes:
`docs/contrato-config.md` (raíz del monorepo) y `packages/types/src/config/`.

## Reglas

- **Nada de un negocio en el código.** Nombre, RIF, teléfono, dominio, banco o ciudad salen de
  `negocio` / `marca` (`src/config/hooks.ts`). Los roles y las mesas, de `vocabulario` (`useVocab`).
- **Dinero: una sola fórmula.** Servicio, impuesto y totales pasan por `computeOrderTotals` (en
  `src/config/totalesDeOrden.ts`). Prohibido multiplicar por una tasa a mano (`* 0.1`). Una orden
  ya tomada muestra las tarifas que se guardaron en ella (`tarifasDeOrden`).
- **Colores solo por tokens.** `COLORS` / `useThemeColors` salen de `marca.palette`
  (`src/config/paleta.ts`). No poner colores crudos en las pantallas nuevas.
- **Arranque.** `index.ts` monta `ArranqueConfig`, que espera la configuración (caché, luego red con
  tope) y solo después carga `App`: la paleta se lee al cargar el módulo.
- **Claves de almacenamiento** con prefijo `pos:`.
- **Secretos y paquetes de Firebase no se versionan:** `google-services.json`, `.p8`, la llave de
  Play, `.env`. Ver `.gitignore`.

## Build por cliente

- Identidad del perfil: variables `APP_*` (`app.config.js`) y `EXPO_PUBLIC_*` en cada perfil de
  `eas.json`. Plantilla: `com.example.pos`, `https://api.example.com`. Ver `.env.example`.
- `APP_VARIANTE=pre` instala una variante de pruebas al lado de la de producción (sufijo `.pre`, sin FCM).
- Push: `scripts/check-push-config.mjs` detiene el build si falta `google-services.json` del cliente.
- Íconos de `assets/` son de plantilla: reemplazarlos por cliente.
- El build de EAS sube la raíz del monorepo: `src/shared/contrato.ts` importa `packages/types/src`.

## Comandos

```bash
pnpm install --ignore-workspace     # dependencias propias de mobile/
npx tsc --noEmit                    # tipos
npm test                            # pruebas de lógica pura (node --test + hook en scripts/)
```
