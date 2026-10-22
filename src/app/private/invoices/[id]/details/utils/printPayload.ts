import { Invoice } from '@odin6/types';
import { Order } from '@odin6/types';
import { OrderStatusEnum, PaymentStatusEnum } from '@/shared';
import { OrderItem } from '@odin6/types';

/**
 * Construye un objeto Order válido a partir de una Invoice para impresión térmica.
 * La factura (Invoice) no tiene la misma forma que una Order: solo
 * printThermalReceipt/buildPrintPayload leen id/items/subtotal/tax/total/etc.,
 * así que se arma una Order válida con esos datos en vez de forzar
 * un cast que no aplica (Invoice no tiene userId/status/paymentStatus).
 */
export const buildOrderForPrint = (invoice: Invoice): Order => {
  const orderItems: OrderItem[] = (invoice.items || []).map((item) => ({
    productId: item.productId || '',
    name: item.name || item.description || '',
    unitPrice: item.unitPrice,
    total: item.total,
    quantity: item.quantity,
  }));

  return {
    id: invoice.id,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    userId: '',
    status: OrderStatusEnum.PAID,
    items: orderItems,
    subtotal: invoice.subtotal,
    serviceCharge: invoice.serviceCharge,
    tax: invoice.tax,
    total: invoice.total,
    // No se mapea la propina (inv.tip) al recibo reimpreso: el flujo actual
    // reimprime la factura SIN propina. Se preserva ese comportamiento; queda
    // pendiente decidir en F2/Dinero si el recibo debe incluirla.
    paymentStatus: PaymentStatusEnum.PAID,
    createdAt: invoice.createdAt,
  };
};
