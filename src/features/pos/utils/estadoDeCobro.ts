import { PaymentStatusEnum } from '@odin6/types';

/**
 * Qué tiene cargado una orden abierta en cuanto a dinero. Se calcula con lo
 * que ya trae `/api/orders/pos-data`: el estado de pago y los pagos que el
 * mesonero reportó y la caja todavía no aprobó.
 *
 *  - `sin_pago`: nada reportado ni aprobado (la cuenta quedó sin recibo).
 *  - `por_verificar`: hay un pago reportado esperando a la caja.
 *  - `parcial`: hay abonos aprobados que no cubren el total.
 *  - `null`: pagada; no lleva etiqueta porque ya no aparece en la zona.
 */
export type EstadoDeCobro = 'sin_pago' | 'por_verificar' | 'parcial' | null;

export interface OrdenParaCobro {
  paymentStatus?: string | null;
  pendingPayments?: unknown[] | null;
  total?: number;
}

export function estadoDeCobro(orden: OrdenParaCobro): EstadoDeCobro {
  const estado = String(orden.paymentStatus ?? '').toLowerCase();
  if (estado === PaymentStatusEnum.PAID) return null;
  if (
    (orden.pendingPayments?.length ?? 0) > 0 ||
    estado === PaymentStatusEnum.PENDING_VERIFICATION
  ) {
    return 'por_verificar';
  }
  if (estado === PaymentStatusEnum.PARTIAL) return 'parcial';
  return 'sin_pago';
}

export const ETIQUETA_DE_COBRO: Record<
  Exclude<EstadoDeCobro, null>,
  { texto: string; variant: 'destructive' | 'warning' | 'info' }
> = {
  sin_pago: { texto: 'Sin pago', variant: 'destructive' },
  por_verificar: { texto: 'Por verificar', variant: 'warning' },
  parcial: { texto: 'Parcial', variant: 'info' },
};

export interface ResumenDeCobro {
  sinPago: { n: number; usd: number };
  porVerificar: { n: number; usd: number };
  parcial: { n: number; usd: number };
}

/** Cuántas órdenes y cuántos dólares hay en cada estado, para el resumen de arriba. */
export function resumenDeCobro(ordenes: OrdenParaCobro[]): ResumenDeCobro {
  const r: ResumenDeCobro = {
    sinPago: { n: 0, usd: 0 },
    porVerificar: { n: 0, usd: 0 },
    parcial: { n: 0, usd: 0 },
  };
  for (const o of ordenes) {
    const e = estadoDeCobro(o);
    if (!e) continue;
    const bolsa =
      e === 'sin_pago'
        ? r.sinPago
        : e === 'por_verificar'
          ? r.porVerificar
          : r.parcial;
    bolsa.n += 1;
    bolsa.usd = Math.round((bolsa.usd + (o.total ?? 0)) * 100) / 100;
  }
  return r;
}
