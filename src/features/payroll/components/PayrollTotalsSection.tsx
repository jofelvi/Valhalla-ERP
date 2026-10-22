'use client';
import { formatUSD, formatBs } from '../utils/formatters';

interface PayrollTotalsSectionProps {
  loadingEmployees: boolean;
  employeesCount: number;
  totDias: number;
  totComis: number;
  totTips: number;
  totNeto: number;
  paidConsumos: number;
  bcvRate: number;
  proyectadoNeto: number;
}

export function PayrollTotalsSection({
  loadingEmployees,
  employeesCount,
  totDias,
  totComis,
  totTips,
  totNeto,
  paidConsumos,
  bcvRate,
  proyectadoNeto,
}: PayrollTotalsSectionProps) {
  if (loadingEmployees || employeesCount === 0) {
    return null;
  }

  return (
    <div className="border-t border-line px-6 py-4 bg-elevated/30 grid gap-6 sm:grid-cols-2">
      {/* Pagado real */}
      <div>
        <p className="text-xs font-semibold text-ok uppercase tracking-wide mb-2">
          Pagado esta semana (costo real)
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-dim">Días/sueldos</span>
          <span className="text-right font-medium">{formatUSD(totDias)}</span>
          <span className="text-dim">Comisiones</span>
          <span className="text-right font-medium">{formatUSD(totComis)}</span>
          <span className="text-dim">Propinas</span>
          <span className="text-right font-medium">{formatUSD(totTips)}</span>
          <span className="text-dim">Consumos descontados</span>
          <span className="text-right font-medium text-danger">
            −{formatUSD(paidConsumos)}
          </span>
          <span className="font-semibold text-content border-t border-line pt-1">
            Total neto pagado
          </span>
          <span className="text-right font-bold text-content border-t border-line pt-1">
            {formatUSD(totNeto)}
          </span>
          {bcvRate > 0 && (
            <>
              <span className="text-dim">En Bs</span>
              <span className="text-right font-bold text-ok">
                {formatBs(totNeto, bcvRate)}
              </span>
            </>
          )}
          <span className="text-[11px] text-dim col-span-2 mt-1">
            Incluye nómina + pagos de comisiones de la semana.
          </span>
        </div>
      </div>

      {/* Proyectado pendiente */}
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">
          Proyectado pendiente (aprox.)
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-dim">Por pagar (neto aprox.)</span>
          <span className="text-right font-bold text-content">
            {formatUSD(proyectadoNeto)}
          </span>
          {bcvRate > 0 && (
            <>
              <span className="text-dim">En Bs</span>
              <span className="text-right font-bold text-ok">
                {formatBs(proyectadoNeto, bcvRate)}
              </span>
            </>
          )}
          <span className="text-dim">Empleados activos</span>
          <span className="text-right font-medium">{employeesCount}</span>
          <span className="text-[11px] text-dim col-span-2 mt-1">
            *Estimado a 7 días sin descontar consumos.
          </span>
        </div>
      </div>
    </div>
  );
}
