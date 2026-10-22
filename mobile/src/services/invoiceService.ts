import { api } from './api/apiClient';
import { InvoiceItem, InvoiceStatusEnum, PaymentMethodEnum } from '../types';

interface RawInvoice {
  id?: string;
  _id?: string;
  invoiceNumber?: string;
}

export const invoiceService = {
  /**
   * Se mantiene por compat si algun screen lo usa; el backend genera su propio invoiceNumber
   * (via counter atomico en MongoDB). Si el mobile necesita pre-generar uno, se puede.
   */
  generateInvoiceNumber(orderId: string): string {
    const timestamp = Date.now();
    const suffix = orderId.slice(-6);
    return `FAC-${timestamp}-${suffix}`;
  },

  async createInvoice(params: {
    orderId: string;
    customerId?: string | null;
    customerName?: string | null;
    userId?: string;
    items: InvoiceItem[];
    subtotal: number;
    tax: number;
    total: number;
    status: InvoiceStatusEnum;
    paymentMethod?: PaymentMethodEnum;
    notes?: string | null;
    invoiceNumber?: string;
  }): Promise<string> {
    const payload = {
      invoiceNumber:
        params.invoiceNumber ?? this.generateInvoiceNumber(params.orderId),
      orderId: params.orderId,
      customerId: params.customerId ?? null,
      customerName: params.customerName ?? null,
      userId: params.userId ?? null,
      items: params.items,
      subtotal: params.subtotal,
      tax: params.tax,
      total: params.total,
      status: params.status,
      paymentMethod: params.paymentMethod ?? null,
      notes: params.notes ?? null,
    };

    const created = await api.post<RawInvoice>('/api/invoices', payload);
    return String(created.id ?? created._id ?? '');
  },
};
