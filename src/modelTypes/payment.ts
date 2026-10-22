import { PaymentMethodEnum, PaymentStatusEnum } from '@/shared';

export interface Payment {
  id: string;
  orderId: string;
  amount: number; // Siempre en USD
  method: PaymentMethodEnum;
  transactionId?: string;
  status?: PaymentStatusEnum;
  notes?: string;
  createdAt: Date;
  userId: string; // Quién registró el pago
  bcvRate?: number; // Tasa BCV al momento del pago (para métodos en Bs)
  expectedAmountBS?: number; // Monto original en Bs (para CASH_BS y CARD)
  reference?: string; // Referencia (alias de transactionId, mantener ambos por compat)
  proofImageUrl?: string; // URL de la imagen del comprobante (si aplica)
  clientRequestId?: string; // Deduplicación: ID estable del cliente para reintentos por mala red
}
