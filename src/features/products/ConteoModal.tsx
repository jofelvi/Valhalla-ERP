'use client';
import Modal from '@/components/shared/modal';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';

interface ConteoModalProps {
  nombre: string;
  almacen: string;
  stockActual?: number | null;
  guardando?: boolean;
  onConfirmAction: (cantidad: number) => void;
  onCloseAction: () => void;
}

/**
 * Conteo físico de un insumo, desde su ficha.
 *
 * Pide UNA cosa: cuánto hay de verdad en el almacén. No "cuánto sumar" ni
 * "cuánto quitar" — el sistema calcula la diferencia y la registra en el
 * kardex. Preguntar por el ajuste invita a hacer la resta de cabeza, y ahí es
 * donde se cuelan los errores.
 */
export default function ConteoModal({
  nombre,
  almacen,
  stockActual,
  guardando,
  onConfirmAction,
  onCloseAction,
}: ConteoModalProps) {
  const [texto, setTexto] = useState('');
  const cantidad = Number(texto);
  const valido =
    texto.trim() !== '' && Number.isFinite(cantidad) && cantidad >= 0;
  const diferencia =
    valido && typeof stockActual === 'number' ? cantidad - stockActual : null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onCloseAction}
      hojaEnMovil
      classNameFondo="bg-black/60"
      classNameWrap="p-0 sm:p-4"
      className="bg-page w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-line bg-surface">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-content truncate">
            Conteo físico
          </h2>
          <p className="text-xs text-dim truncate">
            {nombre} · {almacen}
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseAction}
          className="p-2.5 rounded-lg hover:bg-elevated text-dim shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-5 space-y-3">
        <label
          htmlFor="conteo-cantidad"
          className="block text-sm font-semibold text-dim"
        >
          ¿Cuánto hay de verdad, contado a mano?
        </label>
        <input
          id="conteo-cantidad"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            typeof stockActual === 'number'
              ? `El sistema dice ${stockActual}`
              : 'Sin registro previo'
          }
          className="w-full px-4 py-3 rounded-xl bg-surface border border-line text-content text-lg focus:outline-none focus:border-brand"
        />

        {diferencia !== null && diferencia !== 0 && (
          <p className="text-sm text-dim">
            Se registrará un ajuste de{' '}
            <span
              className={
                diferencia > 0
                  ? 'text-ok font-semibold'
                  : 'text-danger font-semibold'
              }
            >
              {diferencia > 0 ? '+' : ''}
              {Math.round(diferencia * 1000) / 1000}
            </span>{' '}
            y quedará en el kardex con tu nombre.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-line bg-surface">
        <Button
          type="button"
          variant="ghost"
          onClick={onCloseAction}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!valido || guardando}
          onClick={() => onConfirmAction(cantidad)}
          className="flex-[2]"
        >
          {guardando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando…
            </>
          ) : (
            'Registrar conteo'
          )}
        </Button>
      </div>
    </Modal>
  );
}
