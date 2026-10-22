import { useState, useEffect } from 'react';
import { Employee, NominaConfig } from '@odin6/types';
import { WaiterShare } from '@odin6/types';
import {
  staffDailyRate,
  DEFAULT_DAILY_RATE,
  weekCommission,
  weekTips,
} from '../payrollCalc';

interface WaiterOrder {
  id: string;
  comisionBase?: number;
  tipAmount?: number;
  createdAt?: string | Date;
  waiterShares?: WaiterShare[];
}

interface EmployeeEarningsState {
  daysWorked: number;
  setDaysWorked: (value: number) => void;
  waiterRate: number;
  setWaiterRate: (value: number) => void;
  dailyRate: number;
  earnings: number;
  commissions: number;
  tips: number;
}

export function useEmployeeEarnings(
  employee: Employee,
  isWaiter: boolean,
  waiterOrders: WaiterOrder[],
  defaultDays: number,
  nomina: NominaConfig,
): EmployeeEarningsState {
  const staffRate = staffDailyRate(employee.salary);
  const [daysWorked, setDaysWorked] = useState<number>(defaultDays);
  const [waiterRate, setWaiterRate] = useState<number>(DEFAULT_DAILY_RATE);
  const dailyRate = isWaiter ? waiterRate : staffRate;

  // Re-sync default when defaultDays changes
  useEffect(() => {
    setDaysWorked(defaultDays);
  }, [defaultDays]);

  const earnings = Math.round(daysWorked * dailyRate * 100) / 100;
  const commissions = isWaiter
    ? weekCommission(waiterOrders, nomina, employee.userId)
    : 0;
  const tips = isWaiter ? weekTips(waiterOrders, employee.userId) : 0;

  return {
    daysWorked,
    setDaysWorked,
    waiterRate,
    setWaiterRate,
    dailyRate,
    earnings,
    commissions,
    tips,
  };
}
