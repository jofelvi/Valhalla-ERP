import Modal from '@/components/shared/modal';
import { Order } from '@/modelTypes/order';
import { X } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';

interface ModalRechazoProps {
  isOpen: boolean;
  order: Order | null;
  reason: string;
  isRejecting: boolean;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onReject: () => Promise<void>;
}

export default function ModalRechazo({
  isOpen,
  order,
  reason,
  isRejecting,
  onClose,
  onReasonChange,
  onReject,
}: ModalRechazoProps) {
  if (!isOpen || !order) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/50 backdrop-blur-sm"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl p-5 w-full max-w-md"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-danger/10 to-danger/5 rounded-xl flex items-center justify-center flex-shrink-0">
          <X className="w-5 h-5 text-danger" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-content text-base">Rechazar Pago</h3>
          <p className="text-xs text-dim">
            Orden #{order.id.slice(-6).toUpperCase()} · $
            {order.total.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-accent/10 border border-accent/25 rounded-lg p-3 mb-4 text-xs text-accent">
        <p className="font-semibold mb-1">Que pasa al rechazar?</p>
        <ul className="list-disc list-inside space-y-0.5 text-accent">
          <li>El comprobante y monto reportado se eliminan</li>
          <li>El mesonero recibe el motivo del rechazo</li>
          <li>El mesonero podra subir nuevamente el pago corregido</li>
        </ul>
      </div>

      <label className="block text-xs font-semibold text-dim mb-1.5">
        Motivo del rechazo <span className="text-danger">*</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="Ej: Comprobante ilegible, monto no coincide, referencia ya usada, banco incorrecto..."
        rows={3}
        className="w-full rounded-xl border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-danger/30/30 focus:border-danger resize-none mb-4"
        autoFocus
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onClose}
          disabled={isRejecting}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-gradient-to-r from-danger/10 to-danger/5 hover:from-danger/10 hover:to-danger/5 text-danger"
          onClick={() => void onReject()}
          disabled={isRejecting || !reason.trim()}
        >
          {isRejecting ? 'Rechazando...' : 'Rechazar pago'}
        </Button>
      </div>
    </Modal>
  );
}
