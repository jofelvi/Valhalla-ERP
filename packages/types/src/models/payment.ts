import { PaymentMethodEnum, PaymentStatusEnum } from '../enums/enumShared';

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
  reference?: string; // Alias de transactionId para compatibilidad
  proofImageUrl?: string; // URL de la imagen del comprobante (si aplica)
  clientRequestId?: string; // Deduplicación para reintentos por mala red
}
