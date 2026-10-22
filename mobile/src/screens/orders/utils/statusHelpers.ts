import { Ionicons } from '@expo/vector-icons';
import { OrderStatusEnum } from '../../../types';
import { COLORS } from '../../../constants';

export const getStatusColor = (status: OrderStatusEnum): string => {
  const colors: Record<OrderStatusEnum, string> = {
    [OrderStatusEnum.PENDING]: COLORS.warning,
    [OrderStatusEnum.IN_PROGRESS]: COLORS.info,
    [OrderStatusEnum.READY]: COLORS.success,
    [OrderStatusEnum.DELIVERED]: COLORS.success,
    [OrderStatusEnum.CREDIT]: COLORS.cyan,
    [OrderStatusEnum.CANCELLED]: COLORS.error,
    [OrderStatusEnum.PAID]: COLORS.success,
  };
  return colors[status] ?? COLORS.textSecondary;
};

export const getStatusIcon = (
  status: OrderStatusEnum,
): keyof typeof Ionicons.glyphMap => {
  const icons: Record<OrderStatusEnum, keyof typeof Ionicons.glyphMap> = {
    [OrderStatusEnum.PENDING]: 'time',
    [OrderStatusEnum.IN_PROGRESS]: 'flame',
    [OrderStatusEnum.READY]: 'checkmark-circle',
    [OrderStatusEnum.DELIVERED]: 'checkmark-done-circle',
    [OrderStatusEnum.CREDIT]: 'card',
    [OrderStatusEnum.CANCELLED]: 'close-circle',
    [OrderStatusEnum.PAID]: 'card',
  };
  return icons[status] ?? 'ellipse';
};

export const getStatusLabel = (status: OrderStatusEnum): string => {
  const labels: Record<OrderStatusEnum, string> = {
    [OrderStatusEnum.PENDING]: 'Pendiente',
    [OrderStatusEnum.IN_PROGRESS]: 'En preparación',
    [OrderStatusEnum.READY]: 'Listo para recoger',
    [OrderStatusEnum.DELIVERED]: 'Entregado',
    [OrderStatusEnum.CREDIT]: 'Crédito',
    [OrderStatusEnum.CANCELLED]: 'Cancelado',
    [OrderStatusEnum.PAID]: 'Pagado',
  };
  return labels[status] ?? status;
};

export const getStatusDescription = (status: OrderStatusEnum): string => {
  const descriptions: Record<OrderStatusEnum, string> = {
    [OrderStatusEnum.PENDING]:
      'Tu pedido fue recibido y está esperando confirmación',
    [OrderStatusEnum.IN_PROGRESS]:
      'Nuestros chefs están preparando tu pedido con cariño',
    [OrderStatusEnum.READY]: '¡Listo! Tu pedido está esperando por ti',
    [OrderStatusEnum.DELIVERED]: '¡Buen provecho! Tu pedido ha sido entregado',
    [OrderStatusEnum.CREDIT]: 'Orden entregada - Pago pendiente por crédito',
    [OrderStatusEnum.CANCELLED]: 'Este pedido fue cancelado',
    [OrderStatusEnum.PAID]: 'Pedido completado y pagado. ¡Gracias!',
  };
  return descriptions[status] ?? '';
};

export const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
