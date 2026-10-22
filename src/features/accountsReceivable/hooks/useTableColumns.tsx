import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import Link from '@/shared/ui/AppLink/AppLink';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import {
  FileText,
  Layers,
  Eye,
  Trash2,
  UserCheck,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import {
  formatDate,
  getStatusBadge,
  formatRelative,
  formatDateTime,
} from '../utils/formatting';
import WhatsAppSendButton from '../WhatsAppSendButton';
import { Check } from 'lucide-react';

interface UseTableColumnsParams {
  canSelect: boolean;
  selected: Set<string>;
  selectableIds: string[];
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onDelete: (account: AccountReceivable) => void;
  isSuperAdmin: boolean;
}

export const useTableColumns = ({
  canSelect,
  selected,
  selectableIds,
  allSelected,
  someSelected,
  onToggle,
  onToggleAll,
  onDelete,
  isSuperAdmin,
}: UseTableColumnsParams) => {
  return useMemo<ColumnDef<AccountReceivable>[]>(() => {
    const cols: ColumnDef<AccountReceivable>[] = [];

    if (canSelect) {
      cols.push({
        id: 'select',
        header: () => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAll();
            }}
            disabled={selectableIds.length === 0}
            title={allSelected ? 'Quitar selección' : 'Marcar todas'}
            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              selectableIds.length === 0
                ? 'border-transparent cursor-default opacity-30'
                : allSelected
                  ? 'bg-brand border-brand'
                  : someSelected
                    ? 'bg-brand/40 border-brand'
                    : 'border-line hover:border-brand/50 bg-surface'
            }`}
          >
            {allSelected ? (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            ) : someSelected ? (
              <span className="w-2.5 h-0.5 bg-white rounded-full" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => {
          const receivable = row.original;
          const selectable = !receivable.isMerged;
          const isSelected = selected.has(receivable.id);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (selectable) onToggle(receivable.id);
              }}
              disabled={!selectable}
              className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                !selectable
                  ? 'border-transparent cursor-default opacity-30'
                  : isSelected
                    ? 'bg-brand border-brand'
                    : 'border-line hover:border-brand/50 bg-surface'
              }`}
            >
              {isSelected && (
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              )}
            </button>
          );
        },
      });
    }

    cols.push(
      {
        accessorKey: 'invoiceNumber',
        header: 'Factura',
        cell: ({ row }) => {
          const receivable = row.original;
          return (
            <Link
              href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_DETAILS(receivable.id)}
              className="flex items-center gap-2 group"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${
                  receivable.isConsolidated
                    ? 'bg-gradient-to-br from-brand/60 to-brand'
                    : 'bg-gradient-to-br from-brand/40 to-brand/60'
                }`}
              >
                {receivable.isConsolidated ? (
                  <Layers className="h-3.5 w-3.5 text-white" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-white" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-content text-sm group-hover:text-brand group-hover:underline truncate">
                  #{receivable.invoiceNumber}
                </span>
                {receivable.isConsolidated && (
                  <Badge
                    variant="info"
                    className="w-fit text-[10px] px-1 py-0 h-4 mt-0.5"
                  >
                    Unificada
                  </Badge>
                )}
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: 'customerName',
        header: 'Cliente',
        cell: ({ row }) => {
          const receivable = row.original;
          const customerHref = receivable.customerId
            ? PRIVATE_ROUTES.CUSTOMERS_DETAILS(receivable.customerId)
            : null;
          return (
            <div className="flex flex-col min-w-0 max-w-[180px]">
              {customerHref ? (
                <Link
                  href={customerHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-content text-sm truncate hover:text-brand hover:underline"
                  title={receivable.customerName}
                >
                  {receivable.customerName}
                </Link>
              ) : (
                <span
                  className="font-medium text-content text-sm truncate"
                  title={receivable.customerName}
                >
                  {receivable.customerName}
                </span>
              )}
              {/* El N° de accion va primero y en monoespaciada: es el dato por
                  el que el dueño reconoce a un socio, antes que el nombre. */}
              {receivable.customerMemberAction && (
                <span className="font-mono text-xs font-semibold tabular-nums text-dim">
                  Acción {receivable.customerMemberAction}
                </span>
              )}
              {receivable.customerPhone && (
                <a
                  href={`tel:${receivable.customerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-brand hover:underline"
                  title="Llamar al cliente"
                >
                  <Phone className="w-3 h-3 shrink-0" />
                  {receivable.customerPhone}
                </a>
              )}
              {receivable.description && (
                <span
                  className="text-xs text-dim truncate"
                  title={receivable.description}
                >
                  {receivable.description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'waiter',
        header: 'Mesonero',
        cell: ({ row }) => {
          const waiter = row.original.waiterName;
          return waiter ? (
            <span
              className="flex items-center gap-1.5 text-sm text-content max-w-[150px]"
              title={waiter}
            >
              <UserCheck className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="truncate">{waiter}</span>
            </span>
          ) : (
            <span className="text-xs text-dim">—</span>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-content text-sm">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const receivable = row.original;
          const pending = receivable.amount - receivable.paidAmount;
          const isOverdue =
            new Date(receivable.dueDate) < new Date() && pending > 0;
          return (
            <div className="flex flex-col items-start gap-1">
              {getStatusBadge(receivable.status)}
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px]">
                  Vencido
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: 'Montos',
        cell: ({ row }) => {
          const receivable = row.original;
          const pending = receivable.amount - receivable.paidAmount;
          return (
            <div className="flex flex-col text-right">
              <span className="font-bold text-content text-sm">
                {formatearUsdConMiles(receivable.amount)}
              </span>
              {receivable.paidAmount > 0 && (
                <span className="text-[11px] text-ok">
                  Pagado: {formatearUsdConMiles(receivable.paidAmount)}
                </span>
              )}
              {pending > 0 && (
                <span className="text-[11px] text-danger">
                  Debe: {formatearUsdConMiles(pending)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const receivable = row.original;
          const lastSent = receivable.lastNotificationAt;
          return (
            <div
              className="flex items-center gap-1 justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              {lastSent && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-ok bg-ok/10 border border-ok/30 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  title={`WhatsApp enviado: ${formatDateTime(lastSent)}`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {formatRelative(lastSent)}
                </span>
              )}
              <WhatsAppSendButton account={receivable} />
              <Link
                href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_DETAILS(receivable.id)}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
                  title="Ver detalle"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </Link>
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 flex items-center justify-center shrink-0 border-danger/40 text-danger hover:bg-danger/10"
                  title="Eliminar cuenta"
                  onClick={() => onDelete(receivable)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    );

    return cols;
  }, [
    canSelect,
    selected,
    selectableIds,
    allSelected,
    someSelected,
    onToggle,
    onToggleAll,
    onDelete,
    isSuperAdmin,
  ]);
};
