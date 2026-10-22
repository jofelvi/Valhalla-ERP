'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { Button } from '@/components/shared/button/Button';
import { useRecalcularCostos } from '@/hooks/useProducts';
import type { ResultadoRecalculo } from '@/hooks/useProducts';
import { formatearUsd } from '@/shared/utils/dinero';
import { useToast } from '@/shared/hooks/useToast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MOTIVO: Record<'baja-fuerte' | 'sube-fuerte', string> = {
  'baja-fuerte': 'baja más de 40 %',
  'sube-fuerte': 'sube más de 3 veces',
};

/**
 * "Recalcular costos" con vista previa.
 *
 * El botón de antes recalculaba en el navegador y guardaba producto por
 * producto sin mostrar nada: con 54 insumos mal cargados habría pisado ~70
 * platos con costos 3–10 veces más bajos (y márgenes perfectos falsos). Ahora
 * el servidor calcula en seco, esta pantalla muestra qué cambiaría, y recién
 * al confirmar se guarda. Los cambios sospechosos quedan retenidos hasta que
 * se revisan.
 */
export default function RecalcularCostosModal({ isOpen, onClose }: Props) {
  const recalcular = useRecalcularCostos();
  const toast = useToast();
  const [plan, setPlan] = useState<ResultadoRecalculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aplicarRetenidos, setAplicarRetenidos] = useState(false);
  // Plan recalculado CON los retenidos: al forzarlos, lo que depende de ellos
  // también cambia, y la vista previa tiene que mostrarlo, no solo prometerlo.
  const [planForzado, setPlanForzado] = useState<ResultadoRecalculo | null>(
    null,
  );

  // Al abrir se pide la vista previa; nada se guarda.
  useEffect(() => {
    if (!isOpen) return;
    setPlan(null);
    setError(null);
    setAplicarRetenidos(false);
    setPlanForzado(null);
    recalcular
      .mutateAsync({ dryRun: true })
      .then(setPlan)
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudo calcular la vista previa',
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const vigente = aplicarRetenidos && planForzado ? planForzado : plan;
  const aplicables = vigente?.costosActualizados.length ?? 0;
  const retenidos = plan?.retenidos ?? [];
  const omitidos = plan?.omitidos ?? [];
  const aGuardar = aplicables;

  const alternarRetenidos = async (marcado: boolean) => {
    setAplicarRetenidos(marcado);
    if (marcado && !planForzado) {
      try {
        setPlanForzado(
          await recalcular.mutateAsync({ dryRun: true, forzar: true }),
        );
      } catch {
        setAplicarRetenidos(false);
        toast.error({
          title: 'No se pudo recalcular la vista previa',
          description: 'Inténtalo de nuevo.',
        });
      }
    }
  };

  const confirmar = async () => {
    try {
      const r = await recalcular.mutateAsync({ forzar: aplicarRetenidos });
      toast.success({
        title: 'Costos recalculados',
        description: `${r.costosActualizados.length} producto(s) actualizados desde su receta.`,
      });
      onClose();
    } catch (e: unknown) {
      toast.error({
        title: 'No se pudo recalcular',
        description: e instanceof Error ? e.message : 'Inténtalo de nuevo.',
      });
    }
  };

  const cargando = !plan && !error;
  const cargandoForzado = aplicarRetenidos && !planForzado;
  const guardando = recalcular.isPending && !!plan && !cargandoForzado;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titulo="Recalcular costos"
      descripcion="Mira qué cambiaría antes de guardar. Nada se modifica hasta que confirmes."
      className="max-w-2xl"
      hojaEnMovil
      pie={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={
              cargando || cargandoForzado || guardando || aGuardar === 0
            }
          >
            {guardando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `Aplicar ${aGuardar} cambio${aGuardar === 1 ? '' : 's'}`
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-1 overflow-y-auto">
        {cargando && (
          <p className="flex items-center gap-2 text-sm text-dim">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculando la vista
            previa…
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}

        {plan && (
          <>
            <section>
              <h4 className="text-sm font-bold text-content mb-2">
                Se actualizarían ({aplicables})
              </h4>
              {aplicables === 0 ? (
                <p className="text-sm text-dim">
                  Todos los costos ya coinciden con sus recetas.
                </p>
              ) : (
                <FilasDeCambio cambios={vigente?.costosActualizados ?? []} />
              )}
            </section>

            {retenidos.length > 0 && (
              <section className="rounded-xl border border-warn/50 bg-warn/10 p-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-warn mb-1">
                  <AlertTriangle className="w-4 h-4" /> Retenidos por
                  sospechosos ({retenidos.length})
                </h4>
                <p className="text-xs text-dim mb-2">
                  Un costo no suele bajar a la mitad ni triplicarse de golpe.
                  Revisa primero el precio o las equivalencias del insumo.
                </p>
                <FilasDeCambio cambios={retenidos} />
                <label className="mt-3 flex items-start gap-2 text-sm text-content cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aplicarRetenidos}
                    onChange={(e) => alternarRetenidos(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Ya los revisé: aplicar también estos {retenidos.length}
                  </span>
                </label>
              </section>
            )}

            {omitidos.length > 0 && (
              <section className="rounded-xl border border-danger/50 bg-danger/10 p-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-danger mb-1">
                  <AlertTriangle className="w-4 h-4" /> No se pudieron costear (
                  {omitidos.length})
                </h4>
                <p className="text-xs text-dim mb-2">
                  Conservan el costo que tenían. Corrige la línea indicada.
                </p>
                <ul className="space-y-1.5">
                  {omitidos.map((o) => (
                    <li key={o.productId} className="text-sm">
                      <span className="font-semibold text-content">
                        {o.name}
                      </span>
                      {o.issues.map((i, k) => (
                        <span
                          key={k}
                          className="block text-xs text-danger leading-tight"
                        >
                          {i.mensaje}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function FilasDeCambio({
  cambios,
}: {
  cambios: ResultadoRecalculo['costosActualizados'];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-dim text-left">
            <th className="px-3 py-2">Producto</th>
            <th className="px-3 py-2 text-right">Antes</th>
            <th className="px-3 py-2 text-right">Después</th>
            <th className="px-3 py-2 text-right">Cambio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {cambios.map((c) => {
            const pct =
              c.costoAnterior > 0
                ? ((c.costoNuevo - c.costoAnterior) / c.costoAnterior) * 100
                : null;
            return (
              <tr key={c.productId}>
                <td className="px-3 py-1.5 text-content">
                  {c.name}
                  {c.sospechoso && (
                    <span className="block text-[10px] text-warn">
                      {MOTIVO[c.sospechoso]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right text-dim">
                  {formatearUsd(c.costoAnterior)}
                </td>
                <td className="px-3 py-1.5 text-right text-content font-semibold">
                  {formatearUsd(c.costoNuevo)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right ${
                    pct === null || Math.abs(pct) < 0.5
                      ? 'text-dim'
                      : pct > 0
                        ? 'text-danger'
                        : 'text-ok'
                  }`}
                >
                  {pct === null
                    ? 'nuevo'
                    : Math.abs(pct) < 0.5
                      ? 'igual'
                      : `${pct > 0 ? '+' : ''}${pct.toFixed(0)} %`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
