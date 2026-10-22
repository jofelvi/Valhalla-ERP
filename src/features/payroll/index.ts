// Main component
export { default as WeeklyPayrollTable } from './WeeklyPayrollTable';

// Hooks
export { useWeeklyPayrollData } from './hooks/useWeeklyPayrollData';
export { useWeeklyPayrollTotals } from './hooks/useWeeklyPayrollTotals';
export { useEmployeeEarnings } from './hooks/useEmployeeEarnings';
export { useEmployeeConsumptions } from './hooks/useEmployeeConsumptions';
export { usePayrollAdjustments } from './hooks/usePayrollAdjustments';
export { useLoanPayments } from './hooks/useLoanPayments';
export { useExternalAccounts } from './hooks/useExternalAccounts';

// Components
export { PayrollHeader } from './components/PayrollHeader';
export { PayrollTableHead } from './components/PayrollTableHead';
export { PayrollTableBody } from './components/PayrollTableBody';
export { PayrollTotalsSection } from './components/PayrollTotalsSection';

// Utils
export { getWeekRange, norm } from './utils/weekRange';
export { formatUSD, formatBs } from './utils/formatters';

// Calculations
export {
  rowNet,
  payrollSettlement,
  weekCommission,
  weekTips,
  staffDailyRate,
} from './payrollCalc';

// PDF
export { generarPdfNomina, type FilaNominaPdf } from './payrollPdf';

// Helper functions
export {
  findUserForEmployee,
  isWaiterEmployee,
  ordersForEmployee,
} from './waiterMatching';
