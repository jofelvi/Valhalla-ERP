'use client';

import { RefreshCw } from 'lucide-react';
import { SalesIntervalEnum } from '@/shared/types/enumShared';

const PERIODOS: { valor: SalesIntervalEnum; etiqueta: string }[] = [
  { valor: SalesIntervalEnum.TODAY, etiqueta: 'Hoy' },
  { valor: SalesIntervalEnum.YESTERDAY, etiqueta: 'Ayer' },
  { valor: SalesIntervalEnum.CURRENT_WEEK, etiqueta: 'Esta semana' },
  { valor: SalesIntervalEnum.PREVIOUS_WEEK, etiqueta: 'Semana pasada' },
  { valor: SalesIntervalEnum.CURRENT_MONTH, etiqueta: 'Este mes' },
  { valor: SalesIntervalEnum.PREVIOUS_MONTH, etiqueta: 'Mes anterior' },
];

interface Props {
  seleccionado: SalesIntervalEnum;
  onCambiar: (periodo: SalesIntervalEnum) => void;
  /** Rango real del período activo, para que no haya que adivinarlo. */
  rango?: string;
  onRecargar: () => void;
  recargando: boolean;
}

/**
 * El selector de periodo, pegado arriba.
 *
 * Antes quedaba al principio de la pagina y once tarjetas debajo dependian de
 * el: al bajar no habia forma de saber que periodo estabas viendo sin volver a
 * subir. Ahora queda a la vista y ademas dice el rango exacto — incluido que la
 * jornada arranca a las 6 AM, que es justo lo que hace que el panel no cuadre
 * contra la caja si uno asume medianoche.
 */
export default function SelectorPeriodo({
  seleccionado,
  onCambiar,
  rango,
  onRecargar,
  recargando,
}: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-line bg-page/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label="Período del panel"
          className="flex flex-wrap gap-1.5"
        >
          {PERIODOS.map((periodo) => {
            const activo = seleccionado === periodo.valor;
            return (
              <button
                key={periodo.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => onCambiar(periodo.valor)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  activo
                    ? 'bg-brand text-on-brand'
                    : 'border border-line bg-surface text-dim hover:border-line hover:text-content'
                }`}
              >
                {periodo.etiqueta}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {rango && <p className="hidden text-xs text-dim sm:block">{rango}</p>}
          <button
            type="button"
            onClick={onRecargar}
            disabled={recargando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-dim transition-colors hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${recargando ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {recargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      {rango && <p className="mt-1.5 text-xs text-dim sm:hidden">{rango}</p>}
    </div>
  );
}
