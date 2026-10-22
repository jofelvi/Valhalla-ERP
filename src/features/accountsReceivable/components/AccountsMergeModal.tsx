'use client';

import Modal from '@/components/shared/modal';
import { Button } from '@/components/shared/button/Button';
import { AlertTriangle, Merge, Loader2, X } from 'lucide-react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface AccountsMergeModalProps {
  isOpen: boolean;
  selectedCount: number;
  selectedAccounts: AccountReceivable[];
  mergeNames: string;
  mergeTotal: number;
  mergeError: string | null;
  isMerging: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const AccountsMergeModal = ({
  isOpen,
  selectedCount,
  selectedAccounts,
  mergeNames,
  mergeTotal,
  mergeError,
  isMerging,
  onClose,
  onConfirm,
}: AccountsMergeModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      estiloPropio
      onClose={() => !isMerging && onClose()}
      hojaEnMovil
      classNameFondo="bg-black/50 backdrop-blur-sm"
      classNameWrap="p-0 sm:p-4"
      className="bg-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-line overflow-hidden"
    >
      {/* Handle para mobile (drag indicator) */}
      <div className="flex justify-center pt-3 pb-1 sm:hidden">
        <div className="w-10 h-1 bg-line rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
            <Merge className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-content text-base">
              Unificar Cuentas
            </h3>
            <p className="text-xs text-dim">
              {selectedCount} cuentas seleccionadas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => !isMerging && onClose()}
          disabled={isMerging}
          className="p-2 rounded-xl text-dim hover:text-content hover:bg-elevated transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-5 space-y-4">
        {/* Resumen */}
        <div className="bg-elevated/50 border border-line rounded-xl p-4 space-y-3">
          <FilaDeResumen
            className="items-start"
            etiqueta="Cliente(s)"
            classNameEtiqueta="text-xs font-semibold text-dim uppercase tracking-wide"
            valor={mergeNames || '—'}
            classNameValor="text-sm font-semibold text-content text-right max-w-[60%]"
          />
          <FilaDeResumen
            className="items-center border-t border-line/50 pt-3"
            etiqueta="Total pendiente"
            classNameEtiqueta="text-xs font-semibold text-dim uppercase tracking-wide"
            valor={formatearUsdConMiles(mergeTotal)}
            classNameValor="text-lg font-black text-brand"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-dim uppercase tracking-wide">
              Cuentas a unir
            </span>
            <div className="flex gap-1 flex-wrap justify-end">
              {selectedAccounts.map((a) => (
                <span
                  key={a.id}
                  className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-mono"
                >
                  #{a.invoiceNumber}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-3 bg-accent/10 border border-accent/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-accent leading-relaxed">
            Se creará una nueva <strong>cuenta consolidada</strong> que agrupa
            los montos de las cuentas seleccionadas. Las cuentas originales
            quedarán marcadas como unificadas.
            {selectedAccounts.some((a) => a.isConsolidated) && (
              <>
                {' '}
                <strong>
                  Si seleccionaste cuentas que ya eran consolidadas
                </strong>
                , se &quot;aplanan&quot;: sus facturas individuales pasan a la
                nueva consolidada y la(s) consolidada(s) anterior(es) se
                elimina(n).
              </>
            )}
          </p>
        </div>

        {/* Error */}
        {mergeError && (
          <div className="flex items-start gap-3 bg-danger/10 border border-danger/20 rounded-xl p-3">
            <X className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-xs text-danger">{mergeError}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 px-5 pb-5 sm:pb-5 pb-safe">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isMerging}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 bg-gradient-to-r from-brand to-brand-light text-on-brand shadow-lg shadow-brand/20"
          onClick={onConfirm}
          disabled={isMerging}
        >
          {isMerging ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Unificando...
            </>
          ) : (
            <>
              <Merge className="w-4 h-4 mr-2" />
              Confirmar Unificación
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
};
