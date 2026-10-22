'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { usePanelTopProductos } from '@/hooks/usePanel';
import EstadoDeBloque from '@/components/shared/estado/EstadoDeBloque';

/**
 * Productos mas (o menos) vendidos del periodo.
 *
 * Dos cosas cambian respecto al panel viejo:
 *
 * 1. Cuenta TODA la venta del periodo, no solo las ordenes ya pagadas. Antes
 *    filtraba `paymentStatus === 'paid'`, o sea que el ranking ignoraba el
 *    credito entero y nunca cuadraba con la venta del dia.
 * 2. Ya no hay filtro comida/bebida por IDs de Firestore quemados en el
 *    componente: un producto en una categoria nueva se clasificaba mal para
 *    siempre y nadie se enteraba.
 */
export default function RankingProductos({
  interval,
  modo,
}: {
  interval: SalesIntervalEnum;
  modo: 'top' | 'bottom';
}) {
  const esTop = modo === 'top';
  const { data, isLoading, error, refetch } = usePanelTopProductos(
    interval,
    esTop ? 'desc' : 'asc',
  );

  const productos = data?.productos ?? [];
  const maximo = Math.max(...productos.map((p) => p.cantidad), 1);

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
          {esTop ? 'Más vendidos' : 'Menor rotación'}
        </h2>
        {esTop ? (
          <TrendingUp className="h-4 w-4 text-ok" aria-hidden="true" />
        ) : (
          <TrendingDown className="h-4 w-4 text-warn" aria-hidden="true" />
        )}
      </div>
      <p className="mb-4 text-xs text-dim">
        {esTop
          ? 'Lo que más sale, por unidades'
          : 'Lo que menos sale: candidatos a revisar precio o sacar de carta'}
      </p>

      <EstadoDeBloque
        motivoVacio="no porque no haya ventas"
        que={esTop ? 'los más vendidos' : 'los de menor rotación'}
        cargando={isLoading}
        error={error}
        reintentar={() => void refetch()}
        esqueleto={
          <div className="animate-pulse space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 rounded bg-elevated" />
            ))}
          </div>
        }
      >
        {productos.length === 0 ? (
          <p className="py-8 text-center text-sm text-dim">
            Sin ventas en este período
          </p>
        ) : (
          <ol className="space-y-2.5">
            {productos.map((producto, indice) => (
              <li key={producto.productId}>
                <div className="flex items-baseline justify-between gap-3">
                  {/* Se deja envolver en dos lineas en vez de recortar:
                      "Tobo de Cervez…" y "Tequeños de la Ca…" no se distinguen
                      entre si, y son productos distintos. */}
                  <p
                    className="min-w-0 text-sm leading-snug text-content"
                    title={producto.nombre}
                  >
                    <span className="mr-2 text-xs tabular-nums text-dim">
                      {indice + 1}.
                    </span>
                    {producto.nombre}
                  </p>
                  <p className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold text-content">
                      {producto.cantidad}
                    </span>
                    <span className="ml-2 text-xs text-dim">
                      {formatearUsdConMiles(producto.venta)}
                    </span>
                  </p>
                </div>
                {/* La barra solo se dibuja en el ranking de arriba. Abajo todos
                    venden 1 unidad, asi que todas las barras salen llenas y la
                    barra deja de significar nada. */}
                {esTop && (
                  <div
                    className="mt-1 h-1 overflow-hidden rounded-full bg-elevated"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.max((producto.cantidad / maximo) * 100, 3)}%`,
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </EstadoDeBloque>
    </section>
  );
}
