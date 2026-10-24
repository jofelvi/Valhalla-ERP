import { pedidoCobrado } from './pedidoCobrado';

/** Por qué un pedido no admite productos nuevos aunque su estado lo permita. null = sí admite. */
export type MotivoNoAgregarProductos = 'cobrado' | 'rechazado' | null;

interface PedidoParaAgregar {
  paymentStatus?: string | null;
  paymentRejected?: boolean | null;
}

/**
 * Con COMANDA_AL_PAGAR el pedido ya cobrado (o con el pago rechazado) no recibe productos nuevos:
 * esos productos no tendrían cobro ni comanda. El rechazo gana sobre "cobrado" porque es lo que
 * hay que atender primero. Sin el modelo prepago no se bloquea nada por pago.
 */
export function motivoNoAgregarProductos(
  pedido: PedidoParaAgregar,
  comandaAlPagar: boolean,
): MotivoNoAgregarProductos {
  if (!comandaAlPagar) return null;
  if (pedido.paymentRejected === true) return 'rechazado';
  if (pedidoCobrado(pedido.paymentStatus)) return 'cobrado';
  return null;
}

/** Texto para el aviso en lugar del botón "Agregar productos". */
export function avisoNoAgregarProductos(
  motivo: MotivoNoAgregarProductos,
): string | null {
  if (motivo === 'cobrado') {
    return 'Este pedido ya está cobrado: para agregar productos crea un pedido nuevo';
  }
  if (motivo === 'rechazado') {
    return 'El pago fue rechazado: cóbralo de nuevo antes de agregar productos';
  }
  return null;
}
