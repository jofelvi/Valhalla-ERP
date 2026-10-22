import { ShieldCheck, RefreshCw } from 'lucide-react';

interface VerifyPaymentsHeaderProps {
  isLoading: boolean;
  filteredCount: number;
  totalCount: number;
  hasActiveFilter: boolean;
  onRefresh: () => void;
}

export const VerifyPaymentsHeader = ({
  isLoading,
  filteredCount,
  totalCount,
  hasActiveFilter,
  onRefresh,
}: VerifyPaymentsHeaderProps) => {
  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-accent" />
          <h1 className="text-xl md:text-2xl font-bold text-content">
            Verificar Pagos
          </h1>
          <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-semibold rounded-full">
            {hasActiveFilter ? `${filteredCount} / ${totalCount}` : totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-surface border border-line rounded-lg hover:bg-elevated text-dim hover:text-content"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refrescar
        </button>
      </div>

      <p className="text-sm text-dim mb-4">
        Pensado para eventos. Aprueba multiples pagos en bloque (genera
        facturas, comisiones, libera mesas e imprime ticket termico).
      </p>
    </>
  );
};
