import Modal from '@/components/shared/modal';
import { Order } from '@/modelTypes/order';
import { AlertCircle, Eraser } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';

interface ModalResetProps {
  isOpen: boolean;
  target: { order: Order; label: string } | null;
  pin: string;
  reason: string;
  error: string;
  isResetting: boolean;
  onClose: () => void;
  onPinChange: (pin: string) => void;
  onReasonChange: (reason: string) => void;
  onReset: () => Promise<void>;
}

export default function ModalReset({
  isOpen,
  target,
  pin,
  reason,
  error,
  isResetting,
  onClose,
  onPinChange,
  onReasonChange,
  onReset,
}: ModalResetProps) {
  if (!isOpen || !target) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/70 backdrop-blur-sm"
      classNameWrap="p-4"
      className="bg-surface rounded-xl shadow-2xl w-full max-w-md border border-danger/30"
    >
      <div className="p-5 border-b border-line bg-gradient-to-r from-danger/10 to-transparent rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-danger/20 rounded-xl flex items-center justify-center">
            <Eraser className="w-5 h-5 text-danger" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-content">
              Resetear {target.label}
            </h2>
            <p className="text-xs text-dim mt-0.5">
              La orden sera eliminada (borrado logico)
              {target.order.tableId ? ' y la mesa liberada' : ''}
            </p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="bg-elevated rounded-lg p-3 border border-line text-sm">
          <div className="flex justify-between">
            <span className="text-dim">Orden:</span>
            <span className="text-content font-mono">
              {getDisplayOrderNumber(target.order)}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-dim">Total:</span>
            <span className="text-content font-bold">
              ${target.order.total.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-dim">Items:</span>
            <span className="text-content">
              {target.order.items?.reduce((s, i) => s + (i.quantity || 0), 0) ??
                0}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-dim uppercase mb-1.5">
            PIN de administrador *
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => {
              onPinChange(e.target.value.replace(/\D/g, '').slice(0, 8));
            }}
            placeholder="••••••"
            className="w-full px-3 py-2.5 bg-elevated border border-line rounded-lg text-content text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-danger/50"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-dim uppercase mb-1.5">
            Motivo (opcional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Ej: cliente se fue, error al tomar orden..."
            className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-danger/30"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-line flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose} disabled={isResetting}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={() => void onReset()}
          disabled={isResetting || !pin.trim()}
        >
          {isResetting ? 'Reseteando...' : 'Resetear'}
        </Button>
      </div>
    </Modal>
  );
}
