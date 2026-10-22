import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  OrderItemEvent,
  OrderItemEventDocument,
  OrderItemEventType,
  ActorRole,
} from './schemas/order-item-event.schema';

// Payload con los campos que espera la coleccion. Quien llame al service NO
// puede inventar timestamp ni sobreescribir _id — esos los maneja mongoose.
export interface RecordEventInput {
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

  // Plata del evento (monto del descuento en USD).
  amount?: number;

  actorId: string;
  actorName?: string;
  actorRole: ActorRole;

  pinValidated?: boolean;
  pinValidatedByUserId?: string;
  pinValidatedByUserName?: string;

  deviceInfo?: string;
  ipAddress?: string;

  // Permite hacer backfill de eventos historicos respetando la fecha real.
  // Si no se pasa, usa now().
  occurredAt?: Date;
}

@Injectable()
export class OrderItemEventsService {
  private readonly logger = new Logger(OrderItemEventsService.name);

  constructor(
    @InjectModel(OrderItemEvent.name)
    private readonly eventModel: Model<OrderItemEventDocument>,
  ) {}

  // Crea un evento. Append-only: nunca devuelve un upsert ni un update.
  // Los errores aqui NO deben tirar la operacion principal (un PATCH de orden
  // no debe fallar porque no se pudo loggear el evento). Por eso loggeamos y
  // tragamos.
  async record(input: RecordEventInput): Promise<void> {
    try {
      await this.eventModel.create({
        ...input,
        pinValidated: input.pinValidated ?? false,
        occurredAt: input.occurredAt ?? new Date(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to record order item event ${input.eventType} for order ${input.orderId}/${input.itemId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // No re-lanzar — la auditoria no debe romper el flujo del negocio.
    }
  }

  // Variante batch para cuando un mismo flujo genera varios eventos atomicos
  // (ej: cancelar una orden completa loggea N ITEM_CANCELLED). Mejor performance
  // que llamar record() en loop.
  async recordMany(inputs: RecordEventInput[]): Promise<void> {
    if (inputs.length === 0) return;
    try {
      const docs = inputs.map((i) => ({
        ...i,
        pinValidated: i.pinValidated ?? false,
        occurredAt: i.occurredAt ?? new Date(),
      }));
      await this.eventModel.insertMany(docs, { ordered: false });
    } catch (err) {
      this.logger.error(
        `Failed to record ${inputs.length} order item events: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ───────── Queries de lectura para reportes ─────────

  // Timeline de una orden (cronologico)
  async findByOrder(orderId: string): Promise<OrderItemEventDocument[]> {
    return this.eventModel
      .find({ orderId })
      .sort({ occurredAt: 1 })
      .lean()
      .exec() as Promise<OrderItemEventDocument[]>;
  }

  // Eventos por actor (auditoria por persona). Limitado a las ultimas 500
  // por defecto para no inflar memoria.
  async findByActor(
    actorId: string,
    limit = 500,
  ): Promise<OrderItemEventDocument[]> {
    return this.eventModel
      .find({ actorId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<OrderItemEventDocument[]>;
  }

  // Entregas de un actor en un rango — resumen diario de barra/cocina
  // ("cuanto gestiono hoy el barman"). Limitado por sanidad.
  async findDeliveredByActor(
    actorId: string,
    from?: Date,
    to?: Date,
    limit = 2000,
  ): Promise<OrderItemEventDocument[]> {
    const query: Record<string, unknown> = {
      actorId,
      eventType: 'ITEM_DELIVERED',
    };
    if (from || to) {
      query.occurredAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lt: to } : {}),
      };
    }
    return this.eventModel
      .find(query)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<OrderItemEventDocument[]>;
  }

  // Entregas de una ESTACION en un rango — historico de despachos del dia
  // (barra/cocina/pizza). Sirve para "que se despacho hoy y a quien".
  async findDeliveredByStation(
    station: string,
    from?: Date,
    to?: Date,
    limit = 2000,
  ): Promise<OrderItemEventDocument[]> {
    const query: Record<string, unknown> = {
      station: String(station).toUpperCase(),
      eventType: 'ITEM_DELIVERED',
    };
    if (from || to) {
      query.occurredAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lt: to } : {}),
      };
    }
    return this.eventModel
      .find(query)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<OrderItemEventDocument[]>;
  }

  // Eventos por tipo en un rango (para el reporte de incidentes)
  async findByType(
    eventType: OrderItemEventType,
    from: Date,
    to: Date,
    limit = 1000,
  ): Promise<OrderItemEventDocument[]> {
    return this.eventModel
      .find({
        eventType,
        occurredAt: { $gte: from, $lt: to },
      })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<OrderItemEventDocument[]>;
  }
}
