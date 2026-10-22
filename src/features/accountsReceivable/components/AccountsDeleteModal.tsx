'use client';

import Modal from '@/components/shared/modal';
import { Button } from '@/components/shared/button/Button';
import { Trash2, Loader2 } from 'lucide-react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { UseMutationResult } from '@tanstack/react-query';

interface AccountsDeleteModalProps {
  deleteTarget: AccountReceivable | null;
  deleteAccountMutation: UseMutationResult<unknown, Error, string>;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const AccountsDeleteModal = ({
  deleteTarget,
  deleteAccountMutation,
  onClose,
  onConfirm,
}: AccountsDeleteModalProps) => {
  if (!deleteTarget) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60 backdrop-blur-sm"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl border border-danger/30 shadow-2xl p-6 max-w-sm w-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-danger/20 rounded-xl flex items-center justify-center shrink-0">
          <Trash2 className="w-5 h-5 text-danger" />
        </div>
        <div>
          <h3 className="font-bold text-content">Eliminar cuenta</h3>
          <p className="text-xs text-dim">Esta acción no se puede deshacer</p>
        </div>
      </div>
      <div className="bg-elevated rounded-xl p-3 mb-5 text-sm">
        <p className="font-semibold text-content truncate">
          #{deleteTarget.invoiceNumber}
        </p>
        <p className="text-dim truncate">{deleteTarget.customerName}</p>
        <p className="text-danger font-bold mt-1">
          {new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: 'USD',
          }).format(deleteTarget.amount)}
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={deleteAccountMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 bg-danger text-on-brand hover:bg-danger/90"
          onClick={onConfirm}
          disabled={deleteAccountMutation.isPending}
        >
          {deleteAccountMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Eliminando...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
};
