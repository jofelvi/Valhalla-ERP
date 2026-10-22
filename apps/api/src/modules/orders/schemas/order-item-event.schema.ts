import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderItemEventDocument = HydratedDocument<OrderItemEvent>;

// Tipos de evento que loggeamos. Append-only — un evento nunca se borra ni se
// modifica. La auditoria reconstruye el historial de cualquier item sumando los
// eventos en orden cronologico.
//
// ITEM_ADDED                — Mesonero agrego el item a la orden
// ITEM_SENT_TO_STATION      — Item se envio a comanda (KITCHEN o BAR)
// ITEM_DELIVERED            — Cocina/barra marco "Listo" (con qty entregada)
// ITEM_CANCELLED            — Item se cancelo antes de entregar (deliveredQty == 0)
// ITEM_NO_CHARGE            — Cortesia: cajero/admin marco "no cobrar" con PIN
// ITEM_BILLED               — Item entro a la factura final cobrada
// CASHIER_OVERRIDE_UNDELIVERED — Cajero cobro item con deliveredQty < quantity (con PIN)
// ITEM_RETURNED             — Barra registro devolucion de unidades ya entregadas
export const ORDER_ITEM_EVENT_TYPES = [
  'ITEM_ADDED',
  'ITEM_SENT_TO_STATION',
  'ITEM_DELIVERED',
  'ITEM_CANCELLED',
  'ITEM_NO_CHARGE',
  'ITEM_BILLED',
  'CASHIER_OVERRIDE_UNDELIVERED',
  'ITEM_RETURNED',
  // Rebaja parcial autorizada con PIN admin (y su reverso).
  'ITEM_DISCOUNT',
  'ITEM_DISCOUNT_REMOVED',
] as const;

export type OrderItemEventType = (typeof ORDER_ITEM_EVENT_TYPES)[number];

// Roles del actor que ejecuto el evento. Se setea desde el JWT del request,
// no desde el body — para que no se pueda falsificar.
export const ACTOR_ROLES = [
  'waiter',
  'cashier',
  'kitchen',
  'bar',
  'pizza',
  'admin',
  'manager',
  'system',
] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

@Schema({ timestamps: true, collection: 'orderItemEvents' })
export class OrderItemEvent {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, index: true })
  orderId: string;

  // _id del item dentro de orders.items[] (cada item tiene su _id propio
  // generado por mongoose con _id:true en el subschema)
  @Prop({ required: true, index: true })
  itemId: string;

  @Prop({ required: true })
  productId: string;

  @Prop()
  productName?: string;

  @Prop({
    type: String,
    required: true,
    enum: ORDER_ITEM_EVENT_TYPES,
    index: true,
  })
  eventType: OrderItemEventType;

  // Cantidad afectada por este evento puntual (no es la qty total del item).
  // Ej: ITEM_DELIVERED qty=2 significa "se entregaron 2 mas en este evento".
  @Prop({ required: true })
  qty: number;

  // Snapshot de deliveredQty antes/despues del evento (cuando aplica)
  @Prop()
  previousDeliveredQty?: number;

  @Prop()
  newDeliveredQty?: number;

  // Estacion del item al momento del evento (solo informativo)
  @Prop()
  station?: string;

  // Motivo (obligatorio en CANCELLED, NO_CHARGE, OVERRIDE)
  @Prop()
  reason?: string;

  // Plata involucrada en el evento (hoy: monto del descuento en USD). Permite
  // sumar cuanto se rebajo sin tener que releer cada orden.
  @Prop()
  amount?: number;

  // Como se entrego: escaneando la ficha del cliente ('FICHA') o marcandolo a
  // mano en la pantalla de la estacion ('MANUAL'). La ficha es la que prueba
  // que el producto salio de verdad; sin este campo no habia forma de saber
  // cuantas entregas se marcaron sin escanear nada.
  @Prop({ type: String, enum: ['FICHA', 'MANUAL'], index: true })
  via?: 'FICHA' | 'MANUAL';

  // ───────── Actor ─────────
  // Quien ejecuto el evento. Se valida en el controller que sea no-vacio
  // y que el rol coincida con el JWT.
  @Prop({ required: true, index: true })
  actorId: string;

  @Prop()
  actorName?: string;

  @Prop({ type: String, required: true, enum: ACTOR_ROLES })
  actorRole: ActorRole;

  // Si el evento requirio validacion de PIN admin, registramos quien valido
  // (puede ser distinto del actor — ej: cajero ejecuta cancel pero el admin
  // que esta a su lado tipea el PIN). Si no aplica PIN, queda en false/null.
  @Prop({ default: false })
  pinValidated: boolean;

  @Prop()
  pinValidatedByUserId?: string;

  @Prop()
  pinValidatedByUserName?: string;

  // Metadata del dispositivo desde donde se ejecuto (para auditoria avanzada)
  @Prop()
  deviceInfo?: string;

  @Prop()
  ipAddress?: string;

  // Timestamp del servidor (no del cliente — mas confiable). createdAt y
  // updatedAt los maneja mongoose con timestamps:true; este lo usamos cuando
  // queremos reescribir backfills sin perder el "when realmente paso".
  @Prop({ default: () => new Date() })
  occurredAt: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const OrderItemEventSchema =
  SchemaFactory.createForClass(OrderItemEvent);

// Indices compuestos para queries comunes:
// - reporte timeline por orden (orderId + occurredAt)
// - reporte por persona (actorId + occurredAt)
// - reporte por tipo de incidente (eventType + occurredAt)
OrderItemEventSchema.index({ orderId: 1, occurredAt: 1 });
OrderItemEventSchema.index({ actorId: 1, occurredAt: -1 });
OrderItemEventSchema.index({ eventType: 1, occurredAt: -1 });
