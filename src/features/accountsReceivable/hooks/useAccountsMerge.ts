import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { useMergeAccounts } from '@/hooks/useAccountsReceivable';

export const useAccountsMerge = (
  selected: Set<string>,
  selectedAccounts: AccountReceivable[],
) => {
  const router = useRouter();
  const mergeAccountsMutation = useMergeAccounts();
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const mergeNames = [
    ...new Set(selectedAccounts.map((a) => a.customerName)),
  ].join(' + ');

  const mergeTotal = selectedAccounts.reduce(
    (s, a) => s + (a.amount - a.paidAmount),
    0,
  );

  const openMergeModal = () => {
    if (selected.size < 2) return;
    setMergeError(null);
    setShowMergeModal(true);
  };

  const confirmMerge = async () => {
    setMergeError(null);
    try {
      const data = (await mergeAccountsMutation.mutateAsync([...selected])) as {
        id?: string;
      };
      if (data?.id) {
        router.push(`/private/accounts-receivable/${data.id}`);
      }
    } catch (err) {
      setMergeError(
        err instanceof Error ? err.message : 'Error al unificar las cuentas',
      );
    }
  };

  const isMerging = mergeAccountsMutation.isPending;

  return {
    showMergeModal,
    setShowMergeModal,
    mergeError,
    setMergeError,
    mergeNames,
    mergeTotal,
    openMergeModal,
    confirmMerge,
    isMerging,
    selectedAccounts,
  };
};
