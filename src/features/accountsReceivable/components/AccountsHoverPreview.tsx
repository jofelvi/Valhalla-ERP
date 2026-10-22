'use client';

import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { User, Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDate, formatRelative } from '../utils/formatting';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

interface HoverItem {
  name: string;
  quantity: number;
  total: number;
}

interface AccountsHoverPreviewProps {
  account: AccountReceivable;
  items: HoverItem[];
  totalItems: number;
  loading: boolean;
  position: { top: number; left: number };
}

export const AccountsHoverPreview = ({
  account,
  items,
  totalItems,
  loading,
  position,
}: AccountsHoverPreviewProps) => {
  return (
    <div
      className="fixed z-50 bg-surface/95 backdrop-blur-md border border-line/50 rounded-xl shadow-2xl w-80 pointer-events-none animate-in fade-in duration-150"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3.5 pt-3 pb-2.5 border-b border-line/50">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="font-mono font-bold text-content text-sm truncate">
            #{account.invoiceNumber}
          </span>
          {account.isConsolidated && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-brand/40 text-brand bg-brand/10 shrink-0">
              Unificada
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-dim">
          <span className="flex items-center gap-1 truncate">
            <User className="w-3 h-3 text-brand shrink-0" />
            <span className="truncate">{account.customerName}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3 h-3 shrink-0" />
            {formatDate(account.createdAt)}
          </span>
        </div>
        {account.lastNotificationAt && (
          <div className="flex items-center gap-1 text-[11px] text-ok mt-1.5">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>
              Último WhatsApp: {formatRelative(account.lastNotificationAt)}
            </span>
          </div>
        )}
      </div>

      <div className="px-3.5 py-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-3 text-dim text-xs gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Cargando productos...
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-dim text-center py-2">
            Sin productos asociados
          </p>
        ) : (
          <>
            <p className="text-[10px] font-semibold text-dim uppercase tracking-wider mb-1.5">
              Productos ({items.length})
            </p>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center gap-2 py-0.5"
                >
                  <span className="text-xs text-content truncate flex-1">
                    <span className="font-semibold text-brand">
                      {item.quantity}x
                    </span>{' '}
                    {item.name}
                  </span>
                  <span className="text-xs font-medium text-dim whitespace-nowrap">
                    {formatearUsdConMiles(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-3.5 py-2.5 bg-brand/5 rounded-b-xl border-t border-line/50 flex justify-between items-center">
        <span className="text-xs text-dim">
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </span>
        <span className="text-sm font-bold text-brand">
          {formatearUsdConMiles(account.amount)}
        </span>
      </div>
    </div>
  );
};
