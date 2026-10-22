// Evento de auditoría append-only de la colección orderItemEvents (NestJS).
// El backend los genera — el cliente solo los lee para mostrar el historial.
export type OrderItemEventType =
  | 'ITEM_ADDED'
  | 'ITEM_SENT_TO_STATION'
  | 'ITEM_DELIVERED'
  | 'ITEM_CANCELLED'
  | 'ITEM_NO_CHARGE'
  | 'ITEM_BILLED'
  | 'CASHIER_OVERRIDE_UNDELIVERED';

export interface OrderItemEvent {
  _id: string;
  orderId: string;
  itemId: string;
  productId: string;
  productName?: string;
  eventType: OrderItemEventType;
  qty: number;
  previousDeliveredQty?: number;
  newDeliveredQty?: number;
  station?: string;
  reason?: string;
  actorId: string;
  actorName?: string;
  actorRole: string;
  pinValidated?: boolean;
  pinValidatedByUserName?: string;
  occurredAt: string;
}
