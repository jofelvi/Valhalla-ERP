import { api } from '@/services/api/apiClient';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { Order } from '@/modelTypes/order';
import { Invoice } from '@/modelTypes/invoice';
import { CurrencyEnum, PaymentTypeEnum } from '@/shared';
import { buildConsolidatedInvoiceItems } from './consolidatedInvoiceItems';

// Dado un accountReceivable (consolidado o no), hace los fetches necesarios
// y construye un invoice listo para pasar a generateInvoicePDF. Para consolidados
// agrega items de todas las ordenes fusionadas con section headers (quantity: -1
// que pdfGenerator renderiza con colspan). Si hay abono, cada item trae su
// paidStatus (reparto FIFO) — ver consolidatedInvoiceItems.ts.
export async function buildInvoiceForPdf(account: AccountReceivable) {
  const orderIds: string[] =
    account.isConsolidated && account.mergedOrderIds?.length
      ? account.mergedOrderIds.filter(Boolean)
      : account.orderId
        ? [account.orderId]
        : [];

  const orderResults = await Promise.all(
    orderIds.map((oid) =>
      api.get<Order>(`/api/orders/${oid}`).catch(() => null),
    ),
  );
  const orders = orderResults.filter((o): o is Order => !!o);

  const mergedOrder =
    orders.length > 1
      ? {
          ...orders[0],
          items: orders.flatMap((o) => o.items),
          subtotal: orders.reduce((s, o) => s + o.subtotal, 0),
          serviceCharge: orders.reduce((s, o) => s + (o.serviceCharge ?? 0), 0),
          tax: orders.reduce((s, o) => s + (o.tax ?? 0), 0),
          tipAmount: orders.reduce((s, o) => s + (o.tipAmount ?? 0), 0),
          total: orders.reduce((s, o) => s + o.total, 0),
        }
      : orders[0];

  // Items + reparto FIFO del abono (fecha/hora en el encabezado de cada orden)
  const invoiceItems = buildConsolidatedInvoiceItems(
    orders,
    account.paidAmount ?? 0,
  );

  const invoiceNumber =
    orders.length > 1
      ? `${account.invoiceNumber} (Consolidada ${orders.length} ords)`
      : account.invoiceNumber;

  const invoice: Invoice = {
    id: account.id,
    invoiceNumber,
    customerName: account.customerName,
    customerId: account.customerId,
    status: account.status,
    items: invoiceItems,
    // El desglose sale de las ordenes (fuente de verdad), NO de account.amount:
    // asi subtotal y total comparten origen y el "Servicio (10%)" es el residuo
    // real (total - subtotal), no un numero inflado por un amount desfasado.
    subtotal: mergedOrder?.subtotal ?? account.amount,
    serviceCharge: mergedOrder?.serviceCharge ?? 0,
    tax: mergedOrder?.tax ?? 0,
    tip: mergedOrder?.tipAmount ?? 0,
    total: mergedOrder?.total ?? account.amount,
    paymentType: PaymentTypeEnum.CASH,
    currency: CurrencyEnum.USD,
    // Abonos ya registrados: el PDF muestra "Abonado" y el saldo pendiente
    paidAmount: account.paidAmount,
    createdAt: account.createdAt,
    dueDate: account.dueDate,
    totalAmount: mergedOrder?.total ?? account.amount,
  };

  return { invoice, orders, isConsolidated: orders.length > 1 };
}
