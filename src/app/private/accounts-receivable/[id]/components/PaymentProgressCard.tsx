import { TrendingUp } from 'lucide-react';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface PaymentProgressCardProps {
  progressPercent: number;
  paidAmount: number;
  pendingAmount: number;
}

export function PaymentProgressCard({
  progressPercent,
  paidAmount,
  pendingAmount,
}: PaymentProgressCardProps) {
  return (
    <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-line/50 p-4 shadow-md mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold text-content">
            Progreso de Pago
          </span>
        </div>
        <span className="text-sm font-bold text-content">
          {progressPercent}%
        </span>
      </div>
      <div className="w-full bg-elevated/60 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progressPercent >= 100
              ? 'bg-ok'
              : progressPercent > 50
                ? 'bg-brand'
                : progressPercent > 0
                  ? 'bg-accent'
                  : 'bg-elevated'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <FilaDeResumen
        className="text-xs text-brand/80 mt-1.5"
        etiqueta={<>Pagado: {formatearUsdConMiles(paidAmount)}</>}
        valor={<>Pendiente: {formatearUsdConMiles(pendingAmount)}</>}
      />
    </div>
  );
}
