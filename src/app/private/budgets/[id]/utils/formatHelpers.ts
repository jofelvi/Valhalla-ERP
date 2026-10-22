import { aFecha } from '@/shared/utils/dateHelpers';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDateVE(date: Date | string | undefined): string {
  if (!date) return '—';
  const d = aFecha(date);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Caracas',
  });
}
