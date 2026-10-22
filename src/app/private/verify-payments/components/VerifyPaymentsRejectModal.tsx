import { Loader2 } from 'lucide-react';
import Modal from '@/components/shared/modal';

interface VerifyPaymentsRejectModalProps {
  isOpen: boolean;
  isRejecting: boolean;
  selectedCount: number;
  rejectReason: string;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const VerifyPaymentsRejectModal = ({
  isOpen,
  isRejecting,
  selectedCount,
  rejectReason,
  onReasonChange,
  onCancel,
  onConfirm,
}: VerifyPaymentsRejectModalProps) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onCancel}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-lg shadow-2xl w-full max-w-md p-4"
    >
      <h3 className="font-bold text-content mb-3">
        Rechazar {selectedCount} pago(s)
      </h3>
      <p className="text-sm text-dim mb-3">
        Las ordenes vuelven al mesonero para que corrija el cobro. El motivo se
        aplicara a todas las seleccionadas.
      </p>
      <textarea
        value={rejectReason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="Motivo del rechazo..."
        rows={3}
        className="w-full p-2 text-sm bg-elevated border border-line rounded resize-none focus:border-accent focus:outline-none"
      />
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          disabled={isRejecting}
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-dim hover:text-content"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isRejecting || !rejectReason.trim()}
          onClick={onConfirm}
          className="px-3 py-1.5 bg-danger text-on-brand text-sm font-bold rounded disabled:opacity-50 inline-flex items-center gap-1"
        >
          {isRejecting && <Loader2 className="w-4 h-4 animate-spin" />}
          Rechazar
        </button>
      </div>
    </Modal>
  );
};
