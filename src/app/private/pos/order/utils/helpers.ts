import { OrderItem } from '@/modelTypes/orderItem';
import { OrderFormValues } from '@/shared/schemas/orderSchema';

/**
 * Guard: `Order.createdAt` está tipado como Date, pero datos viejos migrados
 * de Firestore aún pueden llegar como Timestamp-like `{ seconds: number }`.
 */
export function hasSecondsField(value: unknown): value is { seconds: number } {
  return typeof value === 'object' && value !== null && 'seconds' in value;
}

/**
 * Convierte OrderItem[] a OrderFormValues['items'], normalizando `notes` a null
 * en lugar de undefined (requerido por el schema yup).
 */
export function toFormOrderItems(items: OrderItem[]): OrderFormValues['items'] {
  return items.map((item) => ({ ...item, notes: item.notes ?? null }));
}

/**
 * Filtra items pendientes de imprimir: quantity > sentQty
 */
export function getNewItems(items: OrderItem[]): OrderItem[] {
  return items.filter((item) => item.quantity > (item.sentQty ?? 0));
}

/**
 * Compara dos createdAt que pueden ser Date o { seconds: number }
 */
export function getCreatedAtMs(createdAt: unknown): number {
  if (hasSecondsField(createdAt)) {
    return createdAt.seconds * 1000;
  }
  return new Date(createdAt as string | number).getTime();
}
