import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupplierDocument = HydratedDocument<Supplier>;

interface Contact {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  isPrimaryContact?: boolean;
  isDeliveryContact?: boolean;
}

interface PaymentInfo {
  preferredPaymentMethod?: string;
  paymentTerms?: string;
  creditLimit?: number;
  taxId?: string;
  bankAccount?: string;
  bankName?: string;
}

@Schema({ timestamps: true, collection: 'suppliers' })
export class Supplier {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  contactName?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  address?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  productIds?: string[];

  @Prop({ type: [Object], default: [] })
  contacts?: Contact[];

  @Prop({ type: Object })
  paymentInfo?: PaymentInfo;

  @Prop()
  website?: string;

  @Prop()
  notes?: string;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
