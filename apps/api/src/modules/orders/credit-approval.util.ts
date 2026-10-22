/**
 * Clasificación de estado de pago de una orden para validar si puede aprobar crédito.
 *
 * Ante una solicitud de crédito (que se traduce en crear una cuenta por cobrar),
 * necesitamos validar que la orden NO esté ya pagada (ni parcialmente). Si lo está,
 * aprobar el crédito causaría que el cliente vuelva a deber lo que ya pagó.
 *
 * Criterios:
 * - PAID: paymentStatus === 'PAID' (case-insensitive) O paidAmount >= total - 0.01
 *   Nota: órdenes viejas pueden no traer `paidAmount` pero sí `paymentStatus: 'paid'`
 * - PARTIALLY_PAID: paidAmount > 0 Y paidAmount < (total - 0.01)
 * - UNPAID: paidAmount === 0 o undefined, o paymentStatus !== 'PAID'
 * - ZERO_OR_NEGATIVE_TOTAL: total <= 0
 *
 * El threshold 0.01 es para evitar rechazos por redondeo de coma flotante.
 */

export interface PaymentStatusClassification {
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'ZERO_OR_NEGATIVE_TOTAL';
  paidAmount: number;
  total: number;
}

export function classifyOrderPaymentStatus(order: {
  total?: number;
  paidAmount?: number;
  paymentStatus?: string;
}): PaymentStatusClassification {
  const total = order.total ?? 0;
  const paidAmount = order.paidAmount ?? 0;
  const paymentStatus = (order.paymentStatus ?? '').toLowerCase();

  // Caso especial: total cero o negativo
  if (total <= 0) {
    return {
      status: 'ZERO_OR_NEGATIVE_TOTAL',
      paidAmount,
      total,
    };
  }

  // Pagada por paymentStatus legacy (órdenes viejas)
  if (paymentStatus === 'paid') {
    return {
      status: 'PAID',
      paidAmount,
      total,
    };
  }

  // Pagada por monto
  if (paidAmount >= total - 0.01) {
    return {
      status: 'PAID',
      paidAmount,
      total,
    };
  }

  // Parcialmente pagada
  if (paidAmount > 0 && paidAmount < total - 0.01) {
    return {
      status: 'PARTIALLY_PAID',
      paidAmount,
      total,
    };
  }

  // Sin cobrar
  return {
    status: 'UNPAID',
    paidAmount,
    total,
  };
}

/**
 * Genera mensajes de error en español para rechazo de aprobación de crédito.
 * Usado por `approveCreditRequest` para comunicar al admin por qué no puede
 * fiar una orden que ya tiene dinero en ella.
 */
export function buildPaymentStatusError(
  classification: PaymentStatusClassification,
): string {
  switch (classification.status) {
    case 'PAID':
      return `La orden ya está cobrada: cierra la solicitud en vez de autorizarla.`;
    case 'PARTIALLY_PAID': {
      const remaining = (
        classification.total - classification.paidAmount
      ).toFixed(2);
      return `La orden ya tiene $${classification.paidAmount.toFixed(2)} cobrados de $${classification.total.toFixed(2)}: cobra el resto ($${remaining}) en vez de fiar el total.`;
    }
    case 'ZERO_OR_NEGATIVE_TOTAL':
      return `La orden tiene total $${classification.total.toFixed(2)}: no se puede fiar.`;
    default:
      return 'Estado de pago desconocido.';
  }
}
