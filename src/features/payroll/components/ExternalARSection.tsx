'use client';
import Link from 'next/link';
import { ExternalLink, Link2, Search, Trash2 } from 'lucide-react';
import { AccountReceivable } from '@odin6/types';
import { formatUSD } from '../utils/formatters';

interface ExternalARSectionProps {
  externalAR: AccountReceivable[];
  externalItems: Record<string, string[]>;
  showLinkAR: boolean;
  onShowLinkARChange: (show: boolean) => void;
  arSearch: string;
  onArSearchChange: (search: string) => void;
  externalCandidates: AccountReceivable[];
  onLinkAR: (ar: AccountReceivable) => void;
  onUnlinkAR: (id: string) => void;
  externalPendingOf: (ar: AccountReceivable) => number;
  externalTotal: number;
}

export function ExternalARSection({
  externalAR,
  externalItems,
  showLinkAR,
  onShowLinkARChange,
  arSearch,
  onArSearchChange,
  externalCandidates,
  onLinkAR,
  onUnlinkAR,
  externalPendingOf,
  externalTotal,
}: ExternalARSectionProps) {
  return (
    <div className="bg-elevated/30 rounded-xl p-3 space-y-2">
      <button
        onClick={() => onShowLinkARChange(!showLinkAR)}
        className="text-xs font-semibold text-content flex items-center gap-1.5 hover:text-accent transition-colors"
      >
        <Link2 className="h-3.5 w-3.5" />
        Vincular cuenta por cobrar de otro cliente
      </button>

      {/* Already linked accounts */}
      {externalAR.length > 0 && (
        <div className="space-y-1.5">
          {externalAR.map((ar) => {
            const items = externalItems[ar.id] ?? [];
            return (
              <div
                key={ar.id}
                className="rounded-lg border border-danger/25 bg-danger/5 p-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/private/accounts-receivable/${ar.id}`}
                    target="_blank"
                    className="min-w-0 inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 underline underline-offset-2 truncate"
                    title="Ver detalle de la cuenta"
                  >
                    <span className="truncate">
                      {ar.invoiceNumber} · {ar.customerName}
                    </span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </Link>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-semibold text-danger">
                      -{formatUSD(externalPendingOf(ar))}
                    </span>
                    <button
                      onClick={() => onUnlinkAR(ar.id)}
                      className="text-dim hover:text-danger"
                      title="Desvincular cuenta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <p className="text-[10px] text-dim">
                  {new Date(ar.createdAt).toLocaleDateString('es-VE')}
                  {ar.description ? ` · ${ar.description}` : ''}
                </p>
                {items.length > 0 && (
                  <p className="text-[10px] text-content/70 leading-snug">
                    {items.slice(0, 8).join(' · ')}
                    {items.length > 8 && ` · +${items.length - 8} más`}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex justify-between text-[11px] font-medium px-1">
            <span className="text-dim">
              Total asumido ({externalAR.length} cuenta
              {externalAR.length !== 1 ? 's' : ''})
            </span>
            <span className="text-danger">{formatUSD(externalTotal)}</span>
          </div>
        </div>
      )}

      {/* Search section */}
      {showLinkAR && (
        <>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-dim absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={arSearch}
              onChange={(e) => onArSearchChange(e.target.value)}
              placeholder="Buscar cliente o factura..."
              className="input-field !py-1.5 !pl-7 !pr-2 text-xs w-full"
            />
          </div>
          {arSearch.trim().length >= 2 && externalCandidates.length === 0 && (
            <p className="text-[10px] text-dim">
              Sin cuentas pendientes que coincidan
            </p>
          )}
          {externalCandidates.map((ar) => (
            <div
              key={ar.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-elevated transition-colors"
            >
              <button
                onClick={() => onLinkAR(ar)}
                className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
                title="Vincular esta cuenta al pago"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-content truncate">
                    {ar.customerName}
                  </span>
                  <span className="block text-[10px] text-dim truncate">
                    {ar.invoiceNumber} ·{' '}
                    {new Date(ar.createdAt).toLocaleDateString('es-VE')}
                  </span>
                </span>
                <span className="text-xs font-medium text-danger flex-shrink-0">
                  {formatUSD(externalPendingOf(ar))}
                </span>
              </button>
              <Link
                href={`/private/accounts-receivable/${ar.id}`}
                target="_blank"
                className="text-dim hover:text-accent flex-shrink-0"
                title="Ver detalle en otra pestaña"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
          <p className="text-[10px] text-dim">
            Toca una cuenta para vincularla (puedes vincular varias). Se
            descuenta completa y queda saldada a nombre del empleado.
          </p>
        </>
      )}
    </div>
  );
}
