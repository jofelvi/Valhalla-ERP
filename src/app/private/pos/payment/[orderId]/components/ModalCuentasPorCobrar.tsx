'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';
import { InvoiceStatusEnum } from '@/shared';
import { AccountReceivable } from '@/modelTypes/accountReceivable';

interface ModalCuentasPorCobrarProps {
  isOpen: boolean;
  onClose: () => void;
  nombreCliente: string;
  receivables: AccountReceivable[];
  seleccionadas: Set<string>;
  totalSeleccionado: number;
  onToggle: (receivableId: string) => void;
  onLimpiar: () => void;
}

/** Selector de cuentas por cobrar del cliente para agregarlas al cobro. */
export function ModalCuentasPorCobrar({
  isOpen,
  onClose,
  nombreCliente,
  receivables,
  seleccionadas,
  totalSeleccionado,
  onToggle,
  onLimpiar,
}: ModalCuentasPorCobrarProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-3xl">
        {/* Título del Modal */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-content">Cuentas por Cobrar</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-elevated rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-dim" />
          </button>
        </div>
        {/* Header con resumen */}
        <div className="mb-4 p-4 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl border border-accent/20">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-content">
                {nombreCliente}
              </h3>
              <p className="text-xs text-dim mt-0.5">
                {receivables.length} cuenta(s) pendiente(s)
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-dim">Total pendiente</div>
              <div className="text-xl font-bold text-accent">
                $
                {receivables
                  .reduce((sum, r) => sum + (r.amount - r.paidAmount), 0)
                  .toFixed(2)}
              </div>
            </div>
          </div>
          {seleccionadas.size > 0 && (
            <div className="pt-3 mt-3 border-t border-accent flex items-center justify-between">
              <span className="text-sm font-medium text-dim">
                Seleccionadas: {seleccionadas.size}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-brand">
                  ${totalSeleccionado.toFixed(2)}
                </span>
                <button
                  onClick={onLimpiar}
                  className="px-2 py-1 text-xs bg-elevated hover:bg-elevated rounded-md transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de cuentas scrolleable */}
        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {receivables.map((receivable) => {
            const pending = receivable.amount - receivable.paidAmount;
            const isSelected = seleccionadas.has(receivable.id);

            return (
              <div
                key={receivable.id}
                onClick={() => onToggle(receivable.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-br from-page to-elevated border-brand shadow-md scale-[1.02]'
                    : 'bg-surface border-line hover:border-line hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-5 h-5 text-brand rounded focus:ring-brand/30 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-content">
                          {receivable.invoiceNumber}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            receivable.status === InvoiceStatusEnum.PENDING
                              ? 'bg-accent/15 text-accent'
                              : receivable.status ===
                                  InvoiceStatusEnum.PARTIALLY_PAID
                                ? 'bg-brand/15 text-brand'
                                : 'bg-ok/15 text-ok'
                          }`}
                        >
                          {receivable.status === InvoiceStatusEnum.PENDING
                            ? 'Pendiente'
                            : receivable.status ===
                                InvoiceStatusEnum.PARTIALLY_PAID
                              ? 'Parcial'
                              : 'Pagada'}
                        </span>
                      </div>
                      {receivable.description && (
                        <div className="text-sm text-dim mb-2">
                          {receivable.description}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-dim">
                          Total:{' '}
                          <span className="font-semibold">
                            ${receivable.amount.toFixed(2)}
                          </span>
                        </span>
                        {receivable.paidAmount > 0 && (
                          <span className="text-ok">
                            Pagado:{' '}
                            <span className="font-semibold">
                              ${receivable.paidAmount.toFixed(2)}
                            </span>
                          </span>
                        )}
                        <span className="text-dim text-xs">
                          Vence:{' '}
                          {new Date(receivable.dueDate).toLocaleDateString(
                            'es-VE',
                            {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-dim mb-1">Pendiente</div>
                    <div className="text-xl font-bold text-accent">
                      ${pending.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer con acciones */}
        <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
          <Button
            onClick={onClose}
            className="flex-1 bg-elevated hover:bg-elevated text-dim"
          >
            Cerrar
          </Button>
          {seleccionadas.size > 0 && (
            <div className="text-right">
              <div className="text-xs text-dim">Se agregará al total</div>
              <div className="text-lg font-bold text-brand">
                +${totalSeleccionado.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
