import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type PriceHistoryDocument = HydratedDocument<PriceHistory>;

@Schema({ collection: 'price_history' })
export class PriceHistory {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  productId: string;

  // Costo por UNIDAD BASE del insumo (GR/ML/UND), roundUnitCost (8 dec)
  @Prop({ type: Number, required: true })
  unitCost: number;

  @Prop({ type: String, required: true, index: true })
  placeId: string;

  @Prop({ type: String, required: true })
  purchaseId: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;
}

export const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);
PriceHistorySchema.index({ productId: 1, date: -1 });
