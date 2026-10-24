import type { PushMessage } from './push-message';

/**
 * Texto aviso al mesonero: el banco confirmo el Pago Movil de su orden. Funcion
 * pura (sin Mongo ni FCM) para poder probar el armado sin red.
 */
export interface PagoMovilConfirmadoContext {
  orderId: string;
  /** Monto USD verificado por el banco en este flush. */
  amountUsd: number;
}

export function buildPagoMovilConfirmedMessage(
  ctx: PagoMovilConfirmadoContext,
): PushMessage {
  // Mismo recorte que las comandas: los ultimos 8 caracteres, en mayusculas.
  const numero = ctx.orderId.slice(-8).toUpperCase();
  return {
    title: 'Pago movil confirmado',
    body: `Orden #${numero} · $${ctx.amountUsd.toFixed(2)} verificado en el banco`,
  };
}
