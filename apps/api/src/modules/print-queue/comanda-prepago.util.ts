import { PaymentStatusEnum, OrderStatusEnum } from '@odin6/types';
import { ordenEstaCobrada } from '../orders/cobro-guardas.util';

/**
 * Prepago (`COMANDA_AL_PAGAR=true` en el entorno de la API): a cocina y barra no les sale nada
 * hasta que el pedido se cobra. La app ya lo respeta; esto lo hace cumplir en el servidor, para
 * que nadie imprima una comanda llamando directo a POST /api/print-queue.
 */
export function prepagoActivo(): boolean {
  return process.env.COMANDA_AL_PAGAR === 'true';
}

/** Lo minimo del pedido para decidir si su comanda puede salir. */
export interface PedidoParaComanda {
  paymentStatus?: unknown;
  status?: unknown;
  productos: string[];
}

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Devuelve por que NO puede salir la comanda, o null si puede. Mismo criterio de "cobrado" que la
 * app (`pedidoCobrado`): en verificacion, pagado o parcial. Cada producto de la comanda tiene que
 * estar en el pedido: si no, cualquiera imprimiria lo que quisiera colgado de un pedido pagado.
 */
export function motivoParaRechazarComanda(
  pedido: PedidoParaComanda | null,
  productosDeLaComanda: readonly string[],
): string | null {
  if (!pedido) {
    return 'La comanda no corresponde a ningún pedido: no se imprime.';
  }
  const cobrado =
    ordenEstaCobrada(pedido.paymentStatus, pedido.status) ||
    pedido.paymentStatus === PaymentStatusEnum.PARTIAL;
  if (!cobrado || pedido.status === OrderStatusEnum.CANCELLED) {
    return 'El pedido no está cobrado: la comanda sale cuando se cobra.';
  }
  const delPedido = new Set(pedido.productos.map(normalizar));
  const ajeno = productosDeLaComanda.find((p) => !delPedido.has(normalizar(p)));
  if (ajeno !== undefined) {
    return `"${ajeno}" no está en el pedido: no se imprime.`;
  }
  return null;
}
