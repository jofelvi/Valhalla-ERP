import {
  computeOrderTotals,
  NOMINA_DEFAULT,
  TARIFAS_DEFAULT,
  TotalesDeOrden,
} from '@odin6/types';
import type { ConfigDeCalculo } from './config-de-orden.util';

/**
 * Logica de plata de la fusion de ordenes. Funciones puras: sin Mongoose,
 * sin Nest. Vive aparte del servicio para poder probarla sin mocks, porque
 * cada regla de aca es una forma concreta de perder dinero.
 */

export interface WaiterShareLike {
  waiterId: string;
  waiterName?: string;
  pct: number;
  comisionPagada?: boolean;
}

export interface OrdenFusionable {
  _id: unknown;
  waiterId?: string;
  waiterName?: string;
  items: Array<Record<string, unknown>>;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  tipAmount?: number;
  paidAmount?: number;
  paymentStatus?: string;
  status?: string;
  isDeleted?: boolean;
  customerId?: string;
  tableId?: string | null;
  waiterShares?: WaiterShareLike[];
  mergedIntoOrderId?: string;
  creditRequest?: { status?: string };
}

export interface ResultadoFusion {
  items: Array<Record<string, unknown>>;
  /** Totales de la orden fusionada, calculados con la configuración del destino. */
  totales: TotalesDeOrden;
  tipAmount: number;
  waiterShares: WaiterShareLike[];
  customerId?: string;
}

const redondear = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const tieneCobro = (o: OrdenFusionable): boolean =>
  (o.paidAmount ?? 0) > 0 ||
  ['paid', 'partially_paid'].includes(
    String(o.paymentStatus ?? '').toLowerCase(),
  );

const comisionYaPagada = (o: OrdenFusionable): boolean =>
  (o.waiterShares ?? []).some((s) => s.comisionPagada === true);

/**
 * Devuelve el motivo por el que NO se puede fusionar, o null si se puede.
 *
 * Todo se valida antes de escribir nada: una fusion a medias deja consumo
 * duplicado, que es peor que no fusionar.
 */
export function validarFusion(
  destino: OrdenFusionable,
  origen: OrdenFusionable,
): string | null {
  if (String(destino._id) === String(origen._id)) {
    return 'No se puede fusionar una orden con la misma orden.';
  }

  for (const [etiqueta, o] of [
    ['destino', destino],
    ['origen', origen],
  ] as const) {
    if (o.isDeleted) {
      return `La orden ${etiqueta} esta anulada.`;
    }
    if (String(o.status ?? '').toUpperCase() === 'CANCELLED') {
      return `La orden ${etiqueta} esta cancelada.`;
    }
    if (o.mergedIntoOrderId) {
      return `La orden ${etiqueta} ya fue fusionada en otra.`;
    }
    if (String(o.paymentStatus ?? '').toLowerCase() === 'paid') {
      return `La orden ${etiqueta} ya esta pagada.`;
    }
    if (tieneCobro(o)) {
      return `La orden ${etiqueta} tiene plata cobrada. Cobra el resto o anula el pago antes de fusionar.`;
    }
    // Si la comision ya entro en una corrida de nomina, mover los items hace
    // que el destino recalcule su 10% y ese consumo pague comision dos veces.
    if (comisionYaPagada(o)) {
      return `La orden ${etiqueta} ya tiene la comision pagada en nomina.`;
    }
    // La cuenta por cobrar le seguiria cobrando al cliente un consumo que
    // pasaria a facturarse en el destino.
    if (String(o.creditRequest?.status ?? '').toUpperCase() === 'APPROVED') {
      return `La orden ${etiqueta} ya tiene credito otorgado. Cobra o anula el credito antes de fusionar.`;
    }
  }

  if (
    destino.customerId &&
    origen.customerId &&
    destino.customerId !== origen.customerId
  ) {
    return 'Las dos ordenes tienen clientes distintos vinculados. Desvincula uno antes de fusionar.';
  }

  return null;
}

/**
 * Reparte la comision en proporcion a lo que aporto cada mesonero.
 *
 * Se trabaja en porcentaje porque es lo que guarda `waiterShares` y lo que lee
 * la nomina. El ultimo share absorbe el resto del redondeo: si los pct no
 * suman exactamente 100, alguien cobra de menos y nadie se entera.
 */
function repartirComision(
  destino: OrdenFusionable,
  origen: OrdenFusionable,
): WaiterShareLike[] {
  const mismoMesonero =
    destino.waiterId && origen.waiterId && destino.waiterId === origen.waiterId;
  const sinRepartoPrevio = (destino.waiterShares ?? []).length === 0;
  if (mismoMesonero && sinRepartoPrevio) return [];
  if (!destino.waiterId && !origen.waiterId) return [];

  const subDestino = Math.max(0, destino.subtotal ?? 0);
  const subOrigen = Math.max(0, origen.subtotal ?? 0);
  const suma = subDestino + subOrigen;

  // Sin consumo todavia, se reparte en partes iguales: es lo unico defendible.
  const pctDestino = suma > 0 ? (subDestino / suma) * 100 : 50;
  const pctOrigen = suma > 0 ? (subOrigen / suma) * 100 : 50;

  const acumulado = new Map<string, WaiterShareLike>();
  const sumar = (id: string, nombre: string | undefined, pct: number) => {
    const previo = acumulado.get(id);
    if (previo) previo.pct = redondear(previo.pct + pct);
    else
      acumulado.set(id, {
        waiterId: id,
        waiterName: nombre,
        pct: redondear(pct),
      });
  };

  // El destino puede venir con su propio reparto (transferencia de mesa): se
  // reescala dentro de la porcion que le toca ahora.
  const previos = destino.waiterShares ?? [];
  if (previos.length > 0) {
    previos.forEach((s) =>
      sumar(s.waiterId, s.waiterName, (s.pct / 100) * pctDestino),
    );
  } else if (destino.waiterId) {
    sumar(destino.waiterId, destino.waiterName, pctDestino);
  }

  if (origen.waiterId) {
    sumar(origen.waiterId, origen.waiterName, pctOrigen);
  }

  const shares = Array.from(acumulado.values());
  if (shares.length === 0) return [];

  // El resto del redondeo va al ultimo: los pct tienen que sumar 100 exacto.
  const total = shares.reduce((s, x) => s + x.pct, 0);
  const resto = redondear(100 - total);
  if (resto !== 0) {
    shares[shares.length - 1].pct = redondear(
      shares[shares.length - 1].pct + resto,
    );
  }

  return shares;
}

/**
 * Calcula como queda la orden destino despues de absorber al origen.
 *
 * Los items se copian VERBATIM (`{ ...item }`): reconstruirlos campo por campo
 * es lo que hace perder `inventoryConsumedQty` o `deliveredQty`, y ahi el
 * inventario se descuenta dos veces y la cocina reimprime.
 *
 * El dinero se recalcula sobre los items juntos, con la configuracion que el
 * destino guardo al nacer: fusionar no cambia las reglas de la cuenta.
 */
export function construirFusion(
  destino: OrdenFusionable,
  origen: OrdenFusionable,
  config: ConfigDeCalculo = {
    tarifas: TARIFAS_DEFAULT,
    nomina: NOMINA_DEFAULT,
  },
): ResultadoFusion {
  const items = [
    ...(destino.items ?? []).map((i) => ({ ...i })),
    ...(origen.items ?? []).map((i) => ({ ...i })),
  ];

  const tipAmount = redondear(
    (destino.tipAmount ?? 0) + (origen.tipAmount ?? 0),
  );

  const tieneMesonero = Boolean(destino.waiterId || origen.waiterId);
  const totales = computeOrderTotals(
    items,
    tieneMesonero,
    config.tarifas,
    config.nomina,
  );

  return {
    items,
    totales,
    tipAmount,
    waiterShares: repartirComision(destino, origen),
    customerId: destino.customerId ?? origen.customerId,
  };
}
