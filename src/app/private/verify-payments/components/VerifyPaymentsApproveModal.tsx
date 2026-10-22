import { ShieldCheck, Loader2, Printer } from 'lucide-react';
import Modal from '@/components/shared/modal';

interface VerifyPaymentsApproveModalProps {
  isOpen: boolean;
  isApproving: boolean;
  selectedCount: number;
  printInvoices: boolean;
  onPrintInvoicesChange: (checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const VerifyPaymentsApproveModal = ({
  isOpen,
  isApproving,
  selectedCount,
  printInvoices,
  onPrintInvoicesChange,
  onCancel,
  onConfirm,
}: VerifyPaymentsApproveModalProps) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onCancel}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-xl border border-ok/30 shadow-2xl p-6 max-w-sm w-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-ok/20 rounded-xl flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-ok" />
        </div>
        <div>
          <h3 className="font-bold text-content">Confirmar aprobación</h3>
          <p className="text-xs text-dim">Esta acción no se puede deshacer</p>
        </div>
      </div>
      <div className="bg-elevated rounded-xl p-3 mb-4 text-sm space-y-1">
        <p className="text-content">
          Se aprobarán{' '}
          <span className="font-bold text-ok">{selectedCount}</span> pago
          {selectedCount !== 1 ? 's' : ''}.
        </p>
        <p className="text-dim text-xs">
          Esto creará las facturas, registrará las propinas para comisiones y
          liberará las mesas correspondientes.
        </p>
      </div>
      <label className="flex items-center gap-3 mb-5 px-3 py-2.5 rounded-xl border border-line hover:border-ok/50 cursor-pointer select-none transition-colors">
        <input
          type="checkbox"
          checked={printInvoices}
          onChange={(e) => onPrintInvoicesChange(e.target.checked)}
          disabled={isApproving}
          className="w-4 h-4 accent-ok shrink-0"
        />
        <span className="flex items-center gap-1.5 text-sm text-content">
          <Printer className="w-4 h-4 text-dim" />
          Imprimir {selectedCount !== 1 ? 'las facturas' : 'la factura'} al
          aprobar
        </span>
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 px-4 py-2 rounded-lg border border-line text-dim hover:text-content text-sm"
          onClick={onCancel}
          disabled={isApproving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="flex-1 px-4 py-2 rounded-lg bg-ok text-on-brand hover:bg-ok/90 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={onConfirm}
          disabled={isApproving}
        >
          {isApproving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Aprobando...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Aprobar
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
