'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import {
  formatearUsdConMiles,
  formatearUsdSinDecimales,
} from '@/shared/utils/dinero';
import { DiaDeVenta } from '@odin6/types';
import { usePanelVentaPorDia } from '@/hooks/usePanel';
import EstadoDeBloque from '@/components/shared/estado/EstadoDeBloque';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: DiaDeVenta }>;
  label?: string;
}

/**
 * Venta por jornada DEL PERÍODO ELEGIDO.
 *
 * El grafico viejo dibujaba siempre la semana actual, eligieras lo que
 * eligieras arriba: el titulo decia "Ventas de la Semana" y el selector decia
 * "Mes Actual", y las barras no correspondian a ninguno de los dos.
 *
 * Los colores salen de las variables del tema. Antes estaban quemados
 * (`#0891b2`, `#e0f2fe`), asi que en modo oscuro los ejes quedaban casi
 * ilegibles sobre el fondo negro.
 */
export default function GraficoVenta({
  interval,
}: {
  interval: SalesIntervalEnum;
}) {
  const { data, isLoading, error, refetch } = usePanelVentaPorDia(interval);

  const dias = data?.dias ?? [];
  const hayVenta = dias.some((d) => d.venta > 0);
  const mejor = dias.reduce<DiaDeVenta | null>(
    (mejorHastaAhora, d) =>
      !mejorHastaAhora || d.venta > mejorHastaAhora.venta ? d : mejorHastaAhora,
    null,
  );

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
          Venta por día
        </h2>
        {mejor && mejor.venta > 0 && (
          <p className="text-xs text-dim">
            Mejor día:{' '}
            <span className="font-semibold text-content">{mejor.etiqueta}</span>{' '}
            con {formatearUsdConMiles(mejor.venta)}
          </p>
        )}
      </div>

      <EstadoDeBloque
        motivoVacio="no porque no haya ventas"
        que="la venta por día"
        cargando={isLoading}
        error={error}
        reintentar={() => void refetch()}
        esqueleto={
          <div className="h-64 animate-pulse rounded-lg bg-elevated" />
        }
      >
        {!hayVenta ? (
          <div className="flex h-64 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line">
            <p className="text-sm font-medium text-content">
              Sin ventas en este período
            </p>
            <p className="text-xs text-dim">
              {data?.periodo.etiqueta ?? ''} — elegí otro período arriba
            </p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dias}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--clr-line)"
                  vertical={false}
                />
                <XAxis
                  dataKey="etiqueta"
                  stroke="var(--clr-line)"
                  fontSize={11}
                  tickLine={false}
                  tick={{ fill: 'var(--text-dim)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="var(--clr-line)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  // 56 px cortaban la U de "USD 1.200" y quedaba "JSD 1.200".
                  width={72}
                  tick={{ fill: 'var(--text-dim)' }}
                  tickFormatter={formatearUsdSinDecimales}
                />
                <Tooltip
                  content={<Globo />}
                  cursor={{ fill: 'var(--bg-elevated)' }}
                />
                <Bar
                  dataKey="venta"
                  fill="var(--clr-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </EstadoDeBloque>
    </section>
  );
}

function Globo({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const dia = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-content">{label}</p>
      <p className="tabular-nums text-content">
        {formatearUsdConMiles(dia.venta)}
      </p>
      <p className="text-xs text-dim">
        {dia.ordenes} {dia.ordenes === 1 ? 'orden' : 'órdenes'}
        {dia.ordenes > 0 && (
          <> · promedio {formatearUsdConMiles(dia.venta / dia.ordenes)}</>
        )}
      </p>
    </div>
  );
}
