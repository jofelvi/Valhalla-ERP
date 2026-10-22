'use client';
import { useMemo } from 'react';
import { Payroll } from '@odin6/types';
import { Employee } from '@odin6/types';
import { Order } from '@odin6/types';
import type { NominaConfig } from '@odin6/types';
import {
  rowNet,
  weekCommission,
  weekTips,
  staffDailyRate,
  DEFAULT_DAILY_RATE,
} from '../payrollCalc';

interface ComisionPago {
  waiterName?: string;
  waiterId?: string;
  montoTotal?: number;
  tipTotal?: number;
  bonoAsistencia?: number;
  montoNeto?: number;
  fechaPago?: string | Date;
  createdAt?: string | Date;
}

interface UseWeeklyPayrollTotalsProps {
  weekStart: Date;
  weekEnd: Date;
  employees: Employee[];
  paidEmployeeIds: Set<string>;
  weekPayrolls: Payroll[];
  comisionPagos: ComisionPago[];
  orders: Order[];
  nomina: NominaConfig;
}

export function useWeeklyPayrollTotals({
  weekStart,
  weekEnd,
  employees,
  paidEmployeeIds,
  weekPayrolls,
  comisionPagos,
  orders,
  nomina,
}: UseWeeklyPayrollTotalsProps) {
  // Totales: pagado real (de nóminas de la semana)
  const paidDias = useMemo(
    () => weekPayrolls.reduce((s, p) => s + (p.salary?.baseSalary ?? 0), 0),
    [weekPayrolls],
  );

  const paidComis = useMemo(
    () => weekPayrolls.reduce((s, p) => s + (p.salary?.commissions ?? 0), 0),
    [weekPayrolls],
  );

  const paidTips = useMemo(
    () => weekPayrolls.reduce((s, p) => s + (p.tips ?? 0), 0),
    [weekPayrolls],
  );

  const paidConsumos = useMemo(
    () => weekPayrolls.reduce((s, p) => s + (p.deductions?.other ?? 0), 0),
    [weekPayrolls],
  );

  const paidNeto = useMemo(
    () => weekPayrolls.reduce((s, p) => s + (p.netPay ?? 0), 0),
    [weekPayrolls],
  );

  // Pagos registrados en la sección de Comisiones dentro de la semana
  const weekComisionPagos = useMemo(() => {
    return comisionPagos.filter((c) => {
      const d = c.fechaPago ?? c.createdAt;
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= weekStart.getTime() && t <= weekEnd.getTime();
    });
  }, [comisionPagos, weekStart, weekEnd]);

  const comComis = useMemo(
    () => weekComisionPagos.reduce((s, c) => s + (c.montoTotal ?? 0), 0),
    [weekComisionPagos],
  );

  const comTips = useMemo(
    () => weekComisionPagos.reduce((s, c) => s + (c.tipTotal ?? 0), 0),
    [weekComisionPagos],
  );

  const comBono = useMemo(
    () => weekComisionPagos.reduce((s, c) => s + (c.bonoAsistencia ?? 0), 0),
    [weekComisionPagos],
  );

  const comNeto = useMemo(
    () =>
      weekComisionPagos.reduce(
        (s, c) => s + (c.montoNeto ?? c.montoTotal ?? 0),
        0,
      ),
    [weekComisionPagos],
  );

  // Totales combinados (nómina + comisiones)
  const totDias = useMemo(() => paidDias + comBono, [paidDias, comBono]);
  const totComis = useMemo(() => paidComis + comComis, [paidComis, comComis]);
  const totTips = useMemo(() => paidTips + comTips, [paidTips, comTips]);
  const totNeto = useMemo(() => paidNeto + comNeto, [paidNeto, comNeto]);

  // Proyectado pendiente (estimación: 7 días, sin consumos)
  const proyectadoNeto = useMemo(() => {
    return employees
      .filter((e) => !paidEmployeeIds.has(e.id))
      .reduce((s, e) => {
        const isWaiter =
          /waiter/i.test(String(e.position ?? '')) ||
          /mesonero/i.test(
            String((e as { department?: string }).department ?? ''),
          );

        // Órdenes del mesonero en la semana mostrada
        const weekOrders = isWaiter
          ? orders
              .filter((o) => o.waiterId === e.id)
              .filter((o) => {
                const t = new Date(o.createdAt as string | Date).getTime();
                return t >= weekStart.getTime() && t <= weekEnd.getTime();
              })
          : [];

        const earnings = isWaiter
          ? 7 * DEFAULT_DAILY_RATE
          : staffDailyRate(e.salary) * 7;
        const com = isWaiter ? weekCommission(weekOrders, nomina) : 0;
        const tip = isWaiter ? weekTips(weekOrders) : 0;
        return (
          s + rowNet({ earnings, commissions: com, tips: tip, consumos: 0 })
        );
      }, 0);
  }, [employees, paidEmployeeIds, orders, weekStart, weekEnd, nomina]);

  return {
    paidDias,
    paidComis,
    paidTips,
    paidConsumos,
    paidNeto,
    comComis,
    comTips,
    comBono,
    comNeto,
    totDias,
    totComis,
    totTips,
    totNeto,
    proyectadoNeto,
  };
}
