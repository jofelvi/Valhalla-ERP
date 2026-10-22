import { FileText, User } from 'lucide-react';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

interface PublicAccountData {
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  pending: number;
  dueDate: string;
}

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

interface AccountSummaryProps {
  account: PublicAccountData;
}

export function AccountSummary({ account }: AccountSummaryProps) {
  return (
    <div className="bg-surface/90 backdrop-blur-sm rounded-2xl shadow-lg border border-amber-100 p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-brand" />
        <span className="text-xs font-semibold text-brand uppercase tracking-wide">
          Cuenta a pagar
        </span>
      </div>
      <p className="text-lg font-bold text-content mb-1">
        #{account.invoiceNumber}
      </p>
      <div className="flex items-center gap-1.5 text-dim text-sm mb-3">
        <User className="w-3.5 h-3.5" />
        {account.customerName}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-amber-100">
        <div>
          <p className="text-[10px] text-dim uppercase">Total</p>
          <p className="text-sm font-bold text-content">
            {formatearUsdConMiles(account.amount)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-dim uppercase">Pagado</p>
          <p className="text-sm font-bold text-ok">
            {formatearUsdConMiles(account.paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-dim uppercase">Pendiente</p>
          <p className="text-sm font-bold text-danger">
            {formatearUsdConMiles(account.pending)}
          </p>
        </div>
      </div>
      <p className="text-xs text-dim mt-3">
        Vence: {formatDate(account.dueDate)}
      </p>
    </div>
  );
}
