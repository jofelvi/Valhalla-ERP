import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { COMMISSION_BASES } from '@odin6/types';
import type { CommissionBasis } from '@odin6/types';

export type PagoComisionDocument = HydratedDocument<PagoComision>;

@Schema({ timestamps: true, collection: 'pagos-comision' })
export class PagoComision {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  waiterId: string;

  @Prop({ required: true })
  waiterName: string;

  @Prop([String])
  @Prop({ required: true })
  orderIds: string[];

  @Prop({ required: true })
  montoTotal: number;

  @Prop()
  tipTotal: number;

  @Prop()
  sesionesCubiertas: number;

  @Prop({ required: true })
  periodoDesde: Date;

  @Prop({ required: true })
  periodoHasta: Date;

  @Prop({ required: true })
  fechaPago: Date;

  @Prop({ required: true })
  usuarioPago: string;

  @Prop()
  notas: string;

  // Porcentaje sobre la base (7 = 7 %). Lo que se guardó con la tasa usada al pagar.
  @Prop()
  comisionPct: number;

  // Fracción usada para este pago (0.07) y base sobre la que se calculó
  // (`sales` = consumo, `service` = servicio). Sin @Prop el strict mode las descarta.
  @Prop()
  commissionRate?: number;

  @Prop({ type: String, enum: COMMISSION_BASES })
  commissionBasis?: CommissionBasis;

  @Prop({ default: 0 })
  descuentos: number;

  @Prop()
  descuentosDetalle: string;

  @Prop()
  montoNeto: number;

  @Prop({ default: 0 })
  diasAsistidos: number;

  @Prop({ default: 0 })
  bonoAsistencia: number;
}

export const PagoComisionSchema = SchemaFactory.createForClass(PagoComision);
