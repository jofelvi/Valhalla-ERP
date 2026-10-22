import Modal from '@/components/shared/modal';

interface ModalFusionProps {
  isOpen: boolean;
  destLabel: string | null;
  pin: string;
  error: string | null;
  isTransferring: boolean;
  onClose: () => void;
  onPinChange: (pin: string) => void;
  onConfirm: () => Promise<void>;
}

export default function ModalFusion({
  isOpen,
  destLabel,
  pin,
  error,
  isTransferring,
  onClose,
  onPinChange,
  onConfirm,
}: ModalFusionProps) {
  if (!isOpen || !destLabel) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      capa="encima"
      classNameFondo="bg-black/60 backdrop-blur-sm"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-5"
    >
      <h2 className="text-base font-bold text-content">
        Fusionar en {destLabel}
      </h2>
      <p className="text-xs text-dim mt-1">
        Todo el consumo pasa a esa cuenta y esta orden se cierra. La mesa que
        quede libre se libera sola.
      </p>

      <label className="block text-xs text-dim mt-4 mb-1">
        PIN de admin o gerente
      </label>
      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => onPinChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void onConfirm();
        }}
        disabled={isTransferring}
        autoFocus
        placeholder="••••"
        className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-content tracking-widest text-center"
      />

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          disabled={isTransferring}
          className="flex-1 px-4 py-2 rounded-lg border border-line text-content hover:bg-elevated disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={!pin.trim() || isTransferring}
          className="flex-1 px-4 py-2 rounded-lg bg-brand text-on-brand font-medium disabled:opacity-40"
        >
          {isTransferring ? 'Fusionando...' : 'Fusionar'}
        </button>
      </div>
    </Modal>
  );
}
