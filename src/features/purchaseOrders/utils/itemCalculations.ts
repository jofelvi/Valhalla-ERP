// Utilidades para cálculos de items en órdenes de compra
import { PurchaseOrderItemFormValues } from '@/shared/schemas/purchaseOrderSchema';

/**
 * Calcula el subtotal de un item (cantidad × costo unitario)
 * @param quantity Cantidad del item
 * @param unitCost Costo unitario
 * @returns Subtotal calculado
 */
export const calculateItemSubtotal = (
  quantity: number,
  unitCost: number,
): number => {
  return quantity * unitCost;
};

/**
 * Calcula el total de la orden sumando todos los subtotales de items
 * @param items Array de items de la orden
 * @returns Total de la orden
 */
export const calculateOrderTotal = (
  items: Array<Partial<PurchaseOrderItemFormValues> | undefined>,
): number => {
  return items.reduce((sum, item) => sum + (item?.subtotal || 0), 0);
};

/**
 * Actualiza un item cuando cambia quantity o unitCost
 * @param currentItem Item actual
 * @param field Campo que cambió
 * @param value Nuevo valor
 * @returns Item actualizado con subtotal recalculado
 */
export const updateItemWithCalculation = (
  currentItem: PurchaseOrderItemFormValues,
  field: 'quantity' | 'unitCost' | 'productId',
  value: string | number,
): PurchaseOrderItemFormValues => {
  if (field === 'quantity' || field === 'unitCost') {
    const quantity =
      field === 'quantity' ? (value as number) : currentItem.quantity;
    const unitCost =
      field === 'unitCost' ? (value as number) : currentItem.unitCost;
    return {
      ...currentItem,
      [field]: value,
      subtotal: calculateItemSubtotal(quantity, unitCost),
    };
  }

  return {
    ...currentItem,
    productId: value as string,
  };
};
