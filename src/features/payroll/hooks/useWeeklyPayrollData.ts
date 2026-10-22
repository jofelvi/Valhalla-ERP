'use client';
import { useEffect, useState, useMemo } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useAttendance } from '@/hooks/useAttendance';
import { useActiveEmployees } from '@/hooks/useEmployees';
import { usePayroll } from '@/hooks/usePayroll';
import { useComisionHistorial } from '@/hooks/useComisiones';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Order } from '@odin6/types';

interface UseWeeklyPayrollDataProps {
  weekStart: Date;
  weekEnd: Date;
}

export function useWeeklyPayrollData({
  weekStart,
  weekEnd,
}: UseWeeklyPayrollDataProps) {
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [loadingRate, setLoadingRate] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  // Semana como ISO strings para el servidor
  const semana = useMemo(
    () => ({ from: weekStart.toISOString(), to: weekEnd.toISOString() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekStart.getTime(), weekEnd.getTime()],
  );

  // Usuarios de la app (para vincular empleados)
  const { data: users = [] } = useUsers();

  // Pagos de comisión de la semana mostrada
  const { data: comisionPagos = [] } = useComisionHistorial(semana);

  // Empleados activos
  const { data: allEmployees = [], isLoading: loadingEmployees } =
    useActiveEmployees();

  const employees = useMemo(
    () => allEmployees.filter((e) => e.isActive !== false),
    [allEmployees],
  );

  // IDs de clientes de todos los empleados (para UNA sola consulta de cuentas por cobrar)
  const customerIds = useMemo(
    () =>
      employees
        .map((e) => e.customerId)
        .filter((id): id is string => Boolean(id)),
    [employees],
  );

  // Nóminas registradas de la semana
  const { data: allPayrolls = [] } = usePayroll(semana);

  // Cargar tasa BCV
  const loadBcvRate = async (): Promise<void> => {
    setLoadingRate(true);
    try {
      const res = await fetch('/api/bcv-rate');
      const data = await res.json();
      if (data.success && data.rate) setBcvRate(data.rate);
    } catch {
      // mantener último valor
    } finally {
      setLoadingRate(false);
    }
  };

  // Cargar BCV al montar
  useEffect(() => {
    void loadBcvRate();
  }, []);

  // Cargar órdenes pagadas con comisión pendiente
  useEffect(() => {
    let cancelled = false;
    api
      .get<Order[]>('/api/orders', {
        comisionPendiente: 'true',
        view: 'payroll',
      })
      .then((all) => {
        if (cancelled) return;
        setOrders(all.filter((o) => !!o.waiterId));
      })
      .catch(() => setOrders([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Asistencia de la semana ANTERIOR (período de referencia)
  const semanaRefStart = new Date(weekStart.getTime() - 7 * 24 * 3600 * 1000);
  const semanaRefEnd = new Date(weekStart.getTime());
  const { data: asistencias = [] } = useAttendance({
    from: semanaRefStart.toISOString(),
    to: semanaRefEnd.toISOString(),
  });

  // Bono del pizzero de la semana ANTERIOR
  const bonoStart = new Date(weekStart.getTime() - 7 * 24 * 3600 * 1000);
  const bonoEnd = new Date(weekStart.getTime());
  const { data: bono } = useQuery({
    queryKey: [
      'payroll',
      'pizza-bonus',
      bonoStart.toISOString(),
      bonoEnd.toISOString(),
    ],
    queryFn: () =>
      api.get<{
        total: number;
        conteo: {
          grande: number;
          mediana: number;
          pequena: number;
          combo: number;
        };
        individuales: number;
        ordenes: number;
      }>('/api/payroll/pizza-bonus', {
        from: bonoStart.toISOString(),
        to: bonoEnd.toISOString(),
      }),
  });

  return {
    users,
    orders,
    employees,
    loadingEmployees,
    customerIds,
    allPayrolls,
    comisionPagos,
    asistencias,
    bcvRate,
    loadingRate,
    loadBcvRate,
    bono,
    semanaRefStart,
    semanaRefEnd,
  };
}
