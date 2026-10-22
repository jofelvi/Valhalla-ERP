import Modal from '@/components/shared/modal';
import { Order } from '@/modelTypes/order';
import { Users } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';

interface ModalAliasProps {
  isOpen: boolean;
  order: Order | null;
  aliasValue: string;
  isSaving: boolean;
  onClose: () => void;
  onAliasChange: (value: string) => void;
  onSave: () => Promise<void>;
}

export default function ModalAlias({
  isOpen,
  order,
  aliasValue,
  isSaving,
  onClose,
  onAliasChange,
  onSave,
}: ModalAliasProps) {
  if (!isOpen || !order) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/40 backdrop-blur-sm"
      className="bg-surface rounded-2xl shadow-2xl p-5 w-80 max-w-[90vw]"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-brand/10 to-brand/5 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-brand" />
        </div>
        <div>
          <h3 className="font-bold text-content text-sm">Alias del Cliente</h3>
          <p className="text-[10px] text-dim">
            Identificacion rapida de la mesa/orden
          </p>
        </div>
      </div>
      <input
        type="text"
        value={aliasValue}
        onChange={(e) => onAliasChange(e.target.value)}
        placeholder="Ej: Juan, Mesa del fondo, Cumpleaños..."
        className="w-full rounded-xl border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30/30 focus:border-brand mb-4"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void onSave();
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-gradient-to-r from-brand/10 to-brand/5 text-brand"
          onClick={() => void onSave()}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}
