import { useState, useEffect } from 'react';
import { PayrollAdjustment } from '@odin6/types';
import {
  usePendingLoansByEmployee,
  useAbonoEmployeeLoan,
} from '@/hooks/useEmployeeLoans';

interface EmployeeLoans {
  id: string;
  concept: string;
  amount: number;
  paidAmount?: number;
  createdAt: string | Date;
}

interface LoanPaymentsState {
  pendingLoans: EmployeeLoans[];
  loanAbonoMap: Map<string, number>;
  setLoanAbonoMap: (value: Map<string, number>) => void;
  selectedLoans: EmployeeLoans[];
  loanAdjustments: PayrollAdjustment[];
  abonoLoan: ReturnType<typeof useAbonoEmployeeLoan>;
}

export function useLoanPayments(employeeId: string): LoanPaymentsState {
  const { data: pendingLoans = [] } = usePendingLoansByEmployee(employeeId);
  const abonoLoan = useAbonoEmployeeLoan();
  const [loanAbonoMap, setLoanAbonoMap] = useState<Map<string, number>>(
    new Map(),
  );

  // Initialize all pending loans with their full balance
  const pendingLoansKey = pendingLoans.map((l) => l.id).join(',');
  useEffect(() => {
    const newMap = new Map<string, number>();
    for (const loan of pendingLoans) {
      const saldo = loan.amount - (loan.paidAmount ?? 0);
      newMap.set(loan.id, saldo);
    }
    setLoanAbonoMap(newMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLoansKey]);

  const selectedLoans = pendingLoans.filter((l) => loanAbonoMap.has(l.id));

  const loanAdjustments: PayrollAdjustment[] = selectedLoans
    .map((l): PayrollAdjustment | null => {
      const abono = loanAbonoMap.get(l.id);
      if (!abono || abono <= 0) return null;
      return {
        type: 'DEDUCTION' as const,
        concept:
          abono < l.amount - (l.paidAmount ?? 0)
            ? `Abono préstamo: ${l.concept}`
            : `Préstamo: ${l.concept}`,
        amount: abono,
        currency: 'USD' as const,
        amountUsd: abono,
      };
    })
    .filter((a): a is PayrollAdjustment => a !== null);

  return {
    pendingLoans,
    loanAbonoMap,
    setLoanAbonoMap,
    selectedLoans,
    loanAdjustments,
    abonoLoan,
  };
}
