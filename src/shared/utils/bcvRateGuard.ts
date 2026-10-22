/**
 * Guardia de la tasa BCV: decide si un valor es una tasa REAL o una invención.
 *
 * Nació del incidente del 19/08/2026: la caja mostró "BCV: 50.00" con la tasa
 * real en 775,34, así que una cuenta de $195,80 aparecía como Bs 9.790 en vez
 * de Bs 151.806 — cobrar en bolívares ahí era cobrar el 6% de la cuenta.
 *
 * La causa no fue el número 50, sino que un FALLO se respondió como dato bueno
 * (`success: true`) y después se cacheó 30 min en el servidor y 24 h en el
 * navegador. Por eso la regla es una sola y se aplica en cada capa:
 * **una tasa inventada no es una tasa**. Si no hay tasa real, el sistema debe
 * decir que no la tiene y dejar que una persona la escriba, nunca rellenar el
 * hueco con un número.
 */

/**
 * Rango plausible de la tasa oficial en bolívares por dólar.
 *
 * El piso es lo que atrapa a los fantasmas del pasado: 36,5 y 50 fueron tasas
 * reales en su momento y hoy son basura que cobra de menos. El techo atrapa el
 * error de parseo que multiplica (leer "775335,6" por un separador decimal mal
 * interpretado). Se revisa cuando la inflación lo justifique.
 */
export const RANGO_TASA_PLAUSIBLE: readonly [number, number] = [100, 100_000];

/** Marcas de que la "fuente" es en realidad un relleno o un error. */
const FUENTES_NO_CONFIABLES = ['default', 'fallback', 'error', 'emergencia'];

export function esTasaConfiable(
  rate: number | null | undefined,
  source: string | null | undefined,
): boolean {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return false;

  const [min, max] = RANGO_TASA_PLAUSIBLE;
  if (rate < min || rate > max) return false;

  const fuente = String(source ?? '').toLowerCase();
  return !FUENTES_NO_CONFIABLES.some((marca) => fuente.includes(marca));
}
