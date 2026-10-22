import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import type { BaseUnit } from '../units';

export type ShoppingListDocument = HydratedDocument<ShoppingList>;

@Schema({ _id: false })
export class ShoppingListItem {
  @Prop({ type: String, required: true })
  productId: string;

  @Prop({ type: String, required: true })
  productName: string;

  @Prop({ type: Number, required: true })
  suggestedQty: number; // en baseUnit

  @Prop({ type: Number })
  adjustedQty?: number; // en baseUnit (aprobador puede ajustar)

  @Prop({ type: String, required: true, enum: ['GR', 'ML', 'UND'] })
  unit: BaseUnit;

  @Prop({
    type: String,
    required: true,
    enum: ['CONSUMO_PROMEDIO', 'BAJO_MINIMO', 'MANUAL'],
  })
  reason: string;

  @Prop({ type: Number })
  lastCost?: number; // costPerBase último

  @Prop({ type: Boolean, default: false })
  purchased: boolean;

  @Prop({ type: Boolean, default: false })
  discarded: boolean;

  @Prop({ type: String })
  purchaseId?: string;

  @Prop({ type: String, enum: ['COCINA', 'PIZZERIA', 'BARRA', 'GENERAL'] })
  proposedByStation?: string;
}
const ShoppingListItemSchema = SchemaFactory.createForClass(ShoppingListItem);

@Schema({ collection: 'shopping_lists', timestamps: true })
export class ShoppingList {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: Date, required: true, index: true })
  weekStart: Date;

  @Prop({ type: Date, required: true })
  weekEnd: Date;

  @Prop({
    type: String,
    required: true,
    enum: ['PROPUESTA', 'APROBADA', 'CERRADA'],
    default: 'PROPUESTA',
  })
  status: string;

  @Prop({ type: [ShoppingListItemSchema], default: [] })
  items: ShoppingListItem[];

  @Prop({ type: [String], default: [] })
  proposedBy: string[]; // usuarios que propusieron items

  @Prop({ type: String })
  approvedBy?: string; // usuario que aprobó

  @Prop({ type: Array, default: null })
  aiPlanByPlace?: unknown | null; // plan agrupado por lugar (array de grupos)

  @Prop({ type: String, default: null })
  aiSummary?: string | null; // narrativa DeepSeek

  @Prop({ type: String, default: null })
  aiError?: string | null; // error al generar plan IA

  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt: Date;
}

export const ShoppingListSchema = SchemaFactory.createForClass(ShoppingList);
