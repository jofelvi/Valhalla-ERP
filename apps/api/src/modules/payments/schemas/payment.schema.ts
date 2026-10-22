import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMethodEnum } from '@odin6/types';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({
    required: true,
    enum: Object.values(PaymentMethodEnum),
  })
  method: string;

  @Prop()
  transactionId?: string;

  @Prop()
  status?: string;

  @Prop()
  notes?: string;

  @Prop({ required: true })
  userId: string;

  @Prop()
  bcvRate?: number;

  @Prop()
  expectedAmountBS?: number;

  @Prop()
  proofImageUrl?: string;

  // Idempotencia de creacion, mismo patron que `order.schema.ts`: el cliente
  // genera un id por intento de cobro y lo reusa en reintentos (mala red,
  // doble tap). Hoy nada en `payments.service.ts` lo lee ni lo escribe — el
  // campo y su indice quedan listos para cuando se conecte (ver DTO/service
  // de payments); mientras tanto es un campo sparse sin uso, no molesta.
  @Prop()
  clientRequestId?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

/**
 * Un voucher no puede pagar dos veces la misma cuenta.
 *
 * La comprobacion en codigo (`findDuplicate`) no basta contra el doble clic:
 * dos peticiones simultaneas consultan ANTES de que ninguna haya insertado y
 * las dos pasan (medido: 3 POST a la vez → 3 cobros de $5.50). Solo el indice
 * unico lo resuelve de forma atomica, porque decide Mongo y no la aplicacion.
 *
 * Parcial: solo aplica a pagos CON referencia. Efectivo y demas metodos sin
 * `transactionId` quedan cubiertos por la ventana de 30s de `findDuplicate`.
 *
 * OJO: este indice NO se construye mientras existan duplicados historicos.
 * Hay que correr antes `scripts/dedupe-payments.mjs`.
 */
PaymentSchema.index(
  { orderId: 1, transactionId: 1 },
  {
    unique: true,
    name: 'uniq_orden_referencia',
    partialFilterExpression: { transactionId: { $type: 'string' } },
  },
);

/**
 * Idempotencia de creacion por `clientRequestId` (mismo patron que
 * `order.schema.ts`). Sparse: los pagos que no mandan la clave (todos, hoy)
 * no chocan entre si.
 *
 * OJO antes de desplegar: si ya hay `clientRequestId` duplicados historicos
 * (no deberia, porque nada lo escribe todavia) el indice no se construye.
 * Dedupe en mongosh, mismo patron que arriba (conservando el mas viejo):
 *
 *   db.payments.aggregate([
 *     { $match: { clientRequestId: { $type: "string", $ne: "" } } },
 *     { $sort: { createdAt: 1 } },
 *     { $group: { _id: "$clientRequestId", ids: { $push: "$_id" }, count: { $sum: 1 } } },
 *     { $match: { count: { $gt: 1 } } },
 *   ]).forEach(g => {
 *     const ids = g.ids.slice(1);
 *     db.payments.deleteMany({ _id: { $in: ids } });
 *   });
 */
PaymentSchema.index(
  { clientRequestId: 1 },
  { unique: true, sparse: true, name: 'uniq_client_request_id' },
);
