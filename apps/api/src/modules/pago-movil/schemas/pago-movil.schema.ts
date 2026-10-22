import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PagoMovilDocument = HydratedDocument<PagoMovil>;

@Schema({ timestamps: true, collection: 'pagoMoviles' })
export class PagoMovil {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true, index: true })
  referenceNumber: string;

  @Prop()
  cedulaPagador?: string;

  @Prop()
  bancoOrigen?: string;

  @Prop()
  fechaPago?: string;

  @Prop()
  expectedAmount?: number;

  @Prop()
  expectedAmountBS?: number;

  @Prop()
  expectedAmountUSD?: number;

  @Prop()
  actualAmount?: number;

  @Prop()
  actualAmountUSD?: number;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ default: 'pending' })
  status?: string;

  @Prop()
  verificationDate?: Date;

  @Prop()
  errorMessage?: string;

  @Prop()
  bcvRate?: number;
}

export const PagoMovilSchema = SchemaFactory.createForClass(PagoMovil);
