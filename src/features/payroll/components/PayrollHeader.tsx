'use client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface PayrollHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  bcvRate: number;
  loadingRate: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onRefreshRate: () => void;
  onExportPdf: () => void;
}

export function PayrollHeader({
  weekStart,
  weekEnd,
  bcvRate,
  loadingRate,
  onPrevWeek,
  onNextWeek,
  onRefreshRate,
  onExportPdf,
}: PayrollHeaderProps) {
  const weekLabel = `${format(weekStart, 'd', { locale: es })} - ${format(
    weekEnd,
    'd MMM yyyy',
    { locale: es },
  )}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevWeek}
          className="p-2 rounded-xl hover:bg-elevated transition-colors text-dim hover:text-content"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="px-4 py-2 bg-elevated rounded-xl">
          <p className="text-sm font-semibold text-content capitalize">
            {weekLabel}
          </p>
        </div>
        <button
          onClick={onNextWeek}
          className="p-2 rounded-xl hover:bg-elevated transition-colors text-dim hover:text-content"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onExportPdf}
        className="px-4 py-2 rounded-xl border border-line text-sm font-medium text-content hover:bg-elevated transition-colors"
        title="Descargar la nómina de esta semana con el desglose y los totales"
      >
        Exportar PDF
      </button>

      <div className="flex items-center gap-2 px-4 py-2 bg-ok/10 border border-ok/20 rounded-xl">
        {loadingRate ? (
          <span className="text-xs text-dim animate-pulse">
            Cargando tasa...
          </span>
        ) : (
          <>
            <div>
              <p className="text-xs text-dim">Tasa BCV</p>
              <p className="text-sm font-bold text-ok">
                Bs{' '}
                {bcvRate.toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                })}{' '}
                /USD
              </p>
            </div>
            <button
              onClick={onRefreshRate}
              className="p-1.5 rounded-lg hover:bg-ok/20 transition-colors text-ok"
              title="Actualizar tasa"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
