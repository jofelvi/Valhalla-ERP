import { Badge } from '@/components/shared/badge/badge';
import {
  ClipboardList,
  CircleDollarSign,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { getStatusBadgeLabel, getStatusBadgeVariant } from '../utils';

interface SummaryStatsProps {
  accountReceivable: AccountReceivable;
  billedTotal: number;
  pendingAmount: number;
  isOverdue: boolean;
}

export function SummaryStats({
  accountReceivable,
  billedTotal,
  pendingAmount,
  isOverdue,
}: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-line/50 p-4 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-brand" />
          </div>
          <span className="text-xs font-medium text-brand">Estado</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getStatusBadgeVariant(accountReceivable.status)}>
            {getStatusBadgeLabel(accountReceivable.status)}
          </Badge>
          {isOverdue && <Badge variant="destructive">Vencido</Badge>}
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-line/50 p-4 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
            <CircleDollarSign className="h-4 w-4 text-brand" />
          </div>
          <span className="text-xs font-medium text-brand">Total</span>
        </div>
        <p className="text-xl font-bold text-content truncate">
          {formatearUsdConMiles(billedTotal)}
        </p>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-ok/20 p-4 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-ok/20 rounded-lg flex items-center justify-center">
            <Wallet className="h-4 w-4 text-ok" />
          </div>
          <span className="text-xs font-medium text-ok">Pagado</span>
        </div>
        <p className="text-xl font-bold text-ok truncate">
          {formatearUsdConMiles(accountReceivable.paidAmount)}
        </p>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-danger/20 p-4 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-danger/20 rounded-lg flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-danger" />
          </div>
          <span className="text-xs font-medium text-danger">Pendiente</span>
        </div>
        <p className="text-xl font-bold text-danger truncate">
          {formatearUsdConMiles(pendingAmount)}
        </p>
      </div>
    </div>
  );
}
