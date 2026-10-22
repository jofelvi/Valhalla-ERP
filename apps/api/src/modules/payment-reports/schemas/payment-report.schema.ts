import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentReportDocument = HydratedDocument<PaymentReport>;

@Schema({ timestamps: true, collection: 'paymentReports' })
export class PaymentReport {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  accountReceivableId: string;

  @Prop()
  invoiceNumber: string;

  @Prop()
  customerId: string;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  amountBs: number;

  @Prop({ required: true })
  method: string;

  @Prop()
  reference: string;

  @Prop()
  phone: string;

  @Prop()
  cedula: string;

  @Prop()
  banco: string;

  @Prop()
  destinationAccount: string;

  @Prop({ required: true })
  paidAt: Date;

  @Prop()
  notes: string;

  @Prop({ required: true })
  proofImageUrl: string;

  @Prop({
    default: 'pending_review',
    enum: ['pending_review', 'approved', 'rejected'],
  })
  status: string;

  @Prop({ default: Date.now })
  reportedAt: Date;

  @Prop()
  reviewedAt: Date;

  @Prop()
  reviewedBy: string;

  @Prop()
  rejectionReason: string;

  @Prop()
  reporterName: string;

  @Prop()
  reporterPhone: string;
}

export const PaymentReportSchema = SchemaFactory.createForClass(PaymentReport);
