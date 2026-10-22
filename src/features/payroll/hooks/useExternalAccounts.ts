import { useMemo, useState } from 'react';
import { AccountReceivable } from '@odin6/types';
import { Order } from '@odin6/types';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { api } from '@/services/api/apiClient';
import { coincideTexto, prepararBusqueda } from '@/shared/utils/busquedaTexto';

interface ExternalAccountsState {
  externalAR: AccountReceivable[];
  externalItems: Record<string, string[]>;
  showLinkAR: boolean;
  setShowLinkAR: (value: boolean) => void;
  arSearch: string;
  setArSearch: (value: string) => void;
  externalCandidates: AccountReceivable[];
  linkExternalAR: (ar: AccountReceivable) => void;
  unlinkExternalAR: (id: string) => void;
  externalPendingOf: (ar: AccountReceivable) => number;
  externalTotal: number;
}

export function useExternalAccounts(
  employeeCustomerId: string | undefined,
): ExternalAccountsState {
  const [externalAR, setExternalAR] = useState<AccountReceivable[]>([]);
  const [externalItems, setExternalItems] = useState<Record<string, string[]>>(
    {},
  );
  const [showLinkAR, setShowLinkAR] = useState(false);
  const [arSearch, setArSearch] = useState('');

  // Only fetch all pending AR when search modal is open
  const { data: allPendingAR = [] } = useAccountsReceivable(
    { status: 'pending' },
    { enabled: showLinkAR },
  );

  const externalCandidates = useMemo(() => {
    if (arSearch.trim().length < 2) return [];
    const busqueda = prepararBusqueda(arSearch);
    const linkedIds = new Set(externalAR.map((ar) => ar.id));
    return allPendingAR
      .filter(
        (ar) =>
          ar.status !== 'paid' &&
          ar.status !== 'cancelled' &&
          ar.amount > (ar.paidAmount ?? 0) &&
          !ar.isMerged &&
          ar.customerId !== (employeeCustomerId ?? '') &&
          !linkedIds.has(ar.id) &&
          coincideTexto([ar.customerName, ar.invoiceNumber], busqueda),
      )
      .slice(0, 6);
  }, [allPendingAR, arSearch, externalAR, employeeCustomerId]);

  const linkExternalAR = (ar: AccountReceivable) => {
    setExternalAR((prev) => [...prev, ar]);
    setArSearch('');

    // Fetch line items for display
    const orderIds = [
      ...(ar.orderId ? [ar.orderId] : []),
      ...((ar.mergedOrderIds as string[] | undefined) ?? []),
    ].filter(Boolean);

    if (orderIds.length === 0) return;

    api
      .get<Order[]>(`/api/orders?ids=${orderIds.join(',')}`)
      .then((orders) => {
        const lines = orders.flatMap((o) =>
          (o.items ?? []).map((it) => `${it.quantity}× ${it.name}`),
        );
        setExternalItems((prev) => ({ ...prev, [ar.id]: lines }));
      })
      .catch(() => {});
  };

  const unlinkExternalAR = (id: string) => {
    setExternalAR((prev) => prev.filter((ar) => ar.id !== id));
  };

  const externalPendingOf = (ar: AccountReceivable) =>
    Math.round((ar.amount - (ar.paidAmount ?? 0)) * 100) / 100;

  const externalTotal = externalAR.reduce(
    (s, ar) => s + externalPendingOf(ar),
    0,
  );

  return {
    externalAR,
    externalItems,
    showLinkAR,
    setShowLinkAR,
    arSearch,
    setArSearch,
    externalCandidates,
    linkExternalAR,
    unlinkExternalAR,
    externalPendingOf,
    externalTotal,
  };
}
