'use client';

import Link from '@/shared/ui/AppLink/AppLink';
import { Card, CardContent } from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import {
  FileText,
  Layers,
  User,
  UserCheck,
  Phone,
  Calendar,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import {
  formatDate,
  formatDateTime,
  formatRelative,
  getStatusBadge,
} from '../utils/formatting';
import WhatsAppSendButton from '../WhatsAppSendButton';
import { Check } from 'lucide-react';

interface AccountsMobileCardProps {
  receivable: AccountReceivable;
  isSelected: boolean;
  selectable: boolean;
  canSelect: boolean;
  isSuperAdmin: boolean;
  onToggle: (id: string) => void;
  onDelete: (account: AccountReceivable) => void;
}

export const AccountsMobileCard = ({
  receivable,
  isSelected,
  selectable,
  canSelect,
  isSuperAdmin,
  onToggle,
  onDelete,
}: AccountsMobileCardProps) => {
  const pending = receivable.amount - receivable.paidAmount;
  const progress =
    receivable.amount > 0
      ? Math.min(
          Math.round((receivable.paidAmount / receivable.amount) * 100),
          100,
        )
      : 0;
  const isOverdue = new Date(receivable.dueDate) < new Date() && pending > 0;

  return (
    <div className="flex items-center gap-2">
      {canSelect && (
        <button
          type="button"
          onClick={() => selectable && onToggle(receivable.id)}
          disabled={!selectable}
          className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            !selectable
              ? 'border-transparent cursor-default opacity-50'
              : isSelected
                ? 'bg-brand border-brand'
                : 'border-line hover:border-brand/50 bg-surface'
          }`}
        >
          {isSelected && (
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          )}
        </button>
      )}

      <Link
        href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_DETAILS(receivable.id)}
        className="flex-1 min-w-0 group/card"
      >
        <Card
          className={`bg-surface/90 backdrop-blur-sm shadow-md transition-all duration-200 ${
            isSelected ? 'border-brand bg-elevated/30' : 'border-line/50'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 w-full">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 mt-0.5 ${
                    receivable.isConsolidated
                      ? 'bg-gradient-to-br from-brand/60 to-brand'
                      : 'bg-gradient-to-br from-brand/40 to-brand/60'
                  }`}
                >
                  {receivable.isConsolidated ? (
                    <Layers className="h-5 w-5 text-white" />
                  ) : (
                    <FileText className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-content text-sm sm:text-base truncate">
                      #{receivable.invoiceNumber}
                    </h3>
                    {receivable.isConsolidated && (
                      <Badge variant="info">Unificada</Badge>
                    )}
                    {getStatusBadge(receivable.status)}
                    {isOverdue && <Badge variant="destructive">Vencido</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 text-dim text-sm mb-1">
                    <User className="w-3.5 h-3.5 shrink-0 text-brand" />
                    <span className="truncate">{receivable.customerName}</span>
                    {receivable.customerMemberAction && (
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-content">
                        · {receivable.customerMemberAction}
                      </span>
                    )}
                  </div>
                  {(receivable.waiterName || receivable.customerPhone) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dim mb-1">
                      {receivable.waiterName && (
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3 h-3 shrink-0 text-accent" />
                          <span className="truncate max-w-[120px]">
                            {receivable.waiterName}
                          </span>
                        </span>
                      )}
                      {receivable.customerPhone && (
                        <span className="flex items-center gap-1.5 text-brand">
                          <Phone className="w-3 h-3 shrink-0" />
                          {receivable.customerPhone}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      Creada: {formatDate(receivable.createdAt)}
                    </span>
                    <span
                      className={`flex items-center gap-1.5 ${isOverdue ? 'text-danger font-medium' : ''}`}
                    >
                      <Calendar className="w-3 h-3 shrink-0" />
                      Vence: {formatDate(receivable.dueDate)}
                    </span>
                    {receivable.lastNotificationAt && (
                      <span
                        className="flex items-center gap-1.5 text-ok"
                        title={`WhatsApp enviado: ${formatDateTime(receivable.lastNotificationAt)}`}
                      >
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        WhatsApp:{' '}
                        {formatRelative(receivable.lastNotificationAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-line/50 pt-3">
                <div className="flex-1">
                  <p className="text-lg font-bold text-content leading-none mb-1">
                    {formatearUsdConMiles(receivable.amount)}
                  </p>
                  <div className="flex gap-2 text-xs">
                    {receivable.paidAmount > 0 && (
                      <span className="text-ok font-medium">
                        Pagado: {formatearUsdConMiles(receivable.paidAmount)}
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="text-danger font-medium">
                        Debe: {formatearUsdConMiles(pending)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-16">
                  <div className="w-full bg-elevated/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress >= 100
                          ? 'bg-gradient-to-r from-ok to-ok'
                          : progress > 50
                            ? 'bg-gradient-to-r from-brand to-brand'
                            : progress > 0
                              ? 'bg-gradient-to-r from-accent to-accent'
                              : 'bg-dim/30'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-brand text-right mt-0.5">
                    {progress}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <div className="flex flex-col gap-1 mt-2">
        <WhatsAppSendButton account={receivable} />
        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 flex items-center justify-center border-danger/40 text-danger hover:bg-danger/10"
            title="Eliminar"
            onClick={() => onDelete(receivable)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
