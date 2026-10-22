import { computeOrderTotals } from '@odin6/types';

// El modelo de dinero de una orden vive en `@odin6/types` desde el 07/09/2026:
// la web tambien tiene que calcular igual, y desde aqui no lo alcanzaba. Se
// re-exporta para no tocar los ~10 sitios de la API que ya lo importaban.
export { computeOrderTotals };
export type { LineaDeOrden, TotalesDeOrden as OrderTotals } from '@odin6/types';

const round2 = (n: number): number => +n.toFixed(2);

export type DiscountType = 'PCT' | 'AMOUNT';

/** Descuento rechazado por regla de negocio (tope, valor invalido). */
export class DescuentoInvalidoError extends Error {}

/**
 * Traduce lo que tecleo el administrador (porcentaje o monto) a dolares, y
 * corta si pasa del tope. El tope se mide SIEMPRE como porcentaje de la linea,
 * tambien cuando se teclea un monto: si no, "$50" sobre una linea de $80 se
 * colaba por encima de un tope del 50%.
 */
export function calcularMontoDescuento(
  lineTotal: number,
  type: DiscountType,
  value: number,
  maxPct: number,
): number {
  if (!(lineTotal > 0)) {
    throw new DescuentoInvalidoError('La linea no tiene importe que descontar');
  }
  if (!(value > 0)) {
    throw new DescuentoInvalidoError('El descuento debe ser mayor a cero');
  }

  const monto = type === 'PCT' ? (lineTotal * value) / 100 : value;
  const pctEfectivo = (monto / lineTotal) * 100;

  if (pctEfectivo > maxPct + 1e-9) {
    throw new DescuentoInvalidoError(
      `El descuento no puede superar el ${maxPct}% de la linea`,
    );
  }
  return round2(monto);
}
