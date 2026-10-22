import { api } from './api/apiClient';
import { toSafeDate } from './dateUtils';
import { Payment, PaymentMethodEnum } from '../types';

// Id de idempotencia por intento de pago. Similar a orderService.genClientRequestId.
// Se genera UNA vez por intento de cobro y se reutiliza en reintentos por timeout/red.
export const genPaymentRequestId = (): string =>
  `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

interface RawPayment {
  id?: string;
  _id?: string;
  invoiceId: string;
  orderId: string;
  userId?: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  reference?: string | null;
  notes?: string | null;
  bcvRate?: number;
  expectedAmountBS?: number;
  createdAt?: string;
}

function normalize(raw: RawPayment): Payment {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    invoiceId: raw.invoiceId,
    orderId: raw.orderId,
    userId: raw.userId,
    amount: raw.amount,
    paymentMethod: raw.paymentMethod,
    reference: raw.reference ?? null,
    notes: raw.notes ?? null,
    createdAt: toSafeDate(raw.createdAt),
  };
}

export const paymentService = {
  async createPayment(params: {
    invoiceId: string;
    orderId: string;
    userId?: string;
    amount: number;
    paymentMethod: PaymentMethodEnum;
    reference?: string | null;
    notes?: string | null;
    bcvRate?: number;
    expectedAmountBS?: number;
    clientRequestId?: string;
  }): Promise<string> {
    const payload: Record<string, unknown> = {
      invoiceId: params.invoiceId,
      orderId: params.orderId,
      userId: params.userId ?? null,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      reference: params.reference ?? null,
      notes: params.notes ?? null,
    };

    if (params.bcvRate) payload.bcvRate = params.bcvRate;
    if (params.expectedAmountBS)
      payload.expectedAmountBS = params.expectedAmountBS;
    if (params.clientRequestId)
      payload.clientRequestId = params.clientRequestId;

    const created = await api.post<RawPayment>('/api/payments', payload);
    return String(created.id ?? created._id ?? '');
  },

  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    const list = await api.get<RawPayment[]>('/api/payments', { orderId });
    return list
      .map(normalize)
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  },
};
