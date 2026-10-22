'use client';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { AccountReceivable } from '@odin6/types';
import { formatUSD } from '../utils/formatters';

export interface ConsumosSectionProps {
  pendingAR: AccountReceivable[];
  selectedARIds: Set<string>;
  onToggleAR: (id: string) => void;
  consumoNetFor: (ar: AccountReceivable) => number;
  staffPendingOf: (ar: AccountReceivable) => number;
  cobroFor: (ar: AccountReceivable) => number;
  onCobroChange: (id: string, monto: number) => void;
}

export function ConsumosSection({
  pendingAR,
  selectedARIds,
  onToggleAR,
  consumoNetFor,
  staffPendingOf,
  cobroFor,
  onCobroChange,
}: ConsumosSectionProps) {
  return (
    <div className="space-y-1">
      {pendingAR.map((ar) => {
        const pending = staffPendingOf(ar);
        const sugerido = Math.round(consumoNetFor(ar) * 100) / 100;
        const cobro = cobroFor(ar);
        const restante = Math.round((pending - cobro) * 100) / 100;
        const isSelected = selectedARIds.has(ar.id);

        return (
          <div key={ar.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleAR(ar.id)}
              className="mt-0.5 accent-danger cursor-pointer"
            />
            <div className="min-w-0">
              <p className="text-xs text-danger font-medium leading-tight">
                -{formatUSD(cobro)}
                <span className="text-[10px] text-dim ml-1">
                  de {formatUSD(pending)}
                </span>
              </p>

              {isSelected && (
                <div className="flex items-center gap-1 my-1">
                  <span className="text-[10px] text-dim">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={pending}
                    value={cobro}
                    onChange={(e) =>
                      onCobroChange(
                        ar.id,
                        Math.max(0, parseFloat(e.target.value) || 0),
                      )
                    }
                    className="w-16 px-1 py-0.5 text-[11px] rounded border border-line bg-surface text-content"
                    title="Monto a descontar"
                  />
                  <button
                    type="button"
                    onClick={() => onCobroChange(ar.id, pending)}
                    className="text-[10px] px-1 py-0.5 rounded border border-line text-accent hover:bg-elevated"
                    title="Cobrar todo"
                  >
                    Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => onCobroChange(ar.id, sugerido)}
                    className="text-[10px] px-1 py-0.5 rounded border border-line text-dim hover:bg-elevated"
                    title={`Sugerido: ${formatUSD(sugerido)}`}
                  >
                    Sug.
                  </button>
                </div>
              )}

              <p
                className={`text-[10px] leading-tight ${
                  restante > 0.01 ? 'text-accent' : 'text-ok'
                }`}
              >
                {restante > 0.01
                  ? `queda ${formatUSD(restante)} pendiente`
                  : 'salda la cuenta'}
              </p>
              <Link
                href={`/private/accounts-receivable/${ar.id}`}
                target="_blank"
                className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:text-accent/80 leading-tight truncate max-w-[140px] underline underline-offset-2"
              >
                {ar.description ?? ar.invoiceNumber}
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
