import { Order } from '@/modelTypes/order';
import { InvoiceItem } from '@/modelTypes/invoice';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';

/**
 * Armado de los items del PDF de una cuenta por cobrar (una o varias ordenes).
 *
 * Dos cosas que pide el negocio y viven aca para no duplicarlas entre el boton
 * de descarga y el envio por WhatsApp:
 *  1. Encabezado de cada pedido con FECHA + HORA (24h) — el cliente ubica cuando
 *     consumio.
 *  2. Si hay abono, marcar que items ya estan pagados. El abono NO se guarda por
 *     item (solo el total en paidAmount), asi que se reparte FIFO: se cubren las
 *     ordenes mas antiguas primero, item por item, hasta agotar el abono. El
 *     item donde se corta queda "partial"; el resto "pending". Asi el cliente ve
 *     "esto ya lo pague" y no cree que le recobran lo mismo.
 */

export type ItemPaidStatus = 'paid' | 'partial' | 'pending';

const EPS = 0.001;

/** "07 de marzo de 2026 · 14:30" (hora 24h, zona es-VE) */
export function formatOrderDateTime(d: Date | string): string {
  const date = new Date(d);
  const day = date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} · ${time}`;
}

/**
 * Construye la lista plana de items para el PDF. Las filas con `quantity === -1`
 * son encabezados de seccion (una por orden) que el pdfGenerator pinta con
 * colspan. Cuando `paidAmount > 0` cada item real trae su `paidStatus` y el
 * monto cubierto en `paidPortion`.
 *
 * @param orders     ordenes de la cuenta (se ordenan por fecha ascendente aca)
 * @param paidAmount total abonado a la cuenta (se reparte FIFO)
 */
export function buildConsolidatedInvoiceItems(
  orders: Order[],
  paidAmount = 0,
): InvoiceItem[] {
  if (orders.length === 0) return [];

  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const multi = sorted.length > 1;
  let remaining = Math.max(0, paidAmount || 0);
  const hasAbono = remaining > EPS;
  const rows: InvoiceItem[] = [];

  for (const order of sorted) {
    // Encabezado de pedido solo cuando hay varias ordenes (consolidada)
    if (multi) {
      const displayNumber = getDisplayOrderNumber(order);
      const when = formatOrderDateTime(order.createdAt);
      const alias = order.customerAlias?.trim();
      rows.push({
        description: alias
          ? `Factura ${displayNumber}  ·  ${when}  ·  Cliente: ${alias}`
          : `Factura ${displayNumber}  ·  ${when}`,
        quantity: -1,
        unitPrice: 0,
        total: 0,
      });
    }

    for (const item of order.items) {
      const total = item.total || 0;
      let paidStatus: ItemPaidStatus = 'pending';
      let paidPortion = 0;

      if (hasAbono) {
        if (remaining >= total - EPS) {
          paidStatus = 'paid';
          paidPortion = total;
          remaining -= total;
        } else if (remaining > EPS) {
          paidStatus = 'partial';
          paidPortion = Math.round(remaining * 100) / 100;
          remaining = 0;
        }
      }

      rows.push({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total,
        ...(hasAbono ? { paidStatus, paidPortion } : {}),
      });
    }
  }

  return rows;
}
