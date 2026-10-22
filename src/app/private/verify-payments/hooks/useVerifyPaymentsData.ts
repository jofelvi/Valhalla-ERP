import { useMemo } from 'react';
import { usePendingVerificationOrders, usePOSData } from '@/hooks/useOrders';
import { useBcvRate } from '@/hooks/useBcvRate';
import { Order } from '@odin6/types';

interface UserData {
  id: string;
  name: string;
  role?: string;
  isActive?: boolean;
}

export const useVerifyPaymentsData = () => {
  const {
    data: pendingOrders = [],
    isLoading,
    refetch,
  } = usePendingVerificationOrders();
  const { data: posData } = usePOSData();
  const { data: bcvData } = useBcvRate();

  const bcvRate = bcvData?.rate ?? 0;

  // Parse all users from posData
  const allUsers = useMemo<UserData[]>(() => {
    const users =
      (posData && typeof posData === 'object' && 'users' in posData
        ? (posData as { users?: unknown }).users
        : undefined) ?? [];
    return Array.isArray(users) ? (users as UserData[]) : [];
  }, [posData]);

  // Options for waiter dropdown
  const waiterOptions = useMemo(() => {
    const map = new Map<string, string>();
    pendingOrders.forEach((o: Order) => {
      if (o.waiterId) {
        const name =
          allUsers.find((w) => w.id === o.waiterId)?.name ?? 'Sin nombre';
        map.set(o.waiterId, name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [pendingOrders, allUsers]);

  // Options for payment method dropdown
  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    pendingOrders.forEach((o: Order) => {
      if (o.pendingPayments && o.pendingPayments.length > 0) {
        o.pendingPayments.forEach((p) => p.method && set.add(p.method));
      } else if (o.paymentMethod) {
        set.add(o.paymentMethod);
      }
    });
    return Array.from(set).sort();
  }, [pendingOrders]);

  return {
    pendingOrders,
    isLoading,
    refetch,
    bcvRate,
    allUsers,
    waiterOptions,
    methodOptions,
  };
};
