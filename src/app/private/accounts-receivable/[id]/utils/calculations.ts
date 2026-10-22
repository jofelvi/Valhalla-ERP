import { Order } from '@/modelTypes/order';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { Invoice, InvoiceItem } from '@/modelTypes/invoice';

export function calculateMergedOrder(orders: Order[]): Order | undefined {
  if (orders.length === 0) return undefined;
  if (orders.length === 1) return orders[0];

  return {
    ...orders[0],
    items: orders.flatMap((o) => o.items),
    subtotal: orders.reduce((s, o) => s + o.subtotal, 0),
    serviceCharge: orders.reduce((s, o) => s + (o.serviceCharge ?? 0), 0),
    tax: orders.reduce((s, o) => s + (o.tax ?? 0), 0),
    tipAmount: orders.reduce((s, o) => s + (o.tipAmount ?? 0), 0),
    total: orders.reduce((s, o) => s + o.total, 0),
  };
}

export function calculateBilledTotal(
  mergedOrder: Order | undefined,
  accountAmount: number,
): number {
  return mergedOrder?.total ?? accountAmount;
}

export function calculatePendingAmount(
  billedTotal: number,
  paidAmount: number,
): number {
  return billedTotal - paidAmount;
}

export function calculateIsOverdue(
  dueDate: Date,
  pendingAmount: number,
): boolean {
  return new Date(dueDate) < new Date() && pendingAmount > 0;
}

export function calculateProgressPercent(
  billedTotal: number,
  paidAmount: number,
): number {
  if (billedTotal <= 0) return 0;
  return Math.min(Math.round((paidAmount / billedTotal) * 100), 100);
}

export function buildFallbackInvoice(
  accountReceivable: AccountReceivable,
  mergedOrder: Order | undefined,
  billedTotal: number,
  invoiceItems: InvoiceItem[],
): Invoice {
  // Objeto sintetico para el PDF/WhatsApp: el original ya lo casteaba al tipo
  // de invoice de PDFDownloadButton porque no es una factura fiscal completa.
  const orders = mergedOrder
    ? Array.isArray(mergedOrder.items)
      ? [mergedOrder]
      : []
    : [];

  return {
    id: accountReceivable.id,
    invoiceNumber:
      orders.length > 1
        ? `${accountReceivable.invoiceNumber} (Consolidada ${orders.length} ords)`
        : accountReceivable.invoiceNumber,
    customerName: accountReceivable.customerName,
    customerId: accountReceivable.customerId,
    status: accountReceivable.status,
    items: invoiceItems,
    subtotal: mergedOrder?.subtotal ?? accountReceivable.amount,
    tax: mergedOrder?.tax ?? 0,
    tip: mergedOrder?.tipAmount ?? 0,
    total: billedTotal,
    paidAmount: accountReceivable.paidAmount,
    createdAt: accountReceivable.createdAt,
    dueDate: accountReceivable.dueDate,
  } as unknown as Invoice;
}
