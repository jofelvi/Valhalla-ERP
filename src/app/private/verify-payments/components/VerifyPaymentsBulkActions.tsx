import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { Order } from '@odin6/types';

interface VerifyPaymentsBulkActionsProps {
  selectedCount: number;
  selectedOrders: Order[];
  isApproving: boolean;
  isRejecting: boolean;
  approveProgress: { current: number; total: number; errors: number } | null;
  onRejectClick: () => void;
  onApproveClick: () => void;
}

export const VerifyPaymentsBulkActions = ({
  selectedCount,
  selectedOrders,
  isApproving,
  isRejecting,
  approveProgress,
  onRejectClick,
  onApproveClick,
}: VerifyPaymentsBulkActionsProps) => {
  if (selectedCount === 0) return null;

  const totalAmount = selectedOrders
    .reduce((s, o) => s + o.total + (o.tipAmount ?? 0), 0)
    .toFixed(2);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-accent/5 border border-accent/30 rounded-lg">
      <span className="font-semibold text-content">
        {selectedCount} seleccionada(s)
      </span>
      <span className="text-dim text-sm">·</span>
      <span className="text-sm text-dim">Total: ${totalAmount}</span>
      <div className="flex-1" />
      <button
        type="button"
        disabled={isApproving || isRejecting}
        onClick={onRejectClick}
        className="px-3 py-1.5 bg-surface border border-danger/30 text-danger hover:bg-danger/10 text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
      >
        <X className="w-4 h-4" />
        Rechazar
      </button>
      <button
        type="button"
        disabled={isApproving || isRejecting}
        onClick={onApproveClick}
        className="px-4 py-1.5 bg-ok text-on-brand hover:bg-ok/90 text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
      >
        {isApproving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {approveProgress
              ? `Aprobando ${approveProgress.current}/${approveProgress.total}...`
              : 'Aprobando...'}
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Aprobar {selectedCount} seleccionada(s)
          </>
        )}
      </button>
    </div>
  );
};
