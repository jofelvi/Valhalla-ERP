import { RefreshCw } from 'lucide-react';
import { formatearBs } from '@/shared/utils/dinero';

interface BcvRateDisplayProps {
  bcvRate: number;
  loading: boolean;
  onRefresh: () => void;
}

export function BcvRateDisplay({
  bcvRate,
  loading,
  onRefresh,
}: BcvRateDisplayProps) {
  return (
    <div className="bg-elevated border border-blue-200 rounded-xl p-3 mb-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] text-blue-600 font-semibold uppercase">
          Tasa BCV
        </p>
        <p className="text-base font-bold text-blue-900">
          {bcvRate > 0 ? `${formatearBs(bcvRate)} / USD` : 'Cargando...'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors disabled:opacity-50"
        title="Actualizar tasa"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
