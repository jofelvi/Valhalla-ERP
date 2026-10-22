'use client';

import { CircleDollarSign, TrendingUp, Wallet } from 'lucide-react';
import EstadoDeBloque, {
  Esqueleto,
} from '@/components/shared/estado/EstadoDeBloque';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import type {
  ResumenCartera,
  TotalesDeBloque,
} from '@/hooks/useAccountsReceivable';

interface Props {
  resumen?: ResumenCartera;
  cargando: boolean;
  error: unknown;
  reintentar: () => void;
  /** Texto que dice sobre qué se calculó: "de este cliente", "en el rango…". */
  alcance: string;
}

const ETIQUETAS_DE_ESTADO: Record<string, string> = {
  pending: 'pendientes',
  partially_paid: 'con abono',
  paid: 'pagadas',
  overdue: 'vencidas',
  cancelled: 'anuladas',
};

const nombreDeEstado = (estado: string) =>
  ETIQUETAS_DE_ESTADO[estado] ?? estado.replace(/_/g, ' ');

/**
 * Las tres cifras de la cartera, con lo que se dejó fuera dicho en voz alta.
 *
 * Las calculaba el navegador sumando las cuentas descargadas, y **con un
 * criterio distinto al de la lista de abajo**: apartaba las unificadas pero no
 * las anuladas. Medido en producción el 20/09/2026, la tarjeta "Pendiente"
 * decía $9.770,55 cuando lo real eran $8.392,82: $1.377,73 de 37 cuentas
 * anuladas que la lista escondía y el total sí sumaba.
 *
 * Ahora las calcula el servidor con el mismo criterio, y lo apartado se
 * enumera debajo. Un número que baja sin decir por qué es peor que uno malo.
 */
export default function ResumenDeCartera({
  resumen,
  cargando,
  error,
  reintentar,
  alcance,
}: Props) {
  return (
    <EstadoDeBloque
      cargando={cargando}
      error={error}
      reintentar={reintentar}
      que="el resumen de la cartera"
      motivoVacio="no porque no haya deuda"
      esqueleto={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-line/50 bg-surface/80 p-3.5"
            >
              <Esqueleto lineas={2} />
            </div>
          ))}
        </div>
      }
    >
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <Tarjeta
            icono={<CircleDollarSign className="h-4 w-4 text-brand" />}
            tono="brand"
            titulo="Facturado"
            total={resumen?.cartera}
            valor={resumen?.cartera.facturado ?? 0}
            alcance={alcance}
          />
          <Tarjeta
            icono={<Wallet className="h-4 w-4 text-ok" />}
            tono="ok"
            titulo="Cobrado"
            total={resumen?.cartera}
            valor={resumen?.cartera.pagado ?? 0}
          />
          <Tarjeta
            icono={<TrendingUp className="h-4 w-4 text-danger" />}
            tono="danger"
            titulo="Por cobrar"
            destacada
            total={resumen?.cartera}
            valor={resumen?.cartera.pendiente ?? 0}
          />
        </div>

        {resumen && <Apartado apartado={resumen.apartado} />}
        {resumen && <PorEstado filas={resumen.porEstado} />}
      </div>
    </EstadoDeBloque>
  );
}

const TONOS = {
  brand: { fondo: 'bg-brand/20', texto: 'text-brand' },
  ok: { fondo: 'bg-ok/20', texto: 'text-ok' },
  danger: { fondo: 'bg-danger/20', texto: 'text-danger' },
} as const;

function Tarjeta({
  icono,
  tono,
  titulo,
  valor,
  total,
  destacada = false,
  alcance,
}: {
  icono: React.ReactNode;
  tono: keyof typeof TONOS;
  titulo: string;
  valor: number;
  total?: TotalesDeBloque;
  destacada?: boolean;
  alcance?: string;
}) {
  const t = TONOS[tono];
  return (
    <div
      className={`rounded-xl border bg-surface/80 p-3.5 shadow-sm backdrop-blur-sm ${
        destacada ? 'border-danger/40' : 'border-line/50'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.fondo}`}
        >
          {icono}
        </div>
        <span className={`text-xs font-medium ${t.texto}`}>{titulo}</span>
      </div>
      <p className="truncate text-lg font-bold tabular-nums text-content sm:text-xl">
        {formatearUsdConMiles(valor)}
      </p>
      {total !== undefined && (
        <p className="mt-0.5 text-[11px] leading-tight text-dim">
          {total.cuentas === 1 ? '1 cuenta' : `${total.cuentas} cuentas`}
          {alcance ? ` ${alcance}` : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Lo único que NO entra en el por cobrar y hay que decir en voz alta: el
 * consumo de los tres dueños.
 *
 * Antes se enumeraban también las anuladas y las unificadas. El dueño las
 * mandó a quitar el 21/09/2026 con el motivo exacto: **"muchas cuentas fueron
 * errores"**. Enumerar 37 cuentas anuladas y 644 absorbidas por una
 * consolidada no explicaba el número: le ponía delante $12.681,86 de ruido
 * que no le debe nadie, y enterraba la única cifra que sí es un acuerdo
 * vigente entre personas.
 *
 * Esa cifra sí se sigue mostrando siempre que exista, porque un descuento
 * invisible es indistinguible de un error de cálculo — y este descuento no es
 * un error: los tres socios dueños acordaron no cobrarse el consumo entre
 * ellos. Se factura y se registra igual; solo no suma al por cobrar.
 */
function Apartado({ apartado }: { apartado: ResumenCartera['apartado'] }) {
  const socios = apartado.socios;
  if (socios.cuentas === 0) return null;

  const etiqueta =
    socios.cuentas === 1
      ? '1 cuenta de los socios dueños'
      : `${socios.cuentas} cuentas de los socios dueños`;
  const porque =
    'Los tres dueños acordaron no cobrarse el consumo entre ellos. Se factura y se registra igual, pero no suma al por cobrar.';

  return (
    <div className="rounded-xl border border-line/50 bg-surface/60 px-3.5 py-2.5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-dim">
        No entra en el por cobrar
      </p>
      <p
        className="text-xs text-dim"
        aria-label={`${etiqueta}: ${formatearUsdConMiles(socios.pendiente)} — ${porque}`}
      >
        <span className="font-medium text-content">{etiqueta}</span>
        {' · '}
        <span className="tabular-nums">
          {formatearUsdConMiles(socios.pendiente)}
        </span>
        <span className="block text-dim/80 sm:inline"> — {porque}</span>
      </p>
    </div>
  );
}

/** En qué estado está la deuda, de mayor a menor. Responde "¿por dónde empiezo?". */
function PorEstado({ filas }: { filas: ResumenCartera['porEstado'] }) {
  const conDeuda = filas.filter((f) => f.cuentas > 0);
  if (conDeuda.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {conDeuda.map((f) => (
        <span
          key={f.estado}
          className="inline-flex items-baseline gap-1.5 rounded-lg border border-line/50 bg-surface/60 px-2.5 py-1 text-xs"
        >
          <span className="font-semibold text-content">{f.cuentas}</span>
          <span className="text-dim">{nombreDeEstado(f.estado)}</span>
          {f.pendiente > 0.005 && (
            <span className="font-medium tabular-nums text-danger">
              {formatearUsdConMiles(f.pendiente)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
