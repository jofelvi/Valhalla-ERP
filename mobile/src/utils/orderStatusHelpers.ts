/**
 * Helpers para mapear estados de órdenes y pagos a colores, íconos y etiquetas.
 * Usa las constantes de tema (COLORS) para consistencia visual.
 */

import { COLORS } from '../constants';
import {
  OrderStatusEnum,
  PaymentStatusEnum,
  PaymentMethodEnum,
} from '../types';
import {
  estadoVisibleDePedido,
  TonoDeEstado,
} from '../services/estadoVisibleDePedido';

/**
 * Retorna el color para un estado de orden.
 * Valores alineados con OrdersScreen (convención canónica).
 */
export const getOrderStatusColor = (status: OrderStatusEnum): string => {
  const statusColorMap: Record<OrderStatusEnum, string> = {
    [OrderStatusEnum.PENDING]: COLORS.warning,
    [OrderStatusEnum.IN_PROGRESS]: COLORS.info,
    [OrderStatusEnum.READY]: COLORS.success,
    [OrderStatusEnum.DELIVERED]: COLORS.success,
    [OrderStatusEnum.PAID]: COLORS.success,
    [OrderStatusEnum.CREDIT]: COLORS.cyan,
    [OrderStatusEnum.CANCELLED]: COLORS.error,
  };
  return statusColorMap[status] ?? COLORS.textSecondary;
};

/**
 * Retorna el nombre de ícono para un estado de orden (Ionicons).
 * Valores alineados con OrdersScreen (convención canónica).
 */
export const getOrderStatusIcon = (
  status: OrderStatusEnum,
): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap => {
  const statusIconMap: Record<
    OrderStatusEnum,
    keyof typeof import('@expo/vector-icons').Ionicons.glyphMap
  > = {
    [OrderStatusEnum.PENDING]: 'time-outline',
    [OrderStatusEnum.IN_PROGRESS]: 'flame-outline',
    [OrderStatusEnum.READY]: 'checkmark-circle-outline',
    [OrderStatusEnum.DELIVERED]: 'checkmark-done-outline',
    [OrderStatusEnum.PAID]: 'card-outline',
    [OrderStatusEnum.CREDIT]: 'card-outline',
    [OrderStatusEnum.CANCELLED]: 'close-circle-outline',
  };
  return statusIconMap[status] ?? 'ellipse-outline';
};

/**
 * Retorna la etiqueta en español para un estado de orden.
 * Valores alineados con OrdersScreen (convención canónica).
 */
export const getOrderStatusLabel = (status: OrderStatusEnum): string => {
  const statusLabelMap: Record<OrderStatusEnum, string> = {
    [OrderStatusEnum.PENDING]: 'Pendiente',
    [OrderStatusEnum.IN_PROGRESS]: 'En preparación',
    [OrderStatusEnum.READY]: 'Listo',
    [OrderStatusEnum.DELIVERED]: 'Entregado',
    [OrderStatusEnum.PAID]: 'Pagado',
    [OrderStatusEnum.CREDIT]: 'Crédito',
    [OrderStatusEnum.CANCELLED]: 'Cancelado',
  };
  return statusLabelMap[status] ?? status;
};

/**
 * Retorna el color para un estado de pago.
 */
export const getPaymentStatusColor = (status: PaymentStatusEnum): string => {
  const statusColorMap: Record<PaymentStatusEnum, string> = {
    [PaymentStatusEnum.PENDING]: COLORS.statusPending,
    [PaymentStatusEnum.PENDING_VERIFICATION]: COLORS.warning,
    [PaymentStatusEnum.PARTIAL]: COLORS.warning,
    [PaymentStatusEnum.PAID]: COLORS.success,
    [PaymentStatusEnum.REFUNDED]: COLORS.info,
    [PaymentStatusEnum.CANCELLED]: COLORS.error,
  };
  return statusColorMap[status] ?? COLORS.textSecondary;
};

/**
 * Retorna la etiqueta en español para un estado de pago.
 */
export const getPaymentStatusLabel = (status: PaymentStatusEnum): string => {
  const statusLabelMap: Record<PaymentStatusEnum, string> = {
    [PaymentStatusEnum.PENDING]: 'Pendiente',
    [PaymentStatusEnum.PENDING_VERIFICATION]: 'Verificación Pendiente',
    [PaymentStatusEnum.PARTIAL]: 'Parcial',
    [PaymentStatusEnum.PAID]: 'Pagado',
    [PaymentStatusEnum.REFUNDED]: 'Reembolsado',
    [PaymentStatusEnum.CANCELLED]: 'Cancelado',
  };
  return statusLabelMap[status] ?? 'Desconocido';
};

/**
 * Retorna la etiqueta en español para un método de pago.
 */
export const getPaymentMethodLabel = (method: PaymentMethodEnum): string => {
  const methodLabelMap: Record<PaymentMethodEnum, string> = {
    [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
    [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
    [PaymentMethodEnum.CARD]: 'Punto de Venta',
    [PaymentMethodEnum.TRANSFER]: 'Transferencia',
    [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Móvil',
    [PaymentMethodEnum.MIXED]: 'Mixto',
    [PaymentMethodEnum.PENDING]: 'Pendiente',
  };
  return methodLabelMap[method] ?? 'Desconocido';
};

/**
 * Retorna el ícono para un método de pago.
 */
export const getPaymentMethodIcon = (method: PaymentMethodEnum): string => {
  const methodIconMap: Record<PaymentMethodEnum, string> = {
    [PaymentMethodEnum.CASH_USD]: 'cash-outline',
    [PaymentMethodEnum.CASH_BS]: 'cash-outline',
    [PaymentMethodEnum.CARD]: 'card-outline',
    [PaymentMethodEnum.TRANSFER]: 'swap-horizontal-outline',
    [PaymentMethodEnum.PAGO_MOVIL]: 'phone-portrait-outline',
    [PaymentMethodEnum.MIXED]: 'layers-outline',
    [PaymentMethodEnum.PENDING]: 'hourglass-outline',
  };
  return methodIconMap[method] ?? 'help-circle-outline';
};

const COLOR_POR_TONO: Record<TonoDeEstado, string> = {
  porCobrar: COLORS.warning,
  pendiente: COLORS.warning,
  verificar: COLORS.warning,
  pagado: COLORS.success,
  rechazado: COLORS.error,
  parcial: COLORS.warning,
  credito: COLORS.cyan,
  cancelado: COLORS.error,
  entregado: COLORS.success,
};

const ICONO_POR_TONO: Record<
  TonoDeEstado,
  keyof typeof import('@expo/vector-icons').Ionicons.glyphMap
> = {
  porCobrar: 'cash-outline',
  pendiente: 'time-outline',
  verificar: 'time-outline',
  pagado: 'checkmark-circle-outline',
  rechazado: 'close-circle-outline',
  parcial: 'swap-horizontal-outline',
  credito: 'card-outline',
  cancelado: 'close-circle-outline',
  entregado: 'checkmark-done-outline',
};

/**
 * Etiqueta, color e icono de una orden para las listas: el estado de pago manda sobre el de la
 * orden, de modo que un pedido ya cobrado no aparece como "Pendiente".
 */
export const getOrderDisplayStatus = (
  order: {
    status?: string | null;
    paymentStatus?: string | null;
    paymentRejected?: boolean | null;
  },
  /** La pantalla ya muestra su propio aviso de "en verificación": no repetirlo en la etiqueta. */
  opciones: { avisoDeVerificacionAparte?: boolean } = {},
) => {
  const { etiqueta, tono, porVerificar } = estadoVisibleDePedido(order);
  return {
    porVerificar: porVerificar === true,
    label:
      porVerificar && !opciones.avisoDeVerificacionAparte
        ? `${etiqueta} · por verificar`
        : etiqueta,
    color: COLOR_POR_TONO[tono],
    icon: ICONO_POR_TONO[tono],
  };
};
