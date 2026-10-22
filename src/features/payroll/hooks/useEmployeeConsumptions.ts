import { useMemo, useState, useEffect } from 'react';
import { AccountReceivable } from '@odin6/types';
import { NominaConfig, Order } from '@odin6/types';
import { useAccountsReceivableByCustomers } from '@/hooks/useAccountsReceivable';
import { api } from '@/services/api/apiClient';
import { consumoNet, staffDebt } from '../payrollCalc';

interface EmployeeConsumptionsState {
  pendingAR: AccountReceivable[];
  selectedARIds: Set<string>;
  toggleAR: (id: string) => void;
  arCobroOverride: Map<string, number>;
  setArCobro: (id: string, monto: number) => void;
  baseByAR: Record<string, number>;
  consumoNetFor: (ar: AccountReceivable) => number;
  staffTargetFor: (ar: AccountReceivable) => number;
  staffPendingOf: (ar: AccountReceivable) => number;
  cobroFor: (ar: AccountReceivable) => number;
  consumosTotal: number;
}

export function useEmployeeConsumptions(
  employeeId: string,
  employeeCustomerId: string | undefined,
  customerIds: readonly string[],
  nomina: NominaConfig,
): EmployeeConsumptionsState {
  const { data: allCustomersAr = [] } =
    useAccountsReceivableByCustomers(customerIds);

  const arItems = useMemo(
    () =>
      employeeCustomerId
        ? allCustomersAr.filter((ar) => ar.customerId === employeeCustomerId)
        : [],
    [allCustomersAr, employeeCustomerId],
  );

  // Filter to pending accounts (not paid, not cancelled, has balance, not merged)
  const pendingAR = useMemo(
    () =>
      arItems.filter(
        (ar) =>
          ar.status !== 'paid' &&
          ar.status !== 'cancelled' &&
          ar.amount > (ar.paidAmount ?? 0) &&
          !ar.isMerged,
      ),
    [arItems],
  );

  const [selectedARIds, setSelectedARIds] = useState<Set<string>>(new Set());
  const [arCobroOverride, setArCobroOverride] = useState<Map<string, number>>(
    new Map(),
  );
  const [baseByAR, setBaseByAR] = useState<Record<string, number>>({});

  // Fetch order bases for consumo calculation
  const arKey = pendingAR.map((ar) => ar.id).join(',');
  useEffect(() => {
    const orderIds = Array.from(
      new Set(
        pendingAR.flatMap((ar) => [
          ...(ar.orderId ? [ar.orderId] : []),
          ...((ar.mergedOrderIds as string[] | undefined) ?? []),
        ]),
      ),
    );

    if (orderIds.length === 0) {
      setBaseByAR({});
      return;
    }

    let cancelled = false;
    api
      .get<Order[]>(`/api/orders?ids=${orderIds.join(',')}`)
      .then((orders) => {
        if (cancelled) return;
        const subMap = new Map(orders.map((o) => [o.id, o.subtotal ?? 0]));
        const m: Record<string, number> = {};
        for (const ar of pendingAR) {
          const ids = [
            ...(ar.orderId ? [ar.orderId] : []),
            ...((ar.mergedOrderIds as string[] | undefined) ?? []),
          ];
          const sum = ids.reduce((s, oid) => s + (subMap.get(oid) ?? 0), 0);
          m[ar.id] = sum > 0 ? sum : ar.amount;
        }
        setBaseByAR(m);
      })
      .catch(() => {
        if (!cancelled) {
          setBaseByAR(
            Object.fromEntries(pendingAR.map((ar) => [ar.id, ar.amount])),
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arKey]);

  const consumoNetFor = (ar: AccountReceivable) =>
    consumoNet(ar, baseByAR[ar.id], nomina);

  const staffTargetFor = (ar: AccountReceivable) =>
    staffDebt(ar, baseByAR[ar.id], nomina);

  const staffPendingOf = (ar: AccountReceivable) =>
    Math.max(
      0,
      Math.round((staffTargetFor(ar) - (ar.paidAmount ?? 0)) * 100) / 100,
    );

  const cobroFor = (ar: AccountReceivable) => {
    const override = arCobroOverride.get(ar.id);
    const base = override ?? consumoNetFor(ar);
    return Math.min(
      Math.max(0, Math.round(base * 100) / 100),
      staffPendingOf(ar),
    );
  };

  const consumosTotal = pendingAR
    .filter((ar) => selectedARIds.has(ar.id))
    .reduce((s, ar) => s + cobroFor(ar), 0);

  const toggleAR = (id: string) => {
    setSelectedARIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setArCobro = (id: string, monto: number) =>
    setArCobroOverride((prev) => new Map(prev).set(id, monto));

  return {
    pendingAR,
    selectedARIds,
    toggleAR,
    arCobroOverride,
    setArCobro,
    baseByAR,
    consumoNetFor,
    staffTargetFor,
    staffPendingOf,
    cobroFor,
    consumosTotal,
  };
}
