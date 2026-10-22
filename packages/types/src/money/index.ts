/**
 * Dinero: LA fuente de verdad para todo el sistema (API, web POS y app movil).
 *
 * ─── Por que existe este archivo ──────────────────────────────────────────
 * Habia TRES implementaciones separadas de la misma conversion: una en el
 * backend, otra en `src/shared/utils/currencyHelpers.ts` y otra en
 * `mobile/src/services/bcvRateService.ts`. Cada cliente decidia por su cuenta
 * que era un dolar, y bastaba con que uno se equivocara para envenenar la
 * base: 603 pagos quedaron guardados en BOLIVARES dentro del campo que todo
 * el sistema lee como dolares, entre el 28/02 y el 30/07/2026. Sumar la
 * coleccion en crudo daba $7.834.282 cuando lo real eran $60.894.
 *
 * Mientras cada app tenga su propia copia de esta logica, el error vuelve por
 * la que se quede atras. Aca vive una sola.
 *
 * ─── La regla ─────────────────────────────────────────────────────────────
 * 1. El dinero se guarda SIEMPRE en dolares.
 * 2. Si hay bolivares y tasa, el dolar se DERIVA. No se pregunta ni se confia.
 * 3. Sin tasa no se inventa una conversion: se avisa (`convertible: false`) y
 *    el llamador decide, en vez de mandar un numero en la moneda equivocada.
 */

/** Metodos de pago que el cajero ingresa en bolivares. */
export const METODOS_EN_BOLIVARES = [
  'CASH_BS',
  'CARD',
  'PAGO_MOVIL',
  'PAGO_MOVIL_MANUAL',
] as const;

export type MetodoEnBolivares = (typeof METODOS_EN_BOLIVARES)[number];

export function seIngresaEnBolivares(method: string): boolean {
  return (METODOS_EN_BOLIVARES as readonly string[]).includes(method);
}

const redondear = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/** Bolivares a dolares. Devuelve 0 con una tasa invalida, nunca Infinity. */
export function bsToUsd(amountBs: number, rate: number): number {
  if (!(rate > 0)) return 0;
  return redondear(amountBs / rate);
}

/** Dolares a bolivares. Devuelve 0 con una tasa invalida. */
export function usdToBs(amountUsd: number, rate: number): number {
  if (!(rate > 0)) return 0;
  return redondear(amountUsd * rate);
}

export interface MontoDual {
  /** Lo que mando el cliente como USD. Se IGNORA si hay Bs + tasa. */
  amountUsd?: number | null;
  amountBs?: number | null;
  bcvRate?: number | null;
}

/**
 * USD canonico de una transaccion.
 *
 * Deriva de los bolivares siempre que se pueda y descarta el USD del cliente.
 * Un saneo anterior comparaba si USD == Bs para detectar el error; no
 * alcanzaba, porque un Bs mal convertido pasaba el filtro. Derivar siempre no
 * deja rendija.
 */
export function resolveUsdAmount({
  amountUsd,
  amountBs,
  bcvRate,
}: MontoDual): number {
  if (
    typeof amountBs === 'number' &&
    amountBs > 0 &&
    typeof bcvRate === 'number' &&
    bcvRate > 0
  ) {
    return redondear(amountBs / bcvRate);
  }
  return typeof amountUsd === 'number' && amountUsd > 0 ? amountUsd : 0;
}

export interface MontoParaEnviar {
  /** USD canonico. Solo confiable si `convertible` es true. */
  amountUsd: number;
  /** Monto en bolivares, para dejar rastro de lo que vio el cajero. */
  amountBs: number;
  /**
   * false = el metodo se cobra en bolivares y NO hay tasa. El llamador debe
   * frenar y pedir la tasa, no mandar el numero: mandarlo tal cual es
   * exactamente como se guardaron 603 pagos en la moneda equivocada.
   */
  convertible: boolean;
}

/**
 * Prepara un monto para mandarlo al servidor, desde lo que tecleo el cajero.
 *
 * `montoIngresado` viene en la moneda del metodo: bolivares para los de
 * `METODOS_EN_BOLIVARES`, dolares para el resto.
 */
export function prepararMonto(
  montoIngresado: number,
  method: string,
  bcvRate: number,
): MontoParaEnviar {
  const enBs = seIngresaEnBolivares(method);
  if (!enBs) {
    return {
      amountUsd: redondear(montoIngresado),
      amountBs: usdToBs(montoIngresado, bcvRate),
      convertible: true,
    };
  }
  if (!(bcvRate > 0)) {
    return {
      amountUsd: 0,
      amountBs: redondear(montoIngresado),
      convertible: false,
    };
  }
  return {
    amountUsd: bsToUsd(montoIngresado, bcvRate),
    amountBs: redondear(montoIngresado),
    convertible: true,
  };
}

/**
 * Cuantas veces puede un cobro superar el total de su orden antes de darlo
 * por imposible. La tasa BCV ronda los 700 Bs/$, asi que un monto en
 * bolivares aparece dos ordenes de magnitud por encima: 20x separa con
 * holgura un error de moneda de una propina generosa.
 */
export const MAX_FACTOR_SOBRE_TOTAL = 20;

/** Ultima red antes de escribir dinero: detecta un monto en otra moneda. */
export function pareceOtraMoneda(amount: number, orderTotal?: number): boolean {
  if (!orderTotal || orderTotal <= 0) return false;
  return amount / orderTotal > MAX_FACTOR_SOBRE_TOTAL;
}
