'use client';

import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';
import { OrderItem } from '@/modelTypes/orderItem';

interface ModalDescuentoProps {
  target: OrderItem | null;
  isApplying: boolean;
  tipo: 'PCT' | 'AMOUNT';
  onTipoChange: (tipo: 'PCT' | 'AMOUNT') => void;
  valor: string;
  onValorChange: (valor: string) => void;
  motivo: string;
  onMotivoChange: (motivo: string) => void;
  pin: string;
  onPinChange: (pin: string) => void;
  onClose: () => void;
  onRemove: () => void;
  onApply: () => void;
}

/** Descuento por producto (PIN admin + motivo). Baja también la base del servicio. */
export function ModalDescuento({
  target,
  isApplying,
  tipo,
  onTipoChange,
  valor,
  onValorChange,
  motivo,
  onMotivoChange,
  pin,
  onPinChange,
  onClose,
  onRemove,
  onApply,
}: ModalDescuentoProps) {
  return (
    <Modal
      isOpen={target !== null}
      onClose={() => {
        if (!isApplying) onClose();
      }}
    >
      {target && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-ok/10 rounded-full flex items-center justify-center">
              <span className="text-ok font-bold">%</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content">
                Descuento · {target.name}
              </h3>
              <p className="text-sm text-dim">
                Línea de ${(target.unitPrice * target.quantity).toFixed(2)}. El
                descuento baja también la base del servicio.
              </p>
            </div>
          </div>

          {(target.discountAmount ?? 0) > 0 && (
            <div className="mb-3 p-2 rounded-lg bg-ok/10 border border-ok/20 text-xs text-content">
              Ya tiene un descuento de $
              {(target.discountAmount ?? 0).toFixed(2)}
              {target.discountReason ? ` — ${target.discountReason}` : ''}.
              Aplicar otro lo reemplaza.
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-content mb-1">
                Tipo de descuento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['PCT', 'Porcentaje (%)'],
                    ['AMOUNT', 'Monto ($)'],
                  ] as const
                ).map(([valorTipo, etiqueta]) => (
                  <button
                    key={valorTipo}
                    type="button"
                    onClick={() => onTipoChange(valorTipo)}
                    disabled={isApplying}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      tipo === valorTipo
                        ? 'bg-ok text-on-brand border-ok'
                        : 'bg-elevated text-dim border-line hover:text-content'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-content mb-1">
                {tipo === 'PCT'
                  ? 'Porcentaje a descontar'
                  : 'Monto a descontar (USD)'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={tipo === 'PCT' ? '1' : '0.01'}
                value={valor}
                onChange={(e) => onValorChange(e.target.value)}
                placeholder={tipo === 'PCT' ? '15' : '5.00'}
                className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-ok/50"
                disabled={isApplying}
              />
              {parseFloat(valor) > 0 && (
                <p className="text-[11px] text-dim mt-1">
                  El cliente pagaría $
                  {Math.max(
                    0,
                    target.unitPrice * target.quantity -
                      (tipo === 'PCT'
                        ? (target.unitPrice *
                            target.quantity *
                            parseFloat(valor)) /
                          100
                        : parseFloat(valor)),
                  ).toFixed(2)}{' '}
                  por esta línea
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-content mb-1">
                Motivo (obligatorio)
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => onMotivoChange(e.target.value)}
                placeholder="Ej: demora de 40 min, plato incompleto..."
                className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-ok/50"
                disabled={isApplying}
              />
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
                className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-ok/50"
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
              {(target.discountAmount ?? 0) > 0 && (
                <Button
                  onClick={onRemove}
                  disabled={isApplying}
                  className="flex-1 bg-danger/90 hover:bg-danger text-on-brand font-semibold"
                >
                  Quitar
                </Button>
              )}
              <Button
                onClick={onApply}
                disabled={
                  isApplying ||
                  !(parseFloat(valor) > 0) ||
                  !motivo.trim() ||
                  !pin.trim()
                }
                className="flex-1 bg-ok hover:bg-ok/90 text-on-brand font-semibold"
              >
                {isApplying ? 'Aplicando...' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
