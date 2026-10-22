import {
  computeOrderTotals,
  TarifasConfig,
  TotalesDeOrden,
} from '../shared/contrato';

/**
 * Totales de la app. Ningún cálculo de servicio o impuesto vive aquí: todo pasa por
 * `computeOrderTotals` (packages/types). Este módulo solo adapta los ítems del móvil.
 */

/** Lo mínimo de un ítem para sumarlo: `totalPrice`, o precio por cantidad si falta. */
export interface ItemParaTotal {
  totalPrice?: number | null;
  unitPrice?: number | null;
  quantity?: number | null;
  cancelledAt?: string | null;
}

const totalDeItem = (it: ItemParaTotal): number =>
  it.totalPrice ?? (it.unitPrice ?? 0) * (it.quantity ?? 0);

/** Totales de una orden a partir de sus ítems, con las tarifas que se le pasen. */
export function totalesDeOrden(
  items: ItemParaTotal[],
  tieneMesonero: boolean,
  tarifas: TarifasConfig,
): TotalesDeOrden {
  return computeOrderTotals(
    items.map((it) => ({
      total: totalDeItem(it),
      cancelledAt: it.cancelledAt,
    })),
    tieneMesonero,
    tarifas,
  );
}

/** Totales cuando solo se conoce el subtotal (carrito, o una orden sin líneas a mano). */
export function totalesDeSubtotal(
  subtotal: number,
  tieneMesonero: boolean,
  tarifas: TarifasConfig,
): TotalesDeOrden {
  return totalesDeOrden([{ totalPrice: subtotal }], tieneMesonero, tarifas);
}

/**
 * Porcentaje para etiquetas: 0.1 → "10", 0.125 → "12.5". Las etiquetas ("Servicio 10 %")
 * salen de la tarifa vigente y no de un literal.
 */
export const pctTexto = (tasa: number): string =>
  String(Math.round(tasa * 10000) / 100);
