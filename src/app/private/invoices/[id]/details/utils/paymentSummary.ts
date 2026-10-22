import { Payment } from '@odin6/types';
import { PaymentMethodSummary } from '../types';

/**
 * Calcula el resumen de métodos de pago.
 * Agrupa pagos por método y suma montos.
 */
export const calculatePaymentMethodsSummary = (
  payments: Payment[],
): PaymentMethodSummary[] => {
  const summary = new Map<string, { amount: number; count: number }>();

  payments.forEach((payment) => {
    const method = payment.method || 'No especificado';
    const existing = summary.get(method) || { amount: 0, count: 0 };
    summary.set(method, {
      amount: existing.amount + (payment.amount || 0),
      count: existing.count + 1,
    });
  });

  return Array.from(summary.entries()).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
  }));
};
