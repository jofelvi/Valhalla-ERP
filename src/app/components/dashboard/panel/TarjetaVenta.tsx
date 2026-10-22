'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { usePanelVentas } from '@/hooks/usePanel';
import EstadoDeBloque from '@/components/shared/estado/EstadoDeBloque';
import { formatearPeriodo } from './formatoPeriodo';

/**
 * ¿Cuánto vendimos? — la pregunta principal del panel.
 *
 * Va sola y grande a proposito. En el panel viejo esta tarjeta estaba en una
 * fila de seis, del mismo tamaño que "De otros períodos", con ~200 px de ancho
 * para el numero que mas importa del dia.
 *
 * El desglose va en formato de RECIBO — concepto a la izquierda, monto alineado
 * a la derecha — porque la version anterior escribia
 * "Entró en caja $398,41 / $390,92 de venta + $7,49 en propinas" y ese "+" se
 * leia como si la propina fuera aparte de los $398,41, cuando ya estaba dentro.
 */
export default function TarjetaVenta({
  interval,
}: {
  interval: SalesIntervalEnum;
}) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = usePanelVentas(interval);

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
          Facturado
        </h2>
        {data && (
          <p className="text-xs text-dim">
            {data.periodo.etiqueta} · {formatearPeriodo(data.periodo)}
          </p>
        )}
      </div>

      <EstadoDeBloque
        motivoVacio="no porque no haya ventas"
        que="la venta del período"
        cargando={isLoading}
        error={error}
        reintentar={() => void refetch()}
        esqueleto={
          <div className="animate-pulse space-y-4">
            <div className="h-11 w-56 rounded bg-elevated" />
            <div className="h-3 w-40 rounded bg-elevated" />
            <div className="space-y-2 pt-3">
              <div className="h-3 w-full rounded bg-elevated" />
              <div className="h-3 w-full rounded bg-elevated" />
              <div className="h-3 w-2/3 rounded bg-elevated" />
            </div>
          </div>
        }
      >
        {data && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-bold leading-none tracking-tight text-content tabular-nums sm:text-5xl">
                  {formatearUsdConMiles(data.venta)}
                </p>
                <p className="mt-2 text-sm text-dim">
                  {data.ordenes} {data.ordenes === 1 ? 'orden' : 'órdenes'}
                  {data.ordenes > 0 && (
                    <>
                      {' · '}
                      ticket promedio{' '}
                      <span className="text-content tabular-nums">
                        {formatearUsdConMiles(data.venta / data.ordenes)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {data.comparacion && (
                <Variacion
                  etiqueta={data.comparacion.etiqueta}
                  pct={data.comparacion.variacionPct}
                  venta={data.comparacion.venta}
                />
              )}
            </div>

            {/* Recibo: cada linea dice QUE es y cuanto, alineado. */}
            <dl className="mt-5 space-y-0 border-t border-line pt-4 text-sm">
              <Linea
                concepto="Ya cobrado"
                monto={data.cobrado}
                ayuda="Sale de los pagos registrados, no del estado de la orden."
              />
              <Linea
                concepto="Falta por cobrar"
                monto={data.porCobrar}
                tono={data.porCobrar > 0 ? 'atencion' : 'normal'}
                accion={
                  data.porCobrar > 0
                    ? () => router.push(PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE)
                    : undefined
                }
              />
              <div className="my-2 border-t border-line/60" />
              <Linea
                concepto="Venta del período"
                monto={data.venta}
                destacado
              />
            </dl>

            {(data.propinaTotal > 0 || data.socios.monto > 0) && (
              <div className="mt-4 space-y-2 border-t border-line pt-4">
                {data.propinaTotal > 0 && (
                  <p className="text-xs leading-relaxed text-dim">
                    <span className="font-semibold text-content tabular-nums">
                      {formatearUsdConMiles(data.propinaTotal)}
                    </span>{' '}
                    de propina, que es del mesonero y{' '}
                    <span className="font-medium text-content">
                      no está sumada arriba
                    </span>
                    .
                    {data.propinaTotal - data.propinaCobrada > 0.01 && (
                      <>
                        {' '}
                        De eso,{' '}
                        {formatearUsdConMiles(
                          data.propinaTotal - data.propinaCobrada,
                        )}{' '}
                        sigue en cuentas sin cobrar.
                      </>
                    )}
                  </p>
                )}
                {data.socios.monto > 0 && (
                  <p className="text-xs leading-relaxed text-dim">
                    No incluye{' '}
                    <span className="font-semibold text-content tabular-nums">
                      {formatearUsdConMiles(data.socios.monto)}
                    </span>{' '}
                    de consumo de socios ({data.socios.ordenes}{' '}
                    {data.socios.ordenes === 1 ? 'orden' : 'órdenes'}): se
                    factura pero no se cobra.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </EstadoDeBloque>
    </section>
  );
}

function Linea({
  concepto,
  monto,
  ayuda,
  destacado = false,
  tono = 'normal',
  accion,
}: {
  concepto: string;
  monto: number;
  ayuda?: string;
  destacado?: boolean;
  tono?: 'normal' | 'atencion';
  accion?: () => void;
}) {
  const contenido = (
    <>
      <dt className={destacado ? 'font-semibold text-content' : 'text-dim'}>
        {concepto}
        {ayuda && (
          <span className="ml-1.5 hidden text-xs text-dim/70 sm:inline">
            {ayuda}
          </span>
        )}
      </dt>
      <dd
        className={`tabular-nums ${
          destacado
            ? 'text-base font-bold text-content'
            : tono === 'atencion'
              ? 'font-semibold text-warn'
              : 'font-semibold text-content'
        }`}
      >
        {formatearUsdConMiles(monto)}
      </dd>
    </>
  );

  if (accion) {
    return (
      <button
        type="button"
        onClick={accion}
        className="group flex w-full items-baseline justify-between gap-4 rounded py-1.5 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {contenido}
        <ArrowRight className="h-3.5 w-3.5 shrink-0 self-center text-dim opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      {contenido}
    </div>
  );
}

function Variacion({
  etiqueta,
  pct,
  venta,
}: {
  etiqueta: string;
  pct: number | null;
  venta: number;
}) {
  // Sin base contra la que comparar, un "+100%" es mentira: se dice lo que es.
  if (pct === null) {
    return (
      <div className="text-right">
        <p className="text-xs text-dim">{etiqueta}</p>
        <p className="text-xs text-dim">sin ventas antes</p>
      </div>
    );
  }

  const Icono = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const color = pct > 0 ? 'text-ok' : pct < 0 ? 'text-danger' : 'text-dim';

  return (
    <div className="text-right">
      <p
        className={`flex items-center justify-end gap-1 text-lg font-bold tabular-nums ${color}`}
      >
        <Icono className="h-4 w-4" />
        {pct > 0 ? '+' : ''}
        {pct}%
      </p>
      <p className="text-xs text-dim">
        {etiqueta} ({formatearUsdConMiles(venta)})
      </p>
    </div>
  );
}
