'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw, TrendingDown } from 'lucide-react';
import { useAlertsPanel } from '@/hooks/useAlerts';
import { useState } from 'react';
import { PRIVATE_ROUTES } from '@/shared';
import RecalcularCostosModal from '@/features/products/components/RecalcularCostosModal';

const COLOR_NIVEL: Record<string, string> = {
  NEGATIVO: 'text-danger',
  NULO: 'text-danger',
  BAJO: 'text-warn',
};

const ETIQUETA_NIVEL: Record<string, string> = {
  NEGATIVO: 'pierde plata',
  NULO: 'al costo',
  BAJO: 'margen bajo',
};

/**
 * AVISO TEMPRANO de rentabilidad.
 *
 * Cuando sube el precio de un insumo, sube el costo de todo lo que lo lleva; si
 * el precio de venta no se mueve, el margen se come solo. Antes eso no lo veía
 * nadie hasta el cuadre del mes, porque el costo de un plato solo se
 * recalculaba al guardar su receta. Ahora el servidor lo recalcula con cada
 * compra y deja aquí lo que quedó mal.
 */
export default function MargenesEnRiesgoCard() {
  const { data: alertsPanelData, isLoading } = useAlertsPanel();
  const alertas = alertsPanelData?.margenes ?? [];
  // La vista previa vive en el modal: el repaso ya no guarda sin mostrar qué
  // cambia (los cambios sospechosos quedan retenidos hasta revisarlos).
  const [recalcularAbierto, setRecalcularAbierto] = useState(false);

  const lista = alertas;
  const pierden = lista.filter((a) => a.nivel !== 'BAJO').length;

  const repasar = () => setRecalcularAbierto(true);

  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${lista.length ? 'bg-danger/15' : 'bg-elevated'}`}
          >
            <TrendingDown
              className={`w-4 h-4 ${lista.length ? 'text-danger' : 'text-dim'}`}
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-content">
              Márgenes en riesgo
            </h3>
            <p className="text-xs text-dim">
              {isLoading
                ? 'Consultando…'
                : lista.length === 0
                  ? 'Todo por encima del mínimo'
                  : `${lista.length} producto${lista.length === 1 ? '' : 's'}${
                      pierden
                        ? ` · ${pierden} pierde${pierden === 1 ? '' : 'n'} plata`
                        : ''
                    }`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={repasar}
          title="Muestra qué cambiaría al recalcular el costo de cada preparado"
          className="flex items-center gap-1.5 text-xs font-semibold text-dim hover:text-brand"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Repasar
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-9 bg-elevated rounded-lg animate-pulse" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-dim py-2">
          Ningún producto se está vendiendo por debajo del margen mínimo.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {lista.slice(0, 6).map((a) => (
              <Link
                key={a.productId}
                href={PRIVATE_ROUTES.PRODUCTS_EDIT(a.productId)}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-page hover:bg-elevated transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-content truncate">{a.name}</p>
                  {a.insumoName && (
                    <p className="text-[11px] text-dim truncate">
                      subió {a.insumoName}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold ${COLOR_NIVEL[a.nivel] ?? 'text-dim'}`}
                  >
                    {a.marginPct}%
                  </p>
                  <p className="text-[10px] text-dim">
                    {ETIQUETA_NIVEL[a.nivel] ?? a.nivel}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {lista.length > 6 && (
            <Link
              href={`${PRIVATE_ROUTES.PRODUCTS}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline mt-3"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Ver los {lista.length} en Productos
            </Link>
          )}
        </>
      )}
      <RecalcularCostosModal
        isOpen={recalcularAbierto}
        onClose={() => setRecalcularAbierto(false)}
      />
    </div>
  );
}
