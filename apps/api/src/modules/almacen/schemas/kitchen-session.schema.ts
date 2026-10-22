import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type KitchenSessionDocument = HydratedDocument<KitchenSession>;

export interface StockItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
}

export interface MidPull {
  productId: string;
  productName: string;
  quantity: number;
  at: Date;
  by: string;
}

export interface WasteItem {
  productId: string;
  productName: string;
  expected: number;
  actual: number;
  difference: number;
}

@Schema({ timestamps: true, collection: 'kitchen_sessions' })
export class KitchenSession {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  openedAt: Date;

  @Prop({ required: true })
  openedBy: string;

  @Prop()
  closedAt?: Date;

  @Prop()
  closedBy?: string;

  @Prop({ enum: ['open', 'closed'], default: 'open' })
  status: string;

  @Prop({ type: [Object], default: [] })
  initialStock: StockItem[];

  @Prop({ type: [Object], default: [] })
  midPulls: MidPull[];

  @Prop({ type: [Object], default: [] })
  physicalCount: StockItem[];

  @Prop({ type: [Object], default: [] })
  waste: WasteItem[];
}

export const KitchenSessionSchema =
  SchemaFactory.createForClass(KitchenSession);
