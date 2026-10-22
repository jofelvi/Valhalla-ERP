/**
 * El dinero del backend sale de `@odin6/types`, que es la fuente unica que
 * comparten API, web POS y app movil (ver packages/types/src/money).
 *
 * Este archivo queda como puerta del backend para no tocar los imports
 * existentes, pero NO define matematica propia: tener tres implementaciones
 * de la misma conversion fue justamente lo que dejo 603 pagos guardados en
 * bolivares dentro del campo de dolares.
 */
export {
  bsToUsd,
  usdToBs,
  resolveUsdAmount,
  prepararMonto,
  pareceOtraMoneda,
  seIngresaEnBolivares,
  MAX_FACTOR_SOBRE_TOTAL,
  METODOS_EN_BOLIVARES,
} from '@odin6/types';
export type { MontoDual, MontoParaEnviar } from '@odin6/types';
