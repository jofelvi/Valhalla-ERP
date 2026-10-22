'use client';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  XCircle,
} from 'lucide-react';
import type { OrderWithCreditRequest } from '@odin6/types';
import Link from '@/shared/ui/AppLink/AppLink';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsd } from '@/shared/utils/dinero';
import { cn } from '@/shared/utils/utils';
import {
  agruparPorCliente,
  sePuedeAutorizar,
  type FilaDeSolicitud,
  type GrupoDeCliente,
} from '../utils/clasificarSolicitudes';
import type { EstadoDeSolicitudes } from '../hooks/useSolicitudesDeCredito';

type Filtro = 'porDecidir' | 'cobradas' | 'todas';

/** A partir de cuantos dias una solicitud se marca como vieja. */
const DIAS_VIEJA = 3;
/** Grupos con mas filas que esto arrancan plegados. */
const FILAS_ABIERTAS = 3;

const esResuelta = (f: FilaDeSolicitud) =>
  f.cobro.tipo === 'cobrada' || f.cobro.tipo === 'enCero';

const numeroDe = (s: OrderWithCreditRequest) =>
  s.orderNumber ?? `#${s.id.slice(-8).toUpperCase()}`;

const hace = (dias: number) =>
  dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;

function ChipDeCobro({ fila }: { fila: FilaDeSolicitud }) {
  const { cobro } = fila;
  if (cobro.tipo === 'cobrada') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Ya cobrada
      </span>
    );
  }
  if (cobro.tipo === 'parcial') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn tabular-nums">
        <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
        Pagó {formatearUsd(cobro.pagado)} · falta {formatearUsd(cobro.falta)}
      </span>
    );
  }
  if (cobro.tipo === 'enCero') {
    return (
      <span className="inline-flex items-center rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-dim">
        Orden en $0
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-dim">
      Sin cobrar
    </span>
  );
}

function Casilla({
  marcada,
  mixta = false,
  onChange,
  etiqueta,
}: {
  marcada: boolean;
  mixta?: boolean;
  onChange: () => void;
  etiqueta: string;
}) {
  return (
    <input
      type="checkbox"
      checked={marcada}
      ref={(el) => {
        if (el) el.indeterminate = mixta;
      }}
      onChange={onChange}
      aria-label={etiqueta}
      className="h-4 w-4 cursor-pointer accent-accent"
    />
  );
}

interface Props {
  estado: EstadoDeSolicitudes;
}

/**
 * Las solicitudes de credito como una tabla, agrupadas por cliente.
 *
 * Reemplaza a las tarjetas del 20/09/2026: con 25 solicitudes eran 1.300 px
 * de tarjetas iguales que enterraban los pagos por verificar, sin fecha, y con
 * el boton "Autorizar" encendido en ordenes que ya se habian cobrado.
 */
export function TablaDeSolicitudes({ estado }: Props) {
  const { solicitudes, abrirAutorizar, abrirRechazar, abrirCerrar } = estado;
  const [filtro, setFiltro] = useState<Filtro>('porDecidir');
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});

  // La antiguedad se recalcula con cada refresco de la lista, no en cada render.
  const grupos = useMemo(
    () => agruparPorCliente(solicitudes, new Date()),
    [solicitudes],
  );
  const filas = useMemo(() => grupos.flatMap((g) => g.filas), [grupos]);
  const resueltas = filas.filter(esResuelta);
  const porDecidir = filas.length - resueltas.length;

  const visibles = useMemo(() => {
    const pasa = (f: FilaDeSolicitud) =>
      filtro === 'todas' ||
      (filtro === 'cobradas' ? esResuelta(f) : !esResuelta(f));
    return grupos
      .map((g) => {
        // La cabecera del grupo habla de lo que se ve, no de lo filtrado.
        const filasVisibles = g.filas.filter(pasa);
        return {
          ...g,
          filas: filasVisibles,
          diasMasVieja: Math.max(0, ...filasVisibles.map((f) => f.dias)),
        };
      })
      .filter((g) => g.filas.length > 0);
  }, [grupos, filtro]);

  // Si una solicitud desaparece (la decidio otra caja), sale de la seleccion.
  const vivas = new Set(filas.map((f) => f.solicitud.id));
  const seleccion = filas.filter(
    (f) => marcadas.has(f.solicitud.id) && vivas.has(f.solicitud.id),
  );
  const idsAutorizables = seleccion
    .filter((f) => sePuedeAutorizar(f.cobro))
    .map((f) => f.solicitud.id);
  const idsResueltos = seleccion.filter(esResuelta).map((f) => f.solicitud.id);
  const montoSeleccion = seleccion.reduce((s, f) => s + f.cobro.falta, 0);

  const alternar = (ids: string[], marcar: boolean) =>
    setMarcadas((prev) => {
      const nuevo = new Set(prev);
      for (const id of ids) {
        if (marcar) nuevo.add(id);
        else nuevo.delete(id);
      }
      return nuevo;
    });
  const limpiar = () => setMarcadas(new Set());

  const estaPlegado = (g: GrupoDeCliente) =>
    plegados[g.clave] ?? g.filas.length > FILAS_ABIERTAS;

  const opciones: Array<{ valor: Filtro; texto: string; n: number }> = [
    { valor: 'porDecidir', texto: 'Por decidir', n: porDecidir },
    { valor: 'cobradas', texto: 'Ya cobradas', n: resueltas.length },
    { valor: 'todas', texto: 'Todas', n: filas.length },
  ];

  return (
    <div className="space-y-3">
      {resueltas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ok/30 bg-ok/10 px-4 py-3">
          <p className="text-sm text-content">
            <span className="font-semibold">
              {resueltas.length}{' '}
              {resueltas.length === 1
                ? 'solicitud es de una orden'
                : 'solicitudes son de órdenes'}{' '}
              ya cobrada{resueltas.length === 1 ? '' : 's'}
            </span>{' '}
            <span className="text-dim">
              por otra vía. Autorizarlas cobraría dos veces.
            </span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => abrirCerrar(resueltas.map((f) => f.solicitud.id))}
          >
            Cerrar {resueltas.length === 1 ? 'la' : `las ${resueltas.length}`}
          </Button>
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Filtrar solicitudes"
        className="inline-flex rounded-lg border border-line bg-surface p-0.5"
      >
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={filtro === o.valor}
            onClick={() => {
              setFiltro(o.valor);
              limpiar();
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filtro === o.valor
                ? 'bg-elevated text-content'
                : 'text-dim hover:text-content',
            )}
          >
            {o.texto} <span className="tabular-nums text-dim">{o.n}</span>
          </button>
        ))}
      </div>

      {seleccion.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-elevated px-4 py-2.5">
          <span className="text-sm font-semibold text-content">
            {seleccion.length} marcada{seleccion.length === 1 ? '' : 's'}
          </span>
          {montoSeleccion > 0 && (
            <span className="text-sm text-dim tabular-nums">
              · {formatearUsd(montoSeleccion)} por cobrar
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={idsAutorizables.length === 0}
              title={
                idsAutorizables.length === 0
                  ? 'Ninguna de las marcadas está sin cobrar'
                  : undefined
              }
              onClick={() => abrirAutorizar(idsAutorizables)}
              startIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Autorizar {idsAutorizables.length}
            </Button>
            {idsResueltos.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => abrirCerrar(idsResueltos)}
              >
                Cerrar {idsResueltos.length} ya cobrada
                {idsResueltos.length === 1 ? '' : 's'}
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                abrirRechazar(seleccion.map((f) => f.solicitud.id))
              }
              startIcon={<XCircle className="h-4 w-4" />}
            >
              Rechazar {seleccion.length}
            </Button>
            <Button size="sm" variant="ghost" onClick={limpiar}>
              Quitar marcas
            </Button>
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-10 text-center text-sm text-dim">
          {filtro === 'porDecidir'
            ? 'No hay créditos por decidir.'
            : 'No hay solicitudes en esta vista.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-elevated text-xs uppercase tracking-wide text-dim">
                <tr>
                  <th className="w-10 p-3 text-left">
                    <Casilla
                      etiqueta="Marcar todas las visibles"
                      marcada={
                        seleccion.length > 0 &&
                        visibles.every((g) =>
                          g.filas.every((f) => marcadas.has(f.solicitud.id)),
                        )
                      }
                      mixta={
                        seleccion.length > 0 &&
                        !visibles.every((g) =>
                          g.filas.every((f) => marcadas.has(f.solicitud.id)),
                        )
                      }
                      onChange={() => {
                        const ids = visibles.flatMap((g) =>
                          g.filas.map((f) => f.solicitud.id),
                        );
                        alternar(ids, !ids.every((id) => marcadas.has(id)));
                      }}
                    />
                  </th>
                  <th className="p-3 text-left">Orden</th>
                  <th className="p-3 text-left">Pedida</th>
                  <th className="p-3 text-left">Mesonero</th>
                  <th className="p-3 text-left">Nota</th>
                  <th className="p-3 text-left">Cobro</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-right">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((grupo) => {
                  const ids = grupo.filas.map((f) => f.solicitud.id);
                  const todas = ids.every((id) => marcadas.has(id));
                  const alguna = ids.some((id) => marcadas.has(id));
                  const plegado = estaPlegado(grupo);
                  const porCobrar = grupo.filas
                    .filter((f) => !esResuelta(f))
                    .reduce((s, f) => s + f.cobro.falta, 0);
                  return (
                    <GrupoFilas
                      key={grupo.clave}
                      grupo={grupo}
                      plegado={plegado}
                      porCobrar={porCobrar}
                      casilla={
                        <Casilla
                          etiqueta={`Marcar las de ${grupo.nombre}`}
                          marcada={todas}
                          mixta={alguna && !todas}
                          onChange={() => alternar(ids, !todas)}
                        />
                      }
                      onPlegar={() =>
                        setPlegados((p) => ({ ...p, [grupo.clave]: !plegado }))
                      }
                      marcadas={marcadas}
                      onMarcar={(id) => alternar([id], !marcadas.has(id))}
                      onAutorizar={(id) => abrirAutorizar([id])}
                      onRechazar={(id) => abrirRechazar([id])}
                      onCerrar={(id) => abrirCerrar([id])}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface GrupoFilasProps {
  grupo: GrupoDeCliente;
  plegado: boolean;
  porCobrar: number;
  casilla: React.ReactNode;
  onPlegar: () => void;
  marcadas: Set<string>;
  onMarcar: (id: string) => void;
  onAutorizar: (id: string) => void;
  onRechazar: (id: string) => void;
  onCerrar: (id: string) => void;
}

function GrupoFilas({
  grupo,
  plegado,
  porCobrar,
  casilla,
  onPlegar,
  marcadas,
  onMarcar,
  onAutorizar,
  onRechazar,
  onCerrar,
}: GrupoFilasProps) {
  const Chevron = plegado ? ChevronRight : ChevronDown;
  const n = grupo.filas.length;
  return (
    <>
      <tr className="border-b border-line bg-elevated/40">
        <td className="p-3">{casilla}</td>
        <td colSpan={5} className="p-3">
          <button
            type="button"
            onClick={onPlegar}
            aria-expanded={!plegado}
            className="flex items-center gap-2 text-left"
          >
            <Chevron className="h-4 w-4 text-dim" aria-hidden />
            <span className="font-semibold text-content">{grupo.nombre}</span>
            <span className="text-dim">
              {n} solicitud{n === 1 ? '' : 'es'}
              {grupo.diasMasVieja >= DIAS_VIEJA &&
                ` · la más vieja ${hace(grupo.diasMasVieja)}`}
            </span>
          </button>
        </td>
        <td className="p-3 text-right font-semibold text-content tabular-nums">
          {porCobrar > 0 ? formatearUsd(porCobrar) : '—'}
        </td>
        <td className="p-3" />
      </tr>
      {!plegado &&
        grupo.filas.map((fila) => {
          const { solicitud } = fila;
          const resuelta = esResuelta(fila);
          const lugar =
            solicitud.tableName || solicitud.sector || 'Para llevar';
          return (
            <tr
              key={solicitud.id}
              className={cn(
                'border-b border-line last:border-b-0 hover:bg-elevated/30',
                resuelta && 'text-dim',
              )}
            >
              <td className="p-3">
                <Casilla
                  etiqueta={`Marcar ${numeroDe(solicitud)}`}
                  marcada={marcadas.has(solicitud.id)}
                  onChange={() => onMarcar(solicitud.id)}
                />
              </td>
              <td className="p-3">
                <div className="font-mono font-semibold text-content">
                  {numeroDe(solicitud)}
                </div>
                <div className="text-xs text-dim">{lugar}</div>
              </td>
              <td className="p-3 whitespace-nowrap tabular-nums">
                <div className="text-content">
                  {format(fila.fecha, 'dd/MM/yy HH:mm', { locale: es })}
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    fila.dias >= DIAS_VIEJA ? 'text-warn' : 'text-dim',
                  )}
                >
                  {fila.dias >= DIAS_VIEJA && (
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                  )}
                  {hace(fila.dias)}
                </div>
              </td>
              <td className="p-3 text-dim">{solicitud.waiterName || '—'}</td>
              <td className="max-w-[16rem] p-3 text-xs italic text-dim">
                {solicitud.creditRequest.note || '—'}
              </td>
              <td className="p-3">
                <ChipDeCobro fila={fila} />
              </td>
              <td className="p-3 text-right font-semibold text-content tabular-nums">
                {formatearUsd(solicitud.total)}
              </td>
              <td className="p-3">
                <div className="flex items-center justify-end gap-2">
                  {resuelta && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCerrar(solicitud.id)}
                    >
                      Cerrar
                    </Button>
                  )}
                  {fila.cobro.tipo === 'parcial' && (
                    // Autorizar hoy crearia la deuda por el TOTAL, no por lo
                    // que falta: lo correcto es cobrar el resto.
                    <Link
                      href={PRIVATE_ROUTES.POS_PAYMENT(solicitud.id)}
                      className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-content hover:border-brand/50 hover:text-brand"
                    >
                      Cobrar el resto
                    </Link>
                  )}
                  {sePuedeAutorizar(fila.cobro) && (
                    <Button size="sm" onClick={() => onAutorizar(solicitud.id)}>
                      Autorizar
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRechazar(solicitud.id)}
                    aria-label={`Rechazar ${numeroDe(solicitud)}`}
                    title="Rechazar"
                    className="rounded-md p-2 text-dim transition-colors hover:bg-danger/15 hover:text-danger"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
    </>
  );
}
