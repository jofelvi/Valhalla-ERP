import { InvoiceStatusEnum } from '@/shared';

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPaymentDateTime(dateString: string | Date): string {
  const payDate = new Date(dateString);
  const isValidDate = !isNaN(payDate.getTime());

  if (!isValidDate) return 'Fecha no disponible';

  return payDate.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH_USD: 'Efectivo USD',
    CASH_BS: 'Efectivo Bs',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    PAGO_MOVIL: 'Pago Movil',
    PAYROLL_DEDUCTION: 'Descuento de nomina',
  };
  return labels[method] || method;
}

export function getStatusBadgeVariant(
  status: InvoiceStatusEnum,
): 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return 'success';
    case InvoiceStatusEnum.PENDING:
      return 'destructive';
    case InvoiceStatusEnum.PARTIALLY_PAID:
      return 'warning';
    case InvoiceStatusEnum.OVERDUE:
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function getStatusBadgeLabel(status: InvoiceStatusEnum): string {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return 'Pagado';
    case InvoiceStatusEnum.PENDING:
      return 'Pendiente';
    case InvoiceStatusEnum.PARTIALLY_PAID:
      return 'Parcial';
    case InvoiceStatusEnum.OVERDUE:
      return 'Vencido';
    default:
      return status;
  }
}
