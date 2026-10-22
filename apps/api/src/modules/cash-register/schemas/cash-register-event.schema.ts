import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CashRegisterEventDocument = HydratedDocument<CashRegisterEvent>;

export type CashRegisterEventType =
  | 'session_opened'
  | 'session_closed'
  | 'order_created'
  | 'payment_processed'
  | 'table_freed'
  | 'comanda_printed';

@Schema({ timestamps: true, collection: 'cash_register_events' })
export class CashRegisterEvent {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, index: true })
  sessionId: string;

  @Prop({ required: true })
  type: CashRegisterEventType;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, default: null })
  orderId: string | null;

  @Prop({ type: Number, default: null })
  amount: number | null;

  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;
}

export const CashRegisterEventSchema =
  SchemaFactory.createForClass(CashRegisterEvent);
