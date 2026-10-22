'use client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee, NominaConfig } from '@odin6/types';
import { Payroll } from '@odin6/types';
import { Order } from '@odin6/types';
import { User } from '@odin6/types';
import WeeklyPayrollRow, { PaidBreakdown } from '../WeeklyPayrollRow';
import {
  findUserForEmployee,
  isWaiterEmployee,
  ordersForEmployee,
} from '../waiterMatching';
import { distinctOrderDays } from '../payrollCalc';

interface PayrollTableBodyProps {
  employees: Employee[];
  loadingEmployees: boolean;
  users: User[];
  orders: Order[];
  weekStart: Date;
  weekEnd: Date;
  weekStart1W: Date;
  weekEnd1W: Date;
  nomina: NominaConfig;
  bcvRate: number;
  paidByEmployee: Map<string, number>;
  payrollByEmployee: Map<string, Payroll>;
  paidEmployeeIds: Set<string>;
  bonoPizzeroData: Map<string, { total: number; resumen: string } | null>;
  diasAsistenciaData: Map<string, number | null>;
  _allAsistencias?: Array<{
    employeeId?: string;
    userId?: string;
    date?: string;
  }>;
  onPaid: (id: string, net: number, breakdown: PaidBreakdown) => void;
}

export function PayrollTableBody({
  employees,
  loadingEmployees,
  users,
  orders,
  weekStart,
  weekEnd,
  weekStart1W,
  weekEnd1W,
  nomina,
  bcvRate,
  paidByEmployee,
  payrollByEmployee,
  paidEmployeeIds,
  bonoPizzeroData,
  diasAsistenciaData,
  onPaid,
}: PayrollTableBodyProps) {
  if (loadingEmployees) {
    return (
      <tbody>
        <tr>
          <td colSpan={8} className="px-4 py-16 text-center text-dim text-sm">
            Cargando empleados...
          </td>
        </tr>
      </tbody>
    );
  }

  if (employees.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={8} className="px-4 py-16 text-center text-dim text-sm">
            No hay empleados activos
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {employees.map((emp) => {
        const user = findUserForEmployee(emp, users);
        const isWaiter = isWaiterEmployee(emp, user);
        const wOrders = ordersForEmployee(emp, orders, user);

        // Días sugeridos: días distintos con órdenes DENTRO de la semana mostrada
        const weekOrders = isWaiter
          ? wOrders.filter((o) => {
              const t = new Date(o.createdAt as string | Date).getTime();
              return t >= weekStart.getTime() && t <= weekEnd.getTime();
            })
          : [];

        const asistidos = diasAsistenciaData.get(emp.id) ?? null;

        // Defaults de días
        const sinNingunFichaje = asistidos === null || asistidos === 0;
        const defaultDays = isWaiter
          ? Math.min(7, Math.max(0, distinctOrderDays(weekOrders)))
          : sinNingunFichaje
            ? 7
            : Math.min(7, asistidos ?? 0);

        const semanaAsistenciaLabel = `${format(weekStart1W, 'd', {
          locale: es,
        })}-${format(new Date(weekEnd1W.getTime() - 1), 'd MMM', {
          locale: es,
        })}`;

        return (
          <WeeklyPayrollRow
            key={emp.id}
            employee={emp}
            customerIds={
              Array.from(
                new Set(employees.map((e) => e.customerId).filter(Boolean)),
              ) as string[]
            }
            isWaiter={isWaiter}
            waiterOrders={wOrders}
            defaultDays={defaultDays}
            bonoPizzero={bonoPizzeroData.get(emp.id) ?? null}
            diasAsistencia={asistidos}
            semanaAsistencia={semanaAsistenciaLabel}
            nomina={nomina}
            weekStart={weekStart}
            weekEnd={weekEnd}
            bcvRate={bcvRate}
            paidAmount={paidByEmployee.get(emp.id) ?? 0}
            onPaid={onPaid}
            alreadyPaid={paidEmployeeIds.has(emp.id)}
            weekPayroll={payrollByEmployee.get(emp.id)}
          />
        );
      })}
    </tbody>
  );
}
