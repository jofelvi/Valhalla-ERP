/**
 * Retorna la clase Tailwind para el color de fondo del estado de la orden.
 * Valores comunes: pending, in_progress, ready, credit
 */
export const getOrderStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'bg-accent/10 text-accent';
    case 'in_progress':
      return 'bg-brand/10 text-brand';
    case 'ready':
      return 'bg-ok/10 text-ok';
    case 'credit':
      return 'bg-elevated text-content';
    default:
      return 'bg-elevated text-content';
  }
};

/**
 * Retorna la etiqueta legible del estado de la orden en español.
 */
export const getOrderStatusText = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Pendiente';
    case 'in_progress':
      return 'En Preparación';
    case 'ready':
      return 'Listo';
    case 'credit':
      return 'Crédito';
    default:
      return status;
  }
};

/**
 * Retorna la etiqueta legible del método de pago.
 */
export const getPaymentMethodLabel = (method?: string): string => {
  switch (method) {
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
      return method ?? 'N/A';
  }
};
