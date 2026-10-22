'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { Button } from '@/components/shared/button/Button';

// Motivos frecuentes — el cambio de presentación es flujo legítimo del negocio
// (3 tobos -> caja completa, tobo -> media caja) y debe ser de un click.
const REASON_PRESETS = [
  'Cambio de presentación (tobos → caja / media caja)',
  'No se despachó — verificado con barra/cocina',
  'Error de comanda (producto equivocado)',
];

export interface LockedItemInfo {
  name: string;
  qty: number;
}

interface EditAuthModalProps {
  isOpen: boolean;
  lockedItems: LockedItemInfo[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirmAction: (pin: string, reason: string) => void;
  onCancelAction: () => void;
}

// Modal de autorización para eliminar/reducir productos YA COMANDADOS.
// El backend rechaza el guardado con 428 hasta recibir PIN admin/manager
// + motivo — este modal recoge ambos y el caller reintenta el PATCH.
export default function EditAuthModal({
  isOpen,
  lockedItems,
  isSubmitting,
  errorMessage,
  onConfirmAction,
  onCancelAction,
}: EditAuthModalProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');

  // El componente no se desmonta al cerrar (solo el <Modal> interno), asi que
  // el PIN de un intento anterior — o el que mete el gestor de contraseñas del
  // navegador — sobrevive. Se limpia al abrir para que el cajero siempre parta
  // de un campo vacio y no reintente a ciegas con un valor que no tecleo.
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setReason('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setPin('');
    setReason('');
    onCancelAction();
  };

  const handleConfirm = () => {
    if (!pin.trim() || !reason.trim()) return;
    onConfirmAction(pin.trim(), reason.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-shrink-0 w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-danger" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-content">
              Autorización requerida
            </h3>
            <p className="text-xs text-dim">
              Estás quitando productos que ya se comandaron a cocina/barra
            </p>
          </div>
        </div>

        {lockedItems.length > 0 && (
          <ul className="mb-3 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
            {lockedItems.map((it, i) => (
              <li key={i}>
                − {it.qty}× {it.name}
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-lg border border-danger bg-danger/15 px-3 py-2"
          >
            <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-danger font-semibold">{errorMessage}</p>
              <p className="text-danger/80 text-xs mt-0.5">
                Debe ser el PIN de un admin o manager (no la contraseña de la
                cuenta). Si no lo tienes, pídeselo a un administrador.
              </p>
            </div>
          </div>
        )}

        <label className="block text-sm font-medium mb-1">Motivo *</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {REASON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                reason === p
                  ? 'bg-brand text-on-brand border-brand'
                  : 'bg-surface border-line text-dim hover:border-brand/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Escribe o elige un motivo..."
          className="w-full text-sm border border-line rounded-lg px-3 py-2 mb-3 focus:border-brand focus:ring-1 focus:ring-brand/20 resize-none bg-surface"
        />

        <label className="block text-sm font-medium mb-1">
          PIN admin / manager *
        </label>
        {/* autoComplete="one-time-code" + name neutro + data-*ignore: evita que
            Chrome/1Password/LastPass rellenen aqui la CONTRASEÑA de la cuenta.
            Pasaba de verdad: el campo aparecia lleno solo y el cajero recibia
            "PIN invalido" sin haber tecleado nada. */}
        <input
          type="password"
          inputMode="numeric"
          name="edit-auth-code"
          autoComplete="one-time-code"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="PIN numérico"
          className="w-full text-sm border border-line rounded-lg px-3 py-2 mb-4 focus:border-brand focus:ring-1 focus:ring-brand/20 bg-surface"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleConfirm}
            disabled={isSubmitting || !pin.trim() || !reason.trim()}
          >
            {isSubmitting ? 'Autorizando...' : 'Autorizar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
