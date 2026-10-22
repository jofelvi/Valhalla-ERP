import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type ExpenseKind = 'INSUMOS' | 'GENERAL';
export type ExpenseCurrency = 'BS' | 'USD';
export type FundsSource = 'EMPRESA' | 'PROPIOS';
export type ExpensePaymentStatus = 'PAID' | 'CREDIT';

@Schema({ _id: false })
export class ExpenseRegisteredBy {
  @Prop({ type: Number }) telegramId?: number;
  @Prop({ type: String, required: true }) socio: string;
  @Prop({ type: String }) userId?: string;
}
const ExpenseRegisteredBySchema =
  SchemaFactory.createForClass(ExpenseRegisteredBy);

/**
 * Libro de egresos. Es el registro FINANCIERO de lo que sale: el inventario
 * sigue viviendo en `purchases` (que se enlaza por `purchaseId`) y aqui va lo
 * que el inventario no sabe — quien puso la plata, si fue contado o credito,
 * y a que semana de que socio pertenece.
 */
@Schema({ collection: 'expenses', timestamps: true })
export class Expense {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true, enum: ['INSUMOS', 'GENERAL'] })
  kind: ExpenseKind;

  /**
   * A quien va el gasto cuando es de personal (prestamo, sueldo, bono). Sin
   * esto un prestamo queda sin dueño y no hay a quien cobrarselo.
   *
   * Faltaron aqui en 1.6.0 aunque el servicio ya los mandaba: Mongoose DESCARTA
   * en silencio lo que no esta en el esquema, y el primer prestamo real
   * (Emanuel, Bs 12.711,66, 17/09/2026) se guardo sin el vinculo al empleado.
   */
  @Prop({ type: String, index: true })
  employeeId?: string;

  @Prop({ type: String })
  employeeName?: string;

  @Prop({ type: String, required: true, index: true })
  category: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, index: true })
  supplierId?: string;

  @Prop({ type: String })
  supplierName?: string;

  /** Moneda de la factura. Se guardan ambas cifras para no recalcular nunca. */
  @Prop({ type: String, required: true, enum: ['BS', 'USD'] })
  currency: ExpenseCurrency;

  @Prop({ type: Number, required: true }) amountBs: number;
  @Prop({ type: Number, required: true }) amountUsd: number;
  @Prop({ type: Number, required: true }) exchangeRate: number;

  /** Vacio mientras es credito: nadie ha puesto la plata todavia. */
  @Prop({ type: String, enum: ['EMPRESA', 'PROPIOS'], index: true })
  fundsSource?: FundsSource;

  /** Socio que pago de su bolsillo (solo si PROPIOS). */
  @Prop({ type: String })
  paidBy?: string;

  @Prop({ type: String, required: true, enum: ['PAID', 'CREDIT'], index: true })
  paymentStatus: ExpensePaymentStatus;

  @Prop({ type: Date }) paidAt?: Date;
  @Prop({ type: Date }) reimbursedAt?: Date;
  @Prop({ type: String }) reimbursedBy?: string;

  @Prop({ type: String, index: true })
  purchaseId?: string;

  @Prop({ type: [String], default: [] })
  invoiceUrls: string[];

  @Prop({ type: String })
  ocrText?: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  /** Martes 6am VE de la semana de negocio. Se calcula al guardar. */
  @Prop({ type: Date, required: true, index: true })
  weekStart: Date;

  @Prop({ type: String, required: true })
  socioTurno: string;

  @Prop({ type: ExpenseRegisteredBySchema, required: true })
  registeredBy: ExpenseRegisteredBy;

  @Prop({ type: String, required: true, enum: ['telegram', 'web'] })
  source: 'telegram' | 'web';

  @Prop({ type: String })
  notes?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
export type ExpenseDocument = HydratedDocument<Expense>;
export type ExpenseLean = Expense & { createdAt?: Date; updatedAt?: Date };
