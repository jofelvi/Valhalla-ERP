'use client';

import { useRouter } from 'next/navigation';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { OrdenReciente } from '@odin6/types';
import { usePanelActividad } from '@/hooks/usePanel';
import EstadoDeBloque from '@/components/shared/estado/EstadoDeBloque';

/**
 * Las ultimas ordenes, de verdad.
 *
 * Reemplaza a "Actividad Reciente", que mezclaba tres ordenes con dos clientes
 * y un "Producto actualizado: X" — que no es actividad del negocio — y para
 * poner esas dos lineas bajaba el catalogo entero de productos (0,46 MB) y la
 * lista completa de clientes (1,11 MB): 1,57 MB para tres renglones.
 *
 * Tampoco lleva el punto pulsante que tenia antes en cada fila: sugeria tiempo
 * real y no habia nada en vivo.
 */
export default function UltimasOrdenes() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = usePanelActividad(8);
  const ordenes = data ?? [];

  return (
    <section className="flex max-h-[26rem] flex-col rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex shrink-0 items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
          Últimas órdenes
        </h2>
        <button
          type="button"
          onClick={() => router.push(PRIVATE_ROUTES.ORDERS)}
          className="rounded text-xs font-medium text-brand transition-colors hover:text-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Ver todas
        </button>
      </div>

      <EstadoDeBloque
        motivoVacio="no porque no haya ventas"
        que="las últimas órdenes"
        cargando={isLoading}
        error={error}
        reintentar={() => void refetch()}
        esqueleto={
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded bg-elevated" />
            ))}
          </div>
        }
      >
        {ordenes.length === 0 ? (
          <p className="py-8 text-center text-sm text-dim">
            Todavía no hay órdenes registradas
          </p>
        ) : (
          <ul className="min-h-0 divide-y divide-line overflow-y-auto">
            {ordenes.map((orden) => (
              <Fila key={orden.id} orden={orden} />
            ))}
          </ul>
        )}
      </EstadoDeBloque>
    </section>
  );
}

function Fila({ orden }: { orden: OrdenReciente }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-content">
          <span className="font-medium">#{orden.numero}</span>
          {orden.mesonero && (
            <span className="text-dim"> · {orden.mesonero}</span>
          )}
        </p>
        <p className="text-xs text-dim">
          {haceCuanto(orden.cuando)}
          {orden.mesa && ` · ${orden.mesa}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-content">
          {formatearUsdConMiles(orden.total)}
        </p>
        <EstadoDePago estado={orden.estadoPago} orden={orden.estado} />
      </div>
    </li>
  );
}

function EstadoDePago({ estado, orden }: { estado: string; orden: string }) {
  const normalizado = (estado || orden || '').toUpperCase();
  const cobrada = normalizado === 'PAID';
  const aCredito = normalizado === 'CREDIT' || orden === 'CREDIT';

  return (
    <span
      className={`text-[11px] font-medium ${
        cobrada ? 'text-ok' : aCredito ? 'text-warn' : 'text-dim'
      }`}
    >
      {cobrada ? 'cobrada' : aCredito ? 'a crédito' : 'sin cobrar'}
    </span>
  );
}

/** "hace 5 min", "hace 2 h", "ayer". */
function haceCuanto(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}
