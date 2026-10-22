'use client';
import { useState, useMemo } from 'react';
import { addWeeks, subWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generarPdfNomina, type FilaNominaPdf } from './payrollPdf';
import { Employee } from '@odin6/types';
import { PaidBreakdown } from './WeeklyPayrollRow';
import { findUserForEmployee } from './waiterMatching';
import { getWeekRange, norm } from './utils/weekRange';
import { useWeeklyPayrollData } from './hooks/useWeeklyPayrollData';
import { useNominaConfig } from './hooks/useNominaConfig';
import { useNombreApp } from '@/shared/config';
import { useWeeklyPayrollTotals } from './hooks/useWeeklyPayrollTotals';
import { PayrollHeader } from './components/PayrollHeader';
import { PayrollTableHead } from './components/PayrollTableHead';
import { PayrollTableBody } from './components/PayrollTableBody';
import { PayrollTotalsSection } from './components/PayrollTotalsSection';

export default function WeeklyPayrollTable() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [paidThisSession, setPaidThisSession] = useState<Set<string>>(
    new Set(),
  );
  const nomina = useNominaConfig();
  const nombreNegocio = useNombreApp();

  const { start: weekStart, end: weekEnd } = getWeekRange(currentWeek);

  // Cargar datos
  const {
    users,
    orders,
    employees,
    loadingEmployees,
    allPayrolls,
    comisionPagos,
    asistencias,
    bcvRate,
    loadingRate,
    loadBcvRate,
    bono,
    semanaRefStart,
    semanaRefEnd,
  } = useWeeklyPayrollData({
    weekStart,
    weekEnd,
  });

  // Empleados ya pagados esta semana (BD o sesión)
  const paidEmployeeIds = useMemo(() => {
    const weekPayrolls = allPayrolls.filter((p) => {
      if (p.status !== 'paid') return false;
      const pStart = new Date(p.period.startDate);
      return pStart >= weekStart && pStart <= weekEnd;
    });
    return new Set<string>([
      ...Array.from(paidThisSession),
      ...weekPayrolls.map((p) => p.employeeId),
    ]);
  }, [paidThisSession, allPayrolls, weekStart, weekEnd]);

  // Payrolls de la semana actual
  const weekPayrolls = useMemo(
    () =>
      allPayrolls.filter((p) => {
        if (p.status !== 'paid') return false;
        const t = new Date(p.period.startDate).getTime();
        return t >= weekStart.getTime() && t <= weekEnd.getTime();
      }),
    [allPayrolls, weekStart, weekEnd],
  );

  // Mapeo de pagos por empleado (nómina + comisiones)
  const { paidByEmployee, payrollByEmployee } = useMemo(() => {
    const paidMap = new Map<string, number>();
    const payrollMap = new Map<string, (typeof weekPayrolls)[number]>();
    for (const p of weekPayrolls) {
      paidMap.set(
        p.employeeId,
        (paidMap.get(p.employeeId) ?? 0) + (p.netPay ?? 0),
      );
      payrollMap.set(p.employeeId, p);
    }
    for (const c of comisionPagos) {
      const d = c.fechaPago ?? c.createdAt;
      if (!d) continue;
      const t = new Date(d).getTime();
      if (!(t >= weekStart.getTime() && t <= weekEnd.getTime())) continue;

      const wn = norm(c.waiterName);
      const emp =
        employees.find((e) => e.userId === c.waiterId) ??
        employees.find((e) => {
          const full = norm(`${e.firstName ?? ''} ${e.lastName ?? ''}`);
          const first = norm(e.firstName).split(' ')[0];
          return (
            !!wn && (full.includes(wn) || first === wn || wn.includes(first))
          );
        });
      if (emp) {
        const neto = c.montoNeto ?? c.montoTotal ?? 0;
        paidMap.set(emp.id, (paidMap.get(emp.id) ?? 0) + neto);
      }
    }
    return { paidByEmployee: paidMap, payrollByEmployee: payrollMap };
  }, [weekPayrolls, comisionPagos, employees, weekStart, weekEnd]);

  // Datos de asistencia por empleado
  const diasAsistenciaData = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const emp of employees) {
      const ids = new Set(
        [emp.id, (emp as { userId?: string }).userId]
          .filter(Boolean)
          .map(String),
      );
      const user = findUserForEmployee(emp, users);
      if (user?.id) ids.add(user.id);

      const tieneEnlace = Boolean(
        (emp as { userId?: string }).userId || user?.id,
      );

      if (!tieneEnlace) {
        map.set(emp.id, null);
        continue;
      }

      const fechas = new Set<string>();
      for (const a of asistencias) {
        const suyo =
          ids.has(String(a.employeeId ?? '')) ||
          ids.has(String(a.userId ?? ''));
        if (!suyo || !a.date) continue;
        fechas.add(new Date(a.date).toISOString().slice(0, 10));
      }
      map.set(emp.id, fechas.size);
    }
    return map;
  }, [employees, users, asistencias]);

  // Bono del pizzero
  const bonoPizzeroData = useMemo(() => {
    const map = new Map<string, { total: number; resumen: string } | null>();
    const esPizzero = (emp: Employee): boolean =>
      /pizz/i.test(String(emp.position ?? '')) ||
      /pizz/i.test(String((emp as { department?: string }).department ?? ''));

    const bonoPizzero =
      bono && bono.total > 0
        ? {
            total: bono.total,
            resumen: `${format(semanaRefStart, 'd', { locale: es })}-${format(
              semanaRefEnd.getTime() - 1 > semanaRefStart.getTime()
                ? new Date(semanaRefEnd.getTime() - 1)
                : semanaRefStart,
              'd MMM',
              { locale: es },
            )} · ${bono.individuales} individuales + ${bono.conteo.combo} combos`,
          }
        : null;

    for (const emp of employees) {
      map.set(emp.id, esPizzero(emp) ? bonoPizzero : null);
    }
    return map;
  }, [employees, bono, semanaRefStart, semanaRefEnd]);

  // Cálculos de totales
  const totalsData = useWeeklyPayrollTotals({
    weekStart,
    weekEnd,
    employees,
    paidEmployeeIds,
    weekPayrolls,
    comisionPagos,
    orders,
    nomina,
  });

  const handlePaid = (id: string, _net: number, _b: PaidBreakdown): void => {
    setPaidThisSession((prev) => new Set([...prev, id]));
  };

  // Exportar PDF
  const exportarPdf = (): void => {
    const filas: FilaNominaPdf[] = employees
      .map((emp) => {
        const user = findUserForEmployee(emp, users);
        const pago = allPayrolls.find((p) => {
          if (p.employeeId !== emp.id) return false;
          const inicio = p.period?.startDate
            ? new Date(p.period.startDate as unknown as string)
            : null;
          return (
            !!inicio &&
            inicio >= weekStart &&
            inicio <= weekEnd &&
            p.status !== 'cancelled'
          );
        });
        if (!pago) return null;

        const salario = (pago.salary ?? {}) as {
          baseSalary?: number;
          commissions?: number;
          bonuses?: number;
        };

        const ded = pago.deductions as unknown;
        const otrosDescuentos =
          typeof ded === 'number'
            ? ded
            : ((ded as { other?: number } | null)?.other ?? 0);

        return {
          empleado:
            `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() ||
            (user?.name ?? 'Sin nombre'),
          cargo: String(emp.position ?? '—'),
          dias: Number(pago.daysWorked ?? 0),
          tarifa: Number(pago.dailyRate ?? 0),
          sueldo: Number(salario.baseSalary ?? 0),
          comision: Number(salario.commissions ?? 0),
          propina: Number(pago.tips ?? 0),
          bonos: Number(salario.bonuses ?? 0),
          descuentos: otrosDescuentos,
          neto: Number(pago.netPay ?? 0),
          pagado: pago.status === 'paid',
        } as FilaNominaPdf;
      })
      .filter((f): f is FilaNominaPdf => f !== null);

    if (!filas.length) {
      window.alert('Esta semana todavía no tiene pagos registrados.');
      return;
    }
    generarPdfNomina(filas, weekStart, weekEnd, nombreNegocio, bcvRate);
  };

  return (
    <div className="space-y-4">
      <PayrollHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        bcvRate={bcvRate}
        loadingRate={loadingRate}
        onPrevWeek={() => setCurrentWeek(subWeeks(currentWeek, 1))}
        onNextWeek={() => setCurrentWeek(addWeeks(currentWeek, 1))}
        onRefreshRate={() => void loadBcvRate()}
        onExportPdf={exportarPdf}
      />

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <PayrollTableHead />
            <PayrollTableBody
              employees={employees}
              loadingEmployees={loadingEmployees}
              users={users}
              orders={orders}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekStart1W={semanaRefStart}
              weekEnd1W={semanaRefEnd}
              nomina={nomina}
              bcvRate={bcvRate}
              paidByEmployee={paidByEmployee}
              payrollByEmployee={payrollByEmployee}
              paidEmployeeIds={paidEmployeeIds}
              bonoPizzeroData={bonoPizzeroData}
              diasAsistenciaData={diasAsistenciaData}
              onPaid={handlePaid}
            />
          </table>
        </div>

        <PayrollTotalsSection
          loadingEmployees={loadingEmployees}
          employeesCount={employees.length}
          totDias={totalsData.totDias}
          totComis={totalsData.totComis}
          totTips={totalsData.totTips}
          totNeto={totalsData.totNeto}
          paidConsumos={totalsData.paidConsumos}
          bcvRate={bcvRate}
          proyectadoNeto={totalsData.proyectadoNeto}
        />
      </div>
    </div>
  );
}
