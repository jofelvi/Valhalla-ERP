/**
 * Comanda al cobrar. Con `COMANDA_AL_PAGAR` encendida, crear un pedido no imprime nada: la comanda
 * y la ficha de barra salen cuando el pedido se cobra. Este es el unico punto que las encola.
 */
import { orderService } from './orderService';
import { printQueueService, enqueuePrintFicha } from './printQueueService';

export { pedidoCobrado } from './pedidoCobrado';

/**
 * Encola la comanda con lo que aun no se imprimio (cantidad - printedQty) y la ficha de barra.
 * Fire-and-forget en quien la llama: un fallo de impresion no debe frenar el cobro.
 */
export async function enviarComandaDeOrden(
  orderId: string,
  opts?: { waiterName?: string | null; cajaSummary?: boolean },
): Promise<void> {
  const order = await orderService.getOrderById(orderId);
  if (!order) return;

  const pendientes = (order.items ?? [])
    .filter((it) => !it.cancelledAt)
    .map((it) => ({
      ...it,
      quantity: it.quantity - (it.printedQty ?? 0),
    }))
    .filter((it) => it.quantity > 0);

  await printQueueService.enqueuePrintComanda(
    {
      id: order.id,
      tableId: order.tableId ?? null,
      tableName: order.tableName ?? null,
      sector: order.sector ?? null,
      orderType: order.orderType ?? null,
      notes: order.notes ?? null,
    },
    pendientes,
    {
      waiterName: opts?.waiterName ?? order.waiterName ?? undefined,
      cajaSummary: opts?.cajaSummary,
    },
  );

  enqueuePrintFicha(order.id, {
    waiterName: opts?.waiterName ?? order.waiterName ?? undefined,
  }).catch(() => {});
}
