/**
 * Contrato compartido: configuración del negocio y reglas de dinero.
 *
 * Fuente única: `packages/types/src` (raíz del monorepo). Aquí SOLO se reexporta por
 * ruta relativa; ninguna fórmula ni tipo se copia a `mobile/`. Así `computeOrderTotals`
 * y `calcularComision` son los mismos que usan la API y la web.
 *
 * Consecuencia de build: el móvil ya no es autocontenido. Metro debe vigilar
 * `packages/types/src` (ver `metro.config.js`) y EAS/robocopy deben subir la raíz del
 * monorepo, no solo `mobile/`. Si el build se hace desde una copia aislada de `mobile/`,
 * copiar también `packages/types/src` a la misma profundidad.
 */
export * from '../../../packages/types/src/config';
export * from '../../../packages/types/src/rules';
export * from '../../../packages/types/src/money';
