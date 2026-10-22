'use client';

import { InvoiceStatusEnum } from '@/shared';
import { Badge } from '@/components/shared/badge/badge';

export const formatDate = (date: Date): string =>
  new Date(date).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelative = (date: Date | string): string => {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  if (isNaN(d.getTime()) || diffMs < 0) return formatDateTime(d);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return formatDateTime(d).slice(0, 10);
};

export const getStatusBadge = (status: InvoiceStatusEnum) => {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return <Badge variant="success">Pagado</Badge>;
    case InvoiceStatusEnum.PENDING:
      return <Badge variant="destructive">Pendiente</Badge>;
    case InvoiceStatusEnum.PARTIALLY_PAID:
      return <Badge variant="warning">Parcial</Badge>;
    case InvoiceStatusEnum.OVERDUE:
      return <Badge variant="destructive">Vencido</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};
