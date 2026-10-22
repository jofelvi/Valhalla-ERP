import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { BaseUnit } from '../units';

export type InventoryCountDocument = HydratedDocument<InventoryCount>;

export interface CountItemResult {
  productId: string;
  productName: string;
  systemQty: number; // en unidad base, antes del conteo
  countedQty: number; // en unidad base
  diff: number; // counted - system
  baseUnit?: BaseUnit; // unidad de systemQty/countedQty/diff (los conteos viejos no la traen)
  unitCost: number;
  diffCost: number;
}

@Schema({ timestamps: true, collection: 'inventory_counts' })
export class InventoryCount {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  warehouseId: string;

  @Prop({
    required: true,
    type: String,
    enum: ['DIARIO', 'SEMANAL', 'INICIAL'],
  })
  type: 'DIARIO' | 'SEMANAL' | 'INICIAL';

  @Prop({ type: [Object], default: [] })
  items: CountItemResult[];

  @Prop({ default: 0 })
  totalDiffCost: number;

  @Prop({ required: true })
  countedBy: string;

  @Prop()
  confirmedAt: Date;
}

export const InventoryCountSchema =
  SchemaFactory.createForClass(InventoryCount);
