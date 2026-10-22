import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BudgetDocument = HydratedDocument<Budget>;

@Schema({ timestamps: true, collection: 'budgets' })
export class Budget {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  budgetNumber: string;

  @Prop({ required: true })
  customerName: string;

  @Prop()
  customerPhone: string;

  @Prop()
  customerEmail: string;

  // Datos fiscales del cliente (para reusar al generar factura fiscal)
  @Prop()
  customerRif?: string;

  @Prop()
  customerIdType?: string; // V, E, J, G, P

  @Prop()
  customerAddress?: string;

  @Prop()
  customerType?: string; // contribuyente_ordinario | contribuyente_formal | no_contribuyente

  @Prop({ required: true })
  eventName: string;

  @Prop()
  eventDate: Date;

  @Prop()
  eventGuests: number;

  @Prop([
    {
      productId: String,
      name: String,
      description: String,
      quantity: Number,
      unitPrice: Number,
      total: Number,
    },
  ])
  items: Array<{
    productId: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;

  @Prop()
  subtotal: number;

  @Prop()
  serviceCharge: number;

  @Prop()
  tax: number;

  @Prop()
  discountType: string;

  @Prop()
  discountValue: number;

  @Prop()
  discount: number;

  @Prop()
  total: number;

  @Prop()
  notes: string;

  @Prop({
    default: 'draft',
    enum: ['draft', 'sent', 'approved', 'rejected', 'expired'],
  })
  status: string;

  @Prop()
  validUntil: Date;

  @Prop({ required: true })
  createdBy: string;

  // Una vez generada la factura fiscal desde este presupuesto, se guarda
  // el id de la Invoice creada para evitar duplicar y mostrar "Ver factura".
  @Prop()
  invoiceId?: string;

  @Prop()
  abonoAmount?: number;

  @Prop()
  abonoMethod?: string;

  @Prop()
  abonoReference?: string;

  @Prop()
  abonoDate?: Date;

  @Prop()
  accountReceivableId?: string;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
