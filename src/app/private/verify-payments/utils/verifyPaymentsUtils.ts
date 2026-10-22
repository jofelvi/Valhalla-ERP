import { Order } from '@odin6/types';

export const getMethodLabel = (m?: string | null): string => {
  switch (m) {
    case 'CASH_USD':
      return 'Efectivo USD';
    case 'CASH_BS':
      return 'Efectivo Bs';
    case 'PAGO_MOVIL':
      return 'Pago Movil';
    case 'TRANSFER':
      return 'Transferencia';
    case 'CARD':
      return 'Tarjeta';
    default:
      return m ?? '—';
  }
};

export const shortOrderId = (o: Order): string =>
  o.orderNumber ?? o.id.slice(-8).toUpperCase();

export const hasFraudSuspect = (order: Order): boolean =>
  (order.pendingPayments ?? []).some((p) => p.ocr?.status === 'fraud_suspect');

export const hasOcrMismatch = (order: Order): boolean =>
  (order.pendingPayments ?? []).some((p) => p.ocr?.status === 'mismatch');
