import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useAccountsReceivableRecord } from '@/hooks/useAccountsReceivable';
import { useCustomer } from '@/hooks/useCustomers';
import { usePayments } from '@/hooks/usePayments';
import { orderKeys } from '@/hooks/useOrders';
import { api } from '@/services/api/apiClient';
import { Order } from '@/modelTypes/order';

interface UseAccountReceivedDetailsReturn {
  accountReceivable: ReturnType<typeof useAccountsReceivableRecord>['data'];
  customer: ReturnType<typeof useCustomer>['data'];
  orders: Order[];
  accountPayments: ReturnType<typeof usePayments>['data'];
  orderIdSet: Set<string>;
  isLoading: boolean;
}

export function useAccountReceivedDetails(
  id: string,
): UseAccountReceivedDetailsReturn {
  const { data: accountReceivable } = useAccountsReceivableRecord(id || '');
  const { data: customer } = useCustomer(accountReceivable?.customerId || '');
  const { data: allPayments = [] } = usePayments();

  // Orden IDs a cargar: si es consolidada usa mergedOrderIds, sino solo orderId.
  const orderIds = useMemo<string[]>(() => {
    if (!accountReceivable) return [];
    if (
      accountReceivable.isConsolidated &&
      accountReceivable.mergedOrderIds?.length
    ) {
      return accountReceivable.mergedOrderIds.filter(Boolean);
    }
    return accountReceivable.orderId ? [accountReceivable.orderId] : [];
  }, [accountReceivable]);

  const orderQueries = useQueries({
    queries: orderIds.map((oid) => ({
      queryKey: orderKeys.detail(oid),
      queryFn: () => api.get<Order>(`/api/orders/${oid}`),
      enabled: !!oid,
    })),
  });

  const orders = useMemo<Order[]>(() => {
    return orderQueries
      .map((q) => q.data)
      .filter((o): o is Order => !!o)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [orderQueries]);

  const orderIdSet = useMemo(() => new Set(orderIds), [orderIds]);

  const accountPayments = useMemo(() => {
    if (!accountReceivable) return [];
    return allPayments
      .filter((p) => {
        const matchesOrder = p.orderId && orderIdSet.has(p.orderId);
        const matchesAccount = p.orderId === id;
        const matchesNote = p.notes?.includes(id || '');
        return matchesOrder || matchesAccount || matchesNote;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [allPayments, accountReceivable, id, orderIdSet]);

  const isLoading =
    !accountReceivable || orderQueries.some((q) => q.isLoading) || !allPayments;

  return {
    accountReceivable,
    customer,
    orders,
    accountPayments,
    orderIdSet,
    isLoading,
  };
}
