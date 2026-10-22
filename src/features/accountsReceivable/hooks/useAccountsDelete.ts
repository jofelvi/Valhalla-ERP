import { useState } from 'react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { useDeleteAccountsReceivable } from '@/hooks/useAccountsReceivable';

export const useAccountsDelete = () => {
  const deleteAccountMutation = useDeleteAccountsReceivable();
  const [deleteTarget, setDeleteTarget] = useState<AccountReceivable | null>(
    null,
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteAccountMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return {
    deleteTarget,
    setDeleteTarget,
    handleDeleteConfirm,
    deleteAccountMutation,
  };
};
