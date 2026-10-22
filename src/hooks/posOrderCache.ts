// Import directo al enum (no al barrel @/shared) para mantener el modulo puro
// y testeable sin arrastrar UI ni assets.
import { OrderStatusEnum } from '@/shared/types/enumShared';

// "Activa" para el POS = la MISMA definicion que usa el endpoint
// /orders/pos-data: estado PENDING/IN_PROGRESS/READY y no borrada. Todo lo
// demas (CANCELLED, PAID, DELIVERED, CREDIT, isDeleted) deja de ocupar la mesa.
const ACTIVE_STATUSES = new Set<string>([
  OrderStatusEnum.PENDING,
  OrderStatusEnum.IN_PROGRESS,
  OrderStatusEnum.READY,
]);

export interface PosOrderCacheShape {
  status?: string;
  isDeleted?: boolean;
}

/**
 * Decide si una orden debe seguir viva en la cache del POS (`activeOrders`).
 *
 * Los eventos realtime `order:updated` traen tambien ordenes que dejaron de
 * estar activas (una orden reseteada llega como CANCELLED + isDeleted). Si el
 * handler las hace upsert en vez de sacarlas, quedan pegadas como
 * `currentOrder` de la mesa y la pintan roja/bloqueada aunque la BD ya la
 * libero (mesa zombie). Este predicado alinea la cache con el endpoint.
 */
export function isActivePosOrder(
  order: PosOrderCacheShape | null | undefined,
): boolean {
  if (!order) return false;
  if (order.isDeleted === true) return false;
  return ACTIVE_STATUSES.has(String(order.status ?? ''));
}
