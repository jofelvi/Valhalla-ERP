import { PayrollStatusEnum } from '@/shared';

export interface PayrollAdjustment {
  type: 'ADDITION' | 'DEDUCTION';
  concept: string;
  amount: number;
  currency: 'USD' | 'BS';
  amountUsd: number;
}

export interface Payroll {
  id: string;
  employeeId: string;
  period: {
    startDate: Date;
    endDate: Date;
    month: number;
    year: number;
  };
  salary: {
    baseSalary: number;
    overtime: number;
    bonuses: number;
    commissions: number;
  };
  deductions: {
    taxes: number;
    socialSecurity: number;
    insurance: number;
    other: number;
  };
  netPay: number;
  grossPay: number;
  hoursWorked: number;
  overtimeHours: number;
  status: PayrollStatusEnum;
  paymentDate?: Date;
  notes?: string;
  proofUrl?: string;
  expenseDeductions?: Array<{
    accountReceivableId: string;
    amount: number;
    description: string;
  }>;
  daysWorked?: number;
  dailyRate?: number;
  tips?: number;
  kind?: 'WAITER' | 'STAFF';
  paidOrderIds?: string[];
  adjustments?: PayrollAdjustment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePayrollData {
  employeeId: string;
  period: {
    startDate: Date;
    endDate: Date;
    month: number;
    year: number;
  };
  salary: {
    baseSalary: number;
    overtime?: number;
    bonuses?: number;
    commissions?: number;
  };
  deductions?: {
    taxes?: number;
    socialSecurity?: number;
    insurance?: number;
    other?: number;
  };
  hoursWorked: number;
  overtimeHours?: number;
  notes?: string;
  // Campos calculados que la creacion tambien envia (el backend los persiste).
  grossPay?: number;
  netPay?: number;
  status?: PayrollStatusEnum;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PayrollCalculation {
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  period: {
    month: number;
    year: number;
    startDate: Date;
    endDate: Date;
  };
  baseSalary: number;
  hoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  overtimeRate: number;
  salary: {
    baseSalary: number;
    overtime: number;
    bonuses: number;
    commissions: number;
  };
  grossPay: number;
  deductions: {
    taxes: number;
    socialSecurity: number;
    insurance: number;
    other: number;
  };
  totalDeductions: number;
  netPay: number;
  attendanceSummary: {
    workingDays: number;
    presentDays: number;
    absentDays: number;
    attendanceRate: number;
  };
}

export interface PayrollSummary {
  totalEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalOvertimeHours: number;
  averageSalary: number;
  payrollStatus: PayrollStatusEnum;
  period: {
    month: number;
    year: number;
  };
  departmentBreakdown: Array<{
    department: string;
    employeeCount: number;
    totalGrossPay: number;
    totalNetPay: number;
  }>;
}

export interface PayrollReport {
  employee: {
    id: string;
    name: string;
    position: string;
    department: string;
    hireDate: Date;
  };
  period: {
    month: number;
    year: number;
    startDate: Date;
    endDate: Date;
  };
  payroll: PayrollCalculation;
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    totalHours: number;
    overtimeHours: number;
  };
  previousPayroll?: {
    grossPay: number;
    netPay: number;
    change: number;
    changePercentage: number;
  };
}

export interface PayrollSettings {
  taxRate: number; // percentage
  socialSecurityRate: number; // percentage
  insuranceRate: number; // percentage
  overtimeRate: number; // multiplier (e.g., 1.5)
  standardWorkHours: number; // per day
  workingDaysPerMonth: number;
  minimumWage: number;
  vacationDaysPay: boolean;
  holidayPay: boolean;
}
