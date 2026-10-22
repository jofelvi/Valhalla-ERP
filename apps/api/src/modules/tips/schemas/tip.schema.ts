import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TipDocument = HydratedDocument<Tip>;

@Schema({ timestamps: true, collection: 'tips' })
export class Tip {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  waiterId: string;

  @Prop({ required: true })
  waiterName: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  userId: string;
}

export const TipSchema = SchemaFactory.createForClass(Tip);

/**
 * Una orden, una propina. El mismo doble submit que duplicaba cobros y
 * facturas dejaba tambien propinas repetidas: habia 9 grupos con el mismo
 * monto en la misma orden. Parcial, porque hay registros historicos sin
 * orderId.
 */
TipSchema.index(
  { orderId: 1 },
  {
    unique: true,
    name: 'uniq_propina_por_orden',
    partialFilterExpression: { orderId: { $type: 'string' } },
  },
);
