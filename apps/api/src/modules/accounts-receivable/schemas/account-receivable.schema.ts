import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AccountReceivableDocument = HydratedDocument<AccountReceivable>;

@Schema({ timestamps: true, collection: 'accountReceivables' })
export class AccountReceivable {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop()
  customerId?: string;

  @Prop({ required: true })
  customerName: string;

  @Prop()
  orderId: string;

  @Prop({ required: true })
  invoiceNumber: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 0 })
  paidAmount: number;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ default: 'pending' })
  status: string;

  @Prop()
  description: string;

  @Prop()
  isMerged: boolean;

  @Prop()
  mergedIntoId: string;

  @Prop()
  isConsolidated: boolean;

  @Prop([String])
  mergedAccountIds: string[];

  @Prop([String])
  mergedOrderIds: string[];

  @Prop()
  lastNotificationAt: Date;

  @Prop()
  lastNotificationChannel: string;

  // ─── Auditoria del cobro ───
  // Quien y como se salda la cuenta. El backend lo escribe desde el JWT en
  // cada PATCH que toca paidAmount o status: el cliente no puede falsearlo.
  // CASH    = cobro en caja (registra tambien un Payment)
  // PAYROLL = descontado de la nomina del trabajador
  // MANUAL  = editado a mano desde la ficha de la cuenta
  @Prop({ type: String, enum: ['CASH', 'PAYROLL', 'MANUAL'] })
  settlementSource?: 'CASH' | 'PAYROLL' | 'MANUAL';

  @Prop()
  settledByUserId?: string;

  @Prop()
  settledByEmail?: string;

  @Prop()
  settledAt?: Date;

  // Nomina en la que se descontó (cuando settlementSource === 'PAYROLL')
  @Prop()
  settlementPayrollId?: string;

  @Prop()
  budgetId?: string;

  // ─── Auditoria de consolidacion ───
  // Quien hizo la consolidacion (cuando isConsolidated === true)
  @Prop()
  consolidatedByUserId?: string;

  @Prop()
  consolidatedByUserEmail?: string;

  @Prop()
  consolidatedByUserName?: string;

  @Prop()
  consolidatedAt?: Date;

  // Numero de secuencia para detectar duplicados
  @Prop()
  consolidationSequence?: number;
}

export const AccountReceivableSchema =
  SchemaFactory.createForClass(AccountReceivable);
