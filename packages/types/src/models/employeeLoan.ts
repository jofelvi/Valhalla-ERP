export type EmployeeLoanStatus =
  | 'pending'
  | 'partial'
  | 'deducted'
  | 'cancelled';

export interface PaymentHistoryEntry {
  amount: number;
  payrollId?: string;
  date?: string | Date;
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  amount: number; // USD
  concept: string;
  bcvRateAtLoan?: number;
  status: EmployeeLoanStatus;
  grantedBy?: string;
  paidAmount?: number; // Monto abonado acumulado
  paymentHistory?: PaymentHistoryEntry[]; // Histórico de abonos
  deductedPayrollId?: string;
  deductedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}
