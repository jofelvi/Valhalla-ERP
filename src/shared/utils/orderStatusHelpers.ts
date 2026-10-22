import {
  OrderStatusEnum,
  PaymentStatusEnum,
  PaymentMethodEnum,
} from '@/shared/types/enumShared';

/**
 * Obtiene las clases Tailwind para estilo de estado de orden
 */
export function getStatusColor(status: OrderStatusEnum): string {
  switch (status) {
    case OrderStatusEnum.PENDING:
      return 'bg-accent/15 text-accent border-accent/30';
    case OrderStatusEnum.IN_PROGRESS:
      return 'bg-brand/15 text-brand border-brand/30';
    case OrderStatusEnum.READY:
      return 'bg-ok/15 text-ok border-ok/30';
    case OrderStatusEnum.DELIVERED:
      return 'bg-accent/15 text-accent border-accent/30';
    case OrderStatusEnum.PAID:
      return 'bg-ok/15 text-ok border-ok/30';
    case OrderStatusEnum.CREDIT:
      return 'bg-elevated text-content border-line';
    case OrderStatusEnum.CANCELLED:
      return 'bg-danger/15 text-danger border-danger/30';
    default:
      return 'bg-elevated text-content border-line';
  }
}

/**
 * Obtiene las clases Tailwind para estilo de estado de pago
 */
export function getPaymentStatusColor(status: PaymentStatusEnum): string {
  switch (status) {
    case PaymentStatusEnum.PAID:
      return 'bg-ok/15 text-ok';
    case PaymentStatusEnum.PENDING:
      return 'bg-accent/15 text-accent';
    case PaymentStatusEnum.PARTIAL:
      return 'bg-accent/15 text-accent';
    case PaymentStatusEnum.CANCELLED:
      return 'bg-danger/15 text-danger';
    case PaymentStatusEnum.PENDING_VERIFICATION:
      return 'bg-accent/15 text-accent';
    default:
      return 'bg-elevated text-content';
  }
}

/**
 * Obtiene la etiqueta de texto para un estado de orden
 */
export function getStatusLabel(status: OrderStatusEnum): string {
  const labels: Record<OrderStatusEnum, string> = {
    [OrderStatusEnum.PENDING]: 'Pendiente',
    [OrderStatusEnum.IN_PROGRESS]: 'En Progreso',
    [OrderStatusEnum.READY]: 'Lista',
    [OrderStatusEnum.DELIVERED]: 'Entregada',
    [OrderStatusEnum.PAID]: 'Pagada',
    [OrderStatusEnum.CREDIT]: 'Crédito',
    [OrderStatusEnum.CANCELLED]: 'Cancelada',
  };
  return labels[status] || status;
}

/**
 * Obtiene la etiqueta de texto para un estado de pago
 */
export function getPaymentStatusLabel(status: PaymentStatusEnum): string {
  const labels: Record<PaymentStatusEnum, string> = {
    [PaymentStatusEnum.PAID]: 'Pagado',
    [PaymentStatusEnum.PENDING]: 'Pendiente',
    [PaymentStatusEnum.PARTIAL]: 'Parcial',
    [PaymentStatusEnum.CANCELLED]: 'Cancelado',
    [PaymentStatusEnum.REFUNDED]: 'Reembolsado',
    [PaymentStatusEnum.PENDING_VERIFICATION]: 'Por Verificar',
  };
  return labels[status] || status;
}

/**
 * Obtiene la etiqueta de texto para un método de pago
 */
export function getPaymentMethodLabel(
  method?: PaymentMethodEnum | null,
): string {
  if (!method) return '—';

  const labels: Record<PaymentMethodEnum, string> = {
    [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
    [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
    [PaymentMethodEnum.CARD]: 'Tarjeta',
    [PaymentMethodEnum.TRANSFER]: 'Transferencia',
    [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Movil',
    [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Movil Manual',
    [PaymentMethodEnum.MIXED]: 'Pago Mixto',
    [PaymentMethodEnum.PENDING]: 'Pendiente',
    [PaymentMethodEnum.PAYROLL_DEDUCTION]: 'Deducción nómina',
  };
  return labels[method] ?? method;
}
