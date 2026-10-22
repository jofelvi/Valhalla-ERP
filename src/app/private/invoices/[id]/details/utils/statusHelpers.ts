import { InvoiceStatusEnum } from '@/shared';

export const getStatusVariant = (status: InvoiceStatusEnum) => {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return 'success';
    case InvoiceStatusEnum.PENDING:
      return 'warning';
    case InvoiceStatusEnum.OVERDUE:
      return 'destructive';
    case InvoiceStatusEnum.CANCELLED:
      return 'secondary';
    default:
      return 'default';
  }
};

export const getStatusLabel = (status: InvoiceStatusEnum) => {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return 'Pagada';
    case InvoiceStatusEnum.PENDING:
      return 'Pendiente';
    case InvoiceStatusEnum.OVERDUE:
      return 'Vencida';
    case InvoiceStatusEnum.CANCELLED:
      return 'Cancelada';
    default:
      return status;
  }
};
