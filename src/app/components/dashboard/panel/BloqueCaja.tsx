'use client';

import { useRouter } from 'next/navigation';
import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { MetodoDePago, MetodosDePagoDelPanel } from '@odin6/types';
import { usePanelMetodosPago } from '@/hooks/usePanel';
import EstadoDeBloque from '@/components/shared/estado/EstadoDeBloque';

const ICONOS: Record<string, LucideIcon> = {
  pagoMovil: Smartphone,
  punto: CreditCard,
  efectivo: Banknote,
  transferencia: Landmark,
};

/**
 * ¿Por dónde entró la plata? — y, sobre todo, ¿cuánto entró en total?
 *
 * El panel viejo ponia estas tarjetas en la MISMA fila que "Ventas Totales",
 * del mismo tamaño y con el mismo tipo de numero, pero cada una media una cosa
 * distinta: la venta era facturado SIN propina, los metodos eran cobrado CON
 * propina, el credito era facturado sin cobrar y "De otros períodos" era plata
 * de otros dias. Cuatro unidades alineadas como si fueran comparables — de ahi
 * venia que los numeros "no cuadraran".
 *
 * Aqui los metodos van juntos bajo una sola pregunta, el total va arriba en
 * grande, y lo que NO entro se dice aparte y explicado.
 */
export default function BloqueCaja({
  interval,
}: {
  interval: SalesIntervalEnum;
}) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = usePanelMetodosPago(interval);

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
          Entró en caja
        </h2>
        <p className="text-xs text-dim">
          Los montos incluyen la propina: es lo que ve el banco
        </p>
      </div>

      <EstadoDeBloque
        motivoVacio="no porque no haya ventas"
        que="el desglose de cobros"
        cargando={isLoading}
        error={error}
        reintentar={() => void refetch()}
        esqueleto={
          <div className="grid animate-pulse grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-elevated" />
            ))}
          </div>
        }
      >
        {data && (
          <>
            {/* El numero que el dueño busca primero: punto de venta + pago
                movil + efectivo que entro en el periodo, tal como lo ve el
                banco. Incluye lo cobrado de cuentas por cobrar y de ordenes de
                dias anteriores (dueño, 14/10/2026: "ingresaron hoy, deberian
                estar sumadas"); el 21/09 se habian sacado. */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-bold leading-none tracking-tight text-content tabular-nums sm:text-5xl">
                  {formatearUsdConMiles(data.totalEntro)}
                </p>
                <p className="mt-2 text-sm text-dim">
                  {data.periodo.etiqueta.toLowerCase()}
                  {data.totalPropina > 0 && (
                    <>
                      {' · incluye '}
                      <span className="font-semibold text-content tabular-nums">
                        {formatearUsdConMiles(data.totalPropina)}
                      </span>{' '}
                      de propina del mesonero
                    </>
                  )}
                </p>
              </div>

              <DeDondeVino
                periodo={data.periodo.etiqueta}
                deVentas={data.totalDeVentas}
                otros={data.otrosPeriodos}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.metodos.map((metodo) => (
                <TarjetaMetodo key={metodo.clave} metodo={metodo} />
              ))}
            </div>

            <NoEntro
              credito={data.credito}
              creditoSocios={data.creditoSocios}
              nomina={data.descuentoNomina}
              alCredito={() => router.push(PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE)}
            />
          </>
        )}
      </EstadoDeBloque>
    </section>
  );
}

/**
 * De dónde salió el total: lo vendido en el período y lo cobrado de antes.
 *
 * En formato de RECIBO, como "Facturado", para que se lea como partes del
 * número grande y no como cifras aparte. Si todo vino de lo vendido en el
 * período no se muestra: sería repetir el mismo número.
 */
function DeDondeVino({
  periodo,
  deVentas,
  otros,
}: {
  periodo: string;
  deVentas: number;
  otros: MetodosDePagoDelPanel['otrosPeriodos'];
}) {
  const filas = [
    { etiqueta: `De lo vendido ${periodo.toLowerCase()}`, monto: deVentas },
    { etiqueta: 'De cuentas por cobrar', monto: otros.deCartera },
    {
      etiqueta: 'De órdenes de días anteriores',
      monto: otros.deOrdenesAnteriores,
    },
    { etiqueta: 'Otros cobros sin orden', monto: otros.sinOrden },
  ].filter((f, i) => i === 0 || f.monto > 0);

  if (filas.length === 1) return null;

  return (
    <dl className="w-full space-y-1 text-sm sm:w-auto sm:min-w-72">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex justify-between gap-6">
          <dt className="text-dim">{f.etiqueta}</dt>
          <dd className="tabular-nums text-content">
            {formatearUsdConMiles(f.monto)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TarjetaMetodo({ metodo }: { metodo: MetodoDePago }) {
  const Icono = ICONOS[metodo.clave] ?? Banknote;
  const vacio = metodo.bruto === 0;

  return (
    <div
      className={`rounded-lg border p-3.5 ${
        vacio ? 'border-line/50 bg-page/40' : 'border-line bg-elevated'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-dim">{metodo.etiqueta}</p>
        <Icono
          className={`h-4 w-4 shrink-0 ${vacio ? 'text-dim/40' : 'text-brand'}`}
          aria-hidden="true"
        />
      </div>

      <p
        className={`mt-1.5 text-xl font-bold tabular-nums ${
          vacio ? 'text-dim/60' : 'text-content'
        }`}
      >
        {formatearUsdConMiles(metodo.bruto)}
      </p>

      <p className="mt-0.5 text-[11px] text-dim">
        {vacio
          ? 'sin movimientos'
          : `${metodo.pagos} ${metodo.pagos === 1 ? 'pago' : 'pagos'}`}
      </p>

      {!vacio && metodo.detalle && (
        <dl className="mt-2.5 space-y-1 border-t border-line/60 pt-2 text-[11px]">
          {metodo.detalle.map((d) => (
            <div key={d.etiqueta} className="flex justify-between gap-2">
              <dt className="text-dim">{d.etiqueta}</dt>
              <dd className="text-right tabular-nums text-content">
                {formatearUsdConMiles(d.monto)}
                {d.nominal && d.nominal.monto > 0 && (
                  <span className="block text-dim">
                    {d.nominal.moneda}{' '}
                    {d.nominal.monto.toLocaleString('es-VE', {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!vacio && !metodo.detalle && metodo.propina > 0 && (
        <dl className="mt-2.5 space-y-1 border-t border-line/60 pt-2 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-dim">Venta</dt>
            <dd className="tabular-nums text-content">
              {formatearUsdConMiles(metodo.venta)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-dim">Propina</dt>
            <dd className="tabular-nums text-content">
              {formatearUsdConMiles(metodo.propina)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/**
 * Lo que se facturo pero NO entro en caja.
 *
 * Va aparte y con ese titulo a proposito: el credito estaba antes en la misma
 * fila que los metodos de cobro, como si fuera plata que llego.
 */
function NoEntro({
  credito,
  creditoSocios,
  nomina,
  alCredito,
}: {
  credito: { monto: number; cuentas: number };
  creditoSocios: { monto: number; cuentas: number };
  nomina: number;
  alCredito: () => void;
}) {
  if (credito.monto === 0 && creditoSocios.monto === 0 && nomina === 0) {
    return (
      <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-3 py-2 text-xs text-dim">
        Todo lo facturado en el período entró en caja: no quedó nada a crédito.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-page/50 p-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dim">
        No entró en caja
      </p>
      <dl className="space-y-1.5 text-sm">
        {credito.monto > 0 && (
          <button
            type="button"
            onClick={alCredito}
            className="flex w-full items-baseline justify-between gap-4 rounded py-0.5 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <dt className="flex items-center gap-1.5 text-dim">
              <HandCoins className="h-3.5 w-3.5" aria-hidden="true" />
              Quedó a crédito ({credito.cuentas}{' '}
              {credito.cuentas === 1 ? 'cuenta' : 'cuentas'})
            </dt>
            <dd className="font-semibold tabular-nums text-warn">
              {formatearUsdConMiles(credito.monto)}
            </dd>
          </button>
        )}
        {creditoSocios.monto > 0 && (
          <div className="flex items-baseline justify-between gap-4 py-0.5">
            <dt className="text-dim">
              Consumo de socios ({creditoSocios.cuentas}{' '}
              {creditoSocios.cuentas === 1 ? 'cuenta' : 'cuentas'})
              <span className="ml-1 text-xs text-dim/70">
                — acordaron no cobrarse
              </span>
            </dt>
            <dd className="font-semibold tabular-nums text-dim">
              {formatearUsdConMiles(creditoSocios.monto)}
            </dd>
          </div>
        )}
        {nomina > 0 && (
          <div className="flex items-baseline justify-between gap-4 py-0.5">
            <dt className="text-dim">
              Consumo de personal
              <span className="ml-1 text-xs text-dim/70">
                — se descuenta del sueldo
              </span>
            </dt>
            <dd className="font-semibold tabular-nums text-dim">
              {formatearUsdConMiles(nomina)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
