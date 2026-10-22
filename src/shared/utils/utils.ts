import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PurchaseOrderStatusEnum } from '@/shared/types/enumShared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Configuración de tabs con labels en español y colores
export const statusTabs = [
  {
    value: 'all',
    label: 'Todas',
    color: 'text-dim',
    activeColor: 'text-blue-600 border-blue-600',
  },
  {
    value: PurchaseOrderStatusEnum.PENDING,
    label: 'Pendientes',
    color: 'text-brand',
    activeColor: 'text-brand border-brand',
  },
  {
    value: PurchaseOrderStatusEnum.APPROVED,
    label: 'Aprobadas',
    color: 'text-ok',
    activeColor: 'text-ok border-green-600',
  },
  {
    value: PurchaseOrderStatusEnum.RECEIVED,
    label: 'Recibidas',
    color: 'text-blue-600',
    activeColor: 'text-blue-600 border-blue-600',
  },
  {
    value: PurchaseOrderStatusEnum.PARTIALLY_RECEIVED,
    label: 'Parcialmente Recibidas',
    color: 'text-purple-600',
    activeColor: 'text-purple-600 border-purple-600',
  },
  {
    value: PurchaseOrderStatusEnum.CANCELED,
    label: 'Canceladas',
    color: 'text-danger',
    activeColor: 'text-danger border-danger',
  },
];
