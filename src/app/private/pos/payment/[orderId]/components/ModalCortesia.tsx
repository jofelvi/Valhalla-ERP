'use client';

import { Gift } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';

export type CortesiaResponsable = 'COCINA' | 'BARRA' | 'MESONERO' | 'CASA';

interface ModalCortesiaProps {
  isOpen: boolean;
  isApplying: boolean;
  motivo: string;
  onMotivoChange: (motivo: string) => void;
  responsable: CortesiaResponsable;
  onResponsableChange: (r: CortesiaResponsable) => void;
  pin: string;
  onPinChange: (pin: string) => void;
  onClose: () => void;
  onApply: () => void;
}

/** Cortesía total: la orden completa queda en $0 (PIN admin + motivo). */
export function ModalCortesia({
  isOpen,
  isApplying,
  motivo,
  onMotivoChange,
  responsable,
  onResponsableChange,
  pin,
  onPinChange,
  onClose,
  onApply,
}: ModalCortesiaProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isApplying) onClose();
      }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center">
            <Gift className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-content">
              Cortesía total
            </h3>
            <p className="text-sm text-dim">
              La orden completa queda en $0, la mesa se libera y el mesonero
              conserva su comisión.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-content mb-1">
              Motivo (obligatorio)
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => onMotivoChange(e.target.value)}
              placeholder="Ej: invitado de la casa, compensación por demora..."
              className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              disabled={isApplying}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">
              ¿De quién fue el error?
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['COCINA', 'Cocina'],
                  ['BARRA', 'Barra'],
                  ['MESONERO', 'Mesonero'],
                  ['CASA', 'La casa'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => onResponsableChange(valor)}
                  disabled={isApplying}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    responsable === valor
                      ? 'bg-brand text-on-brand border-brand'
                      : 'bg-elevated text-dim border-line hover:text-content'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-dim mt-1">
              Solo queda registrado para medir de dónde salen las cortesías. No
              le quita comisión a nadie.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">
              PIN de administrador
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => onPinChange(e.target.value)}
              placeholder="••••••"
              className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              disabled={isApplying}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              disabled={isApplying}
              className="flex-1 bg-elevated hover:bg-elevated text-dim"
            >
              Cancelar
            </Button>
            <Button
              onClick={onApply}
              disabled={isApplying || !motivo.trim() || !pin.trim()}
              className="flex-1 bg-brand hover:bg-brand/90 text-on-brand font-semibold"
            >
              {isApplying ? 'Aplicando...' : 'Aplicar cortesía'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
