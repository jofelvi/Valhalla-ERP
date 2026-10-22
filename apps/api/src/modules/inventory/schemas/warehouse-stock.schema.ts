import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { BaseUnit } from '../units';

export type WarehouseStockDocument = HydratedDocument<WarehouseStock>;

// Snapshot incremental: suma viva del ledger por (almacén, insumo).
// Reconstruible en cualquier momento con MovementsService.reconcile().
@Schema({ timestamps: true, collection: 'warehouse_stocks' })
export class WarehouseStock {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  warehouseId: string;

  @Prop({ required: true })
  productId: string;

  @Prop({ default: 0 })
  qty: number; // en unidad base

  @Prop({ required: true, enum: ['GR', 'ML', 'UND'], type: String })
  baseUnit: BaseUnit;
}

export const WarehouseStockSchema =
  SchemaFactory.createForClass(WarehouseStock);
WarehouseStockSchema.index({ warehouseId: 1, productId: 1 }, { unique: true });
