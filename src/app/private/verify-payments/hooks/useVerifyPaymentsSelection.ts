import { useState } from 'react';
import { Order } from '@odin6/types';

export const useVerifyPaymentsSelection = (pendingOrders: Order[]) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = (filteredOrders: Order[]) => {
    const allFilteredSelected =
      filteredOrders.length > 0 &&
      filteredOrders.every((o) => selectedIds.has(o.id));

    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredOrders.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredOrders.forEach((o) => next.add(o.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllFilteredSelected = (filteredOrders: Order[]): boolean =>
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedIds.has(o.id));

  const selectedOrders = pendingOrders.filter((o) => selectedIds.has(o.id));

  return {
    selectedIds,
    selectedOrders,
    toggleSelectAll,
    toggleOne,
    clearSelection,
    isAllFilteredSelected,
  };
};
