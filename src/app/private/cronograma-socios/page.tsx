'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { tokenDeSesion } from '@/services/api/apiClient';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { ModuloGuard } from '@/shared/ui/modulos/ModuloGuard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SemanaDeSocio {
  desde: string;
  hasta: string;
  socio: string;
  /** La rotación la calculó el sistema; nadie confirmó esa semana a mano. */
  estimado: boolean;
  venta: number;
  ordenes: number;
  incompletos: number;
  faltante: number;
  porMesonero: Array<{ waiterName: string; ordenes: number; faltante: number }>;
}

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Caracas',
  });

/**
 * Cronograma de administración: qué socio tuvo cada semana y cómo le fue.
 *
 * La semana va de martes a domingo porque el lunes no se factura, igual que el
 * cuadre semanal del negocio.
 */
function CronogramaSociosPageContenido() {
  const [semanas, setSemanas] = useState<SemanaDeSocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const token = await tokenDeSesion();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `${API_BASE_URL}/api/analytics/cronograma-socios`,
        { headers },
      );
      if (!res.ok) throw new Error('No se pudo cargar el cronograma');
      setSemanas((await res.json()) as SemanaDeSocio[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Acumulado por socio, para comparar en igualdad de condiciones. */
  const porSocio = useMemo(() => {
    const m = new Map<
      string,
      { semanas: number; venta: number; incompletos: number; faltante: number }
    >();
    for (const s of semanas) {
      const p = m.get(s.socio) ?? {
        semanas: 0,
        venta: 0,
        incompletos: 0,
        faltante: 0,
      };
      p.semanas += 1;
      p.venta += s.venta;
      p.incompletos += s.incompletos;
      p.faltante += s.faltante;
      m.set(s.socio, p);
    }
    return Array.from(m.entries())
      .map(([socio, v]) => ({
        socio,
        ...v,
        pct: v.venta > 0 ? (v.faltante / v.venta) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [semanas]);

  /** Mesonero acumulado en todo el período: dónde se concentra de verdad. */
  const porMesonero = useMemo(() => {
    const m = new Map<string, { ordenes: number; faltante: number }>();
    for (const s of semanas) {
      for (const w of s.porMesonero) {
        const p = m.get(w.waiterName) ?? { ordenes: 0, faltante: 0 };
        p.ordenes += w.ordenes;
        p.faltante += w.faltante;
        m.set(w.waiterName, p);
      }
    }
    return Array.from(m.entries())
      .map(([waiterName, v]) => ({ waiterName, ...v }))
      .sort((a, b) => b.faltante - a.faltante);
  }, [semanas]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-content">
          Cronograma de administración
        </h1>
        <p className="text-sm text-dim">
          Semana de martes a domingo. Cruzado con los cobros incompletos de cada
          una.
        </p>
      </div>

      {cargando && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-dim" />
        </div>
      )}
      {error && (
        <p className="flex items-center gap-2 text-danger text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}

      {!cargando && semanas.length > 0 && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            {porSocio.map((s) => (
              <div
                key={s.socio}
                className={`p-4 rounded-xl border border-line`}
              >
                <p className="text-sm font-semibold">{s.socio}</p>
                <p className="text-xs opacity-80">
                  {s.semanas} semanas · {formatearUsdConMiles(s.venta)} de venta
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatearUsdConMiles(s.faltante)}
                </p>
                <p className="text-xs opacity-80">
                  {s.pct.toFixed(2)}% de su venta · {s.incompletos} órdenes
                </p>
              </div>
            ))}
          </div>

          {/* Sin esto la tabla invita a una conclusión que los datos no aguantan. */}
          <p className="flex items-start gap-2 text-[11px] text-dim">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Son pocos casos por socio: la diferencia entre uno y otro puede ser
            azar. Sirve para saber dónde mirar, no para concluir. Y mide cuándo
            ocurrió la orden, no quién estaba en la caja.
          </p>

          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-dim text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Semana</th>
                  <th className="text-left px-3 py-2">Socio</th>
                  <th className="text-right px-3 py-2">Venta</th>
                  <th className="text-right px-3 py-2">Órd</th>
                  <th className="text-right px-3 py-2">Incompletos</th>
                  <th className="text-right px-3 py-2">Faltante</th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((s) => {
                  const abierto = abierta === s.desde;
                  return (
                    <Fragment key={s.desde}>
                      <tr
                        onClick={() => setAbierta(abierto ? null : s.desde)}
                        className="border-t border-line hover:bg-elevated cursor-pointer"
                      >
                        <td className="px-3 py-2 text-content whitespace-nowrap">
                          {dia(s.desde)} – {dia(s.hasta)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded border text-xs border-line text-dim`}
                          >
                            {s.socio}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-content">
                          {formatearUsdConMiles(s.venta)}
                        </td>
                        <td className="px-3 py-2 text-right text-dim">
                          {s.ordenes}
                        </td>
                        <td className="px-3 py-2 text-right text-dim">
                          {s.incompletos || '—'}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            s.faltante > 0 ? 'text-danger' : 'text-dim'
                          }`}
                        >
                          {s.faltante > 0
                            ? formatearUsdConMiles(s.faltante)
                            : '—'}
                        </td>
                      </tr>
                      {abierto && s.porMesonero.length > 0 && (
                        <tr className="bg-elevated/50">
                          <td colSpan={6} className="px-6 py-2">
                            <p className="text-xs text-dim mb-1">
                              Quién atendió esas órdenes:
                            </p>
                            {s.porMesonero.map((w) => (
                              <p
                                key={w.waiterName}
                                className="text-xs text-content"
                              >
                                {w.waiterName} —{' '}
                                <span className="text-danger">
                                  {formatearUsdConMiles(w.faltante)}
                                </span>{' '}
                                <span className="text-dim">
                                  ({w.ordenes} órd)
                                </span>
                              </p>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {porMesonero.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-content mb-2">
                Acumulado por mesonero
              </h2>
              <div className="flex flex-wrap gap-2">
                {porMesonero.map((w) => (
                  <span
                    key={w.waiterName}
                    className="px-3 py-1.5 rounded-lg border border-line text-sm text-content"
                  >
                    {w.waiterName}{' '}
                    <span className="text-danger font-semibold">
                      {formatearUsdConMiles(w.faltante)}
                    </span>{' '}
                    <span className="text-dim">({w.ordenes})</span>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-dim mt-2">
                Un mesonero que aparece en semanas de los tres socios apunta a
                la persona, no a la semana.
              </p>
            </div>
          )}

          {semanas.some((s) => s.estimado) && (
            <p className="text-[11px] text-dim">
              La rotación se calcula automáticamente (ciclo de tres). Si alguna
              semana se la cambiaron entre ustedes, avísame y la corrijo — se
              ajusta sin desplegar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function CronogramaSociosPage() {
  return (
    <ModuloGuard modulo="partners">
      <CronogramaSociosPageContenido />
    </ModuloGuard>
  );
}
