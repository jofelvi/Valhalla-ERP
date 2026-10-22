import { Order } from '@/modelTypes/order';

// Estado de un item pendiente de autorización PIN
export interface LockedItem {
  name: string;
  qty: number;
}

// Contexto de reserva de mesa
export interface ReservationContext {
  tableId: string;
  userId: string;
  releaseToken: string | null;
}

// Datos de impresión
export interface PrintContext {
  tableId: string | null;
  tableName: string | null;
  waiterName: string | null;
}

// Item en edición (reducción de cantidad post-comanda)
export type PendingItemEdit =
  | { type: 'remove'; index: number }
  | { type: 'setQty'; index: number; quantity: number }
  | null;

// Payload normalizado para construir orden antes de guardar
export interface OrderPayload
  extends Omit<Order, 'id' | 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}
