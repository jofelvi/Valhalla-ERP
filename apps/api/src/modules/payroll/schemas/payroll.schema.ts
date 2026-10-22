import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PayrollDocument = HydratedDocument<Payroll>;

@Schema({ timestamps: true, collection: 'payrolls' })
export class Payroll {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({
    type: {
      startDate: Date,
      endDate: Date,
      month: Number,
      year: Number,
    },
  })
  period: {
    startDate: Date;
    endDate: Date;
    month: number;
    year: number;
  };

  @Prop({
    type: {
      baseSalary: Number,
      overtime: Number,
      bonuses: Number,
      commissions: Number,
    },
  })
  salary: {
    baseSalary: number;
    overtime: number;
    bonuses: number;
    commissions: number;
  };

  @Prop({
    type: {
      taxes: Number,
      socialSecurity: Number,
      insurance: Number,
      other: Number,
    },
  })
  deductions: {
    taxes: number;
    socialSecurity: number;
    insurance: number;
    other: number;
  };

  @Prop()
  netPay: number;

  @Prop()
  grossPay: number;

  @Prop()
  hoursWorked: number;

  @Prop()
  overtimeHours: number;

  @Prop({
    default: 'draft',
    enum: ['draft', 'approved', 'paid', 'cancelled'],
  })
  status: string;

  @Prop()
  paymentDate: Date;

  @Prop()
  notes: string;

  @Prop()
  proofUrl?: string;

  @Prop()
  daysWorked?: number;

  @Prop()
  dailyRate?: number;

  @Prop()
  tips?: number;

  @Prop({ type: String, enum: ['WAITER', 'STAFF'] })
  kind?: 'WAITER' | 'STAFF';

  @Prop([String])
  paidOrderIds?: string[];

  // Quien ejecuto la liquidacion. Lo escribe el backend desde el JWT (no viene
  // del body) para que toda nomina quede con responsable y hora.
  @Prop({ type: { userId: String, email: String } })
  createdBy?: { userId: string; email: string };

  @Prop([
    {
      accountReceivableId: String,
      amount: Number,
      description: String,
    },
  ])
  expenseDeductions?: Array<{
    accountReceivableId: string;
    amount: number;
    description: string;
  }>;

  // Ajustes manuales al pago: prestamos (deduccion), propinas por fuera (adicion), etc.
  // amount es el monto en la moneda ingresada; amountUsd es el equivalente en USD
  // (a la tasa BCV del momento del pago) que se usa en el calculo del neto.
  @Prop([
    {
      type: { type: String, enum: ['ADDITION', 'DEDUCTION'] },
      concept: String,
      amount: Number,
      currency: { type: String, enum: ['USD', 'BS'] },
      amountUsd: Number,
    },
  ])
  adjustments?: Array<{
    type: 'ADDITION' | 'DEDUCTION';
    concept: string;
    amount: number;
    currency: 'USD' | 'BS';
    amountUsd: number;
  }>;
}

export const PayrollSchema = SchemaFactory.createForClass(Payroll);
