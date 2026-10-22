import { useMemo, useState } from 'react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';

export const useAccountsSelection = (
  accounts: AccountReceivable[],
  canSelect: boolean,
) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableIds = useMemo(
    () =>
      canSelect ? accounts.filter((a) => !a.isMerged).map((a) => a.id) : [],
    [accounts, canSelect],
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const someSelected =
    selectableIds.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of selectableIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of selectableIds) next.add(id);
      return next;
    });
  };

  const selectedAccounts = accounts.filter((a) => selected.has(a.id));
  const canMerge = selected.size >= 2;

  return {
    selected,
    setSelected,
    toggle,
    selectableIds,
    allSelected,
    someSelected,
    toggleAll,
    selectedAccounts,
    canMerge,
  };
};
