'use client';

import { Crown } from 'lucide-react';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { usePanelTopMesoneros } from '@/hooks/usePanel';
import EstadoDeBloque from '@/components/shared/estado/EstadoDeBloque';

const iniciales = (nombre: string): string =>
  nombre
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

/**
 * Mesoneros por venta del periodo.
 *
 * La venta es el SUBTOTAL: sin el 10% de servicio y sin propina, o sea lo que
 * el mesonero vendio de verdad. Se dice en pantalla, porque si no la suma de
 * este ranking no coincide con la tarjeta de arriba y parece un error.
 *
 * Tambien cuenta el credito. Antes exigia `paymentStatus === 'paid'`: un
 * mesonero que abrio cuentas a credito aparecia como si no hubiera vendido.
 */
export default function RankingMesoneros({
  interval,
}: {
  interval: SalesIntervalEnum;
}) {
  const { data, isLoading, error, refetch } = usePanelTopMesoneros(interval);
  const mesoneros = data?.mesoneros ?? [];
  const maximo = Math.max(...mesoneros.map((m) => m.venta), 1);

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
          Mesoneros
        </h2>
        <Crown className="h-4 w-4 text-accent" aria-hidden="true" />
      </div>
      <p className="mb-4 text-xs text-dim">
        Venta sin el 10% de servicio ni propina
      </p>

      <EstadoDeBloque
        motivoVacio="no porque no haya ventas"
        que="el ranking de mesoneros"
        cargando={isLoading}
        error={error}
        reintentar={() => void refetch()}
        esqueleto={
          <div className="animate-pulse space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-11 rounded bg-elevated" />
            ))}
          </div>
        }
      >
        {mesoneros.length === 0 ? (
          <p className="py-8 text-center text-sm text-dim">
            Sin ventas en este período
          </p>
        ) : (
          <ol className="space-y-3">
            {mesoneros.map((mesonero, indice) => (
              <li key={mesonero.waiterId} className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    indice === 0
                      ? 'bg-accent text-page'
                      : 'bg-elevated text-dim'
                  }`}
                  aria-hidden="true"
                >
                  {iniciales(mesonero.nombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className="text-sm font-medium leading-snug text-content"
                      title={mesonero.nombre}
                    >
                      {mesonero.nombre}
                    </p>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-content">
                      {formatearUsdConMiles(mesonero.venta)}
                    </p>
                  </div>
                  <p className="text-xs text-dim">
                    {mesonero.ordenes}{' '}
                    {mesonero.ordenes === 1 ? 'orden' : 'órdenes'} · promedio{' '}
                    {formatearUsdConMiles(mesonero.ticketPromedio)}
                  </p>
                  <div
                    className="mt-1 h-1 overflow-hidden rounded-full bg-elevated"
                    role="presentation"
                  >
                    <div
                      className={`h-full rounded-full ${indice === 0 ? 'bg-accent' : 'bg-brand'}`}
                      style={{
                        width: `${Math.max((mesonero.venta / maximo) * 100, 3)}%`,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </EstadoDeBloque>
    </section>
  );
}
