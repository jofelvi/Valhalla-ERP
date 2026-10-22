import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmployeeLoanDocument = HydratedDocument<EmployeeLoan>;

// Prestamo a empleado. Siempre en USD; se descuenta en la nomina semanal.
@Schema({ timestamps: true, collection: 'employee_loans' })
export class EmployeeLoan {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  amount: number; // USD

  @Prop({ required: true })
  concept: string;

  @Prop()
  bcvRateAtLoan?: number; // tasa BCV al momento de otorgarlo (referencial)

  // Total abonado hasta ahora (USD). El saldo pendiente = amount - paidAmount.
  @Prop({ default: 0 })
  paidAmount: number;

  // Histórico de abonos parciales (uno por semana de nómina que descontó algo)
  @Prop({
    type: [
      {
        _id: false,
        amount: Number,
        payrollId: String,
        date: Date,
      },
    ],
    default: [],
  })
  paymentHistory: Array<{ amount: number; payrollId?: string; date: Date }>;

  @Prop({
    default: 'pending',
    // pending: sin abonos · partial: abonos pero queda saldo · deducted: saldado
    enum: ['pending', 'partial', 'deducted', 'cancelled'],
  })
  status: string;

  @Prop()
  grantedBy?: string; // usuario que registro el prestamo

  @Prop()
  deductedPayrollId?: string; // pago de nomina donde se salido por completo

  @Prop()
  deductedAt?: Date;

  @Prop()
  notes?: string;
}

export const EmployeeLoanSchema = SchemaFactory.createForClass(EmployeeLoan);
