import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CashRegisterSessionDocument = HydratedDocument<CashRegisterSession>;

export interface PaymentMethodSummary {
  method: string;
  methodLabel: string;
  count: number;
  amount: number;
}

export interface SessionSummary {
  totalOrders: number;
  totalAmount: number;
  totalAmountBs: number;
  byPaymentMethod: PaymentMethodSummary[];
}

@Schema({ timestamps: true, collection: 'cash_register_sessions' })
export class CashRegisterSession {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  userName: string;

  @Prop({
    required: true,
    enum: ['open', 'closed'],
    default: 'open',
    index: true,
  })
  status: 'open' | 'closed';

  @Prop({ type: Date, default: () => new Date() })
  openedAt: Date;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ type: Object, default: null })
  summary: SessionSummary | null;
}

export const CashRegisterSessionSchema =
  SchemaFactory.createForClass(CashRegisterSession);
