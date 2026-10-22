import { ReceivedItem } from '@/features/supply-chain/types/merchandiseReceiptTypes';
import { ReceiptFormData } from '../types';

/**
 * Convierte items del formulario a ReceivedItems con cálculos de varianza
 * PRESERVADO: exactamente los mismos cálculos que líneas 176-196 del original
 */
export const buildReceivedItemsFromForm = (
  watchedItems: ReceiptFormData['items'] | undefined,
): ReceivedItem[] => {
  if (!watchedItems) return [];

  return watchedItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    orderedQuantity: item.orderedQuantity,
    receivedQuantity: item.receivedQuantity || 0,
    orderedUnitPrice: item.orderedUnitPrice,
    receivedUnitPrice: item.receivedUnitPrice || item.orderedUnitPrice,
    unit: item.unit,
    notes: item.notes,
    isPartialDelivery: (item.receivedQuantity || 0) < item.orderedQuantity,
    priceVariance:
      (item.receivedUnitPrice || item.orderedUnitPrice) - item.orderedUnitPrice,
    priceVariancePercentage:
      item.orderedUnitPrice > 0
        ? (((item.receivedUnitPrice || item.orderedUnitPrice) -
            item.orderedUnitPrice) /
            item.orderedUnitPrice) *
          100
        : 0,
  }));
};

/**
 * Convierte items del formulario a ReceivedItems para el submit
 * PRESERVADO: exactamente los mismos cálculos que líneas 210-227 del original
 */
export const buildReceivedItemsForSubmit = (
  formItems: ReceiptFormData['items'],
): ReceivedItem[] => {
  return formItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    orderedQuantity: item.orderedQuantity,
    receivedQuantity: item.receivedQuantity,
    orderedUnitPrice: item.orderedUnitPrice,
    receivedUnitPrice: item.receivedUnitPrice,
    unit: item.unit,
    notes: item.notes,
    isPartialDelivery: item.receivedQuantity < item.orderedQuantity,
    priceVariance: item.receivedUnitPrice - item.orderedUnitPrice,
    priceVariancePercentage:
      item.orderedUnitPrice > 0
        ? ((item.receivedUnitPrice - item.orderedUnitPrice) /
            item.orderedUnitPrice) *
          100
        : 0,
  }));
};

/**
 * Calcula totales de la orden
 * PRESERVADO: exactamente los mismos cálculos que líneas 229-236 del original
 */
export const calculateOrderTotals = (
  receivedItems: ReceivedItem[],
): { totalOrderedAmount: number; totalReceivedAmount: number } => {
  const totalOrderedAmount = receivedItems.reduce(
    (sum, item) => sum + item.orderedQuantity * item.orderedUnitPrice,
    0,
  );
  const totalReceivedAmount = receivedItems.reduce(
    (sum, item) => sum + item.receivedQuantity * item.receivedUnitPrice,
    0,
  );

  return { totalOrderedAmount, totalReceivedAmount };
};

/**
 * Calcula si hay varianza de precio para un item
 * Retorna true si |varianza| > 0.01
 */
export const hasSignificantPriceVariance = (
  receivedUnitPrice: number | undefined,
  orderedUnitPrice: number,
): boolean => {
  const price = receivedUnitPrice || orderedUnitPrice;
  return Math.abs(price - orderedUnitPrice) > 0.01;
};

/**
 * Calcula el total recibido desde items del formulario
 * PRESERVADO: exactamente el mismo cálculo que líneas 618-626 del original
 */
export const calculateTotalReceived = (
  watchedItems: ReceiptFormData['items'] | undefined,
): number => {
  if (!watchedItems) return 0;

  return watchedItems.reduce(
    (sum, item) =>
      sum +
      (item.receivedQuantity || 0) *
        (item.receivedUnitPrice || item.orderedUnitPrice),
    0,
  );
};

/**
 * Mapea la varianza de precio a una clase de color
 * PRESERVADO: exactamente como línea 282-286 del original
 */
export const getVarianceColor = (variance: number): string => {
  if (variance > 0) return 'text-danger'; // Más caro
  if (variance < 0) return 'text-ok'; // Más barato
  return 'text-dim'; // Sin cambio
};

/**
 * Calcula la varianza individual de un precio
 * PRESERVADO: exactamente como líneas 517-521 del original (verificación de si hay varianza)
 */
export const calculateItemPriceVariance = (
  receivedUnitPrice: number | undefined,
  orderedUnitPrice: number,
): number => {
  return (receivedUnitPrice || orderedUnitPrice) - orderedUnitPrice;
};

/**
 * Calcula el porcentaje de varianza
 * PRESERVADO: exactamente como líneas 549-562 del original
 */
export const calculateVariancePercentage = (
  receivedUnitPrice: number | undefined,
  orderedUnitPrice: number,
): string => {
  if (orderedUnitPrice > 0) {
    return (
      (
        (((receivedUnitPrice || orderedUnitPrice) - orderedUnitPrice) /
          orderedUnitPrice) *
        100
      ).toFixed(1) + '%'
    );
  }
  return 'N/A';
};
