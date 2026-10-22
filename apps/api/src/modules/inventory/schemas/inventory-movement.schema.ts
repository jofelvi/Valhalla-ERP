import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { BaseUnit } from '../units';

export type InventoryMovementDocument = HydratedDocument<InventoryMovement>;

export const MOVEMENT_TYPES = [
  'COMPRA',
  'TRASLADO',
  'CONSUMO_VENTA',
  'CONTEO_AJUSTE',
  'CONTEO_INICIAL',
  'MERMA_DECLARADA',
  'ANULACION',
  // La estación elaboró algo (masas, salsa, porciones): entra el elaborado...
  'PRODUCCION',
  // ...y sale el crudo que se uso. Separado de CONSUMO_VENTA para que el food
  // cost distinga lo que se transformo de lo que se vendio.
  'CONSUMO_PRODUCCION',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

@Schema({ timestamps: true, collection: 'inventory_movements' })
export class InventoryMovement {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, enum: MOVEMENT_TYPES, type: String })
  type: MovementType;

  @Prop({ required: true, index: true })
  warehouseId: string;

  @Prop({ required: true, index: true })
  productId: string;

  // + entra / − sale, SIEMPRE en unidad base del insumo
  @Prop({ required: true })
  qty: number;

  @Prop({ required: true, enum: ['GR', 'ML', 'UND'], type: String })
  baseUnit: BaseUnit;

  @Prop({ default: 0 })
  unitCost: number; // costo por unidad base al momento del movimiento

  @Prop({ default: 0 })
  totalCost: number; // qty * unitCost (con signo)

  @Prop({ type: String })
  refType?: 'order' | 'purchase' | 'count' | 'waste' | 'transfer' | 'movement';

  @Prop({ index: true })
  refId?: string;

  // Item concreto de la orden que originó el consumo. Rastreo del descuento
  // "en vivo" al entregar: permite auditar en el kardex qué entrega emitió
  // cada movimiento. Solo presente en CONSUMO_VENTA por item.
  @Prop()
  refItemId?: string;

  @Prop()
  counterpartWarehouseId?: string; // en TRASLADO: el otro almacén

  @Prop()
  notes?: string;

  @Prop({ required: true })
  userId: string;
}

export const InventoryMovementSchema =
  SchemaFactory.createForClass(InventoryMovement);
InventoryMovementSchema.index({ warehouseId: 1, productId: 1, createdAt: -1 });
