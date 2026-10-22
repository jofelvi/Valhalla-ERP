'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import {
  Banknote,
  CalendarClock,
  CreditCard,
  HandCoins,
  Smartphone,
} from 'lucide-react';
import { PRIVATE_ROUTES, SalesIntervalEnum, PaymentMethodEnum } from '@/shared';
import { usePayments } from '@/hooks/usePayments';
import { useSociosExcluidos } from '@/hooks/useSociosExcluidos';
import { Order } from '@odin6/types';
import { Payment } from '@odin6/types';
import { aFecha } from '@/shared/utils/dateHelpers';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { getIntervalDateRange } from './intervalUtils';

interface Props {
  interval: SalesIntervalEnum;
  orders: Order[];
}

/**
 * Desglose de cobros del período: pago móvil, punto de venta, efectivo y
 * crédito.
 *
 * Sustituye a las tarjetas de Órdenes/Clientes/Productos, que contaban cosas
 * que ya se ven en sus propias pantallas. Lo que no se veía en ningún lado era
 * POR DÓNDE entró la plata, que es lo que hace falta para cuadrar la caja
 * contra el punto de venta y el banco.
 *
 * El crédito descuenta el consumo de los socios directivos: ellos acordaron no
 * cobrarse, así que sumarlo infla un "por cobrar" que nadie va a cobrar. No se
 * oculta — se muestra aparte, debajo.
 */
export default function PaymentBreakdownCards({ interval, orders }: Props) {
  const router = useRouter();
  const { data: payments = [] } = usePayments();
  const { socios } = useSociosExcluidos();

  const totales = useMemo(() => {
    const { start, end } = getIntervalDateRange(interval);

    // Ordenes INICIADAS en el periodo. Contar por fecha del pago metia cobros
    // de ordenes viejas (los $24 en divisa del 28/08 eran de una orden del 21)
    // y hacia que las tarjetas no cuadraran con Ventas Totales.
    const delPeriodo = new Map<string, Order>();
    for (const o of orders) {
      if (!o.createdAt) continue;
      if (o.status === 'CANCELLED') continue;
      const d = aFecha(o.createdAt);
      if (d < start || d > end) continue;
      const esSocio =
        socios.habilitado &&
        !!o.customerId &&
        socios.customerIds.includes(o.customerId);
      if (esSocio) continue;
      delPeriodo.set(o.id, o);
    }

    // Que dinero entro en el periodo pero NO es venta del periodo: pagos de
    // ordenes anteriores y cobros de cartera. Antes se sumaba a las tarjetas de
    // venta y las inflaba (los $24 en divisa del 28/08 eran de una orden del
    // 21). Ahora sale aparte, para que no desaparezca del flujo de caja.
    const todasLasOrdenes = new Map<string, Order>();
    for (const o of orders) todasLasOrdenes.set(o.id, o);

    let deOrdenesAnteriores = 0;
    let deCartera = 0;
    let deNomina = 0;
    let nAnteriores = 0;
    for (const p of payments as Payment[]) {
      const cuando = p.createdAt ? aFecha(p.createdAt) : null;
      if (!cuando || cuando < start || cuando > end) continue;
      if (delPeriodo.has(p.orderId)) continue; // es venta del periodo

      // El consumo del personal descontado de nomina no es plata que entro:
      // es un descuento contra el sueldo. Va aparte para no inflar el ingreso.
      if (p.method === PaymentMethodEnum.PAYROLL_DEDUCTION) {
        deNomina += p.amount ?? 0;
        continue;
      }

      const orden = todasLasOrdenes.get(p.orderId);
      if (orden) {
        // Orden conocida que no cae en el periodo: es de antes.
        deOrdenesAnteriores += p.amount ?? 0;
      } else {
        // Sin orden: el pago apunta a una cuenta por cobrar.
        deCartera += p.amount ?? 0;
      }
      nAnteriores += 1;
    }

    // Pagos de esas ordenes, con la propina prorrateada entre ellos: la propina
    // vive en la orden, no en el pago, y una orden puede tener varios.
    const bruto: Record<string, number> = {};
    const propinaPorMetodo: Record<string, number> = {};
    const cuenta: Record<string, number> = {};
    const porOrden = new Map<string, Payment[]>();
    for (const p of payments as Payment[]) {
      if (!delPeriodo.has(p.orderId)) continue;
      const lista = porOrden.get(p.orderId) ?? [];
      lista.push(p);
      porOrden.set(p.orderId, lista);
    }
    for (const [orderId, pagos] of porOrden) {
      const orden = delPeriodo.get(orderId);
      const suma = pagos.reduce((acc, p) => acc + (p.amount ?? 0), 0);
      const tip = orden?.tipAmount ?? 0;
      for (const p of pagos) {
        const monto = p.amount ?? 0;
        bruto[p.method] = (bruto[p.method] ?? 0) + monto;
        cuenta[p.method] = (cuenta[p.method] ?? 0) + 1;
        propinaPorMetodo[p.method] =
          (propinaPorMetodo[p.method] ?? 0) +
          (suma > 0 ? tip * (monto / suma) : 0);
      }
    }

    const enBruto = (metodos: PaymentMethodEnum[]) =>
      metodos.reduce((acc, m) => acc + (bruto[m] ?? 0), 0);
    const neto = (metodos: PaymentMethodEnum[]) =>
      metodos.reduce(
        (acc, m) => acc + (bruto[m] ?? 0) - (propinaPorMetodo[m] ?? 0),
        0,
      );
    const contar = (metodos: PaymentMethodEnum[]) =>
      metodos.reduce((acc, m) => acc + (cuenta[m] ?? 0), 0);
    const propinaDe = (metodos: PaymentMethodEnum[]) =>
      metodos.reduce((acc, m) => acc + (propinaPorMetodo[m] ?? 0), 0);

    const MOVIL = [
      PaymentMethodEnum.PAGO_MOVIL,
      PaymentMethodEnum.PAGO_MOVIL_MANUAL,
    ];

    // El monto en Bs se guarda ya convertido a USD; el nominal sale de la tasa
    // que quedo grabada en cada pago, no de la de hoy.
    let bsNominal = 0;
    for (const pagos of porOrden.values()) {
      for (const p of pagos) {
        if (p.method !== PaymentMethodEnum.CASH_BS) continue;
        bsNominal += p.expectedAmountBS ?? (p.amount ?? 0) * (p.bcvRate ?? 0);
      }
    }

    const creditoOrders = orders.filter((o) => {
      if (o.status !== 'CREDIT' || !o.createdAt) return false;
      const d = aFecha(o.createdAt);
      return d >= start && d <= end;
    });
    const esSocio = (o: Order) =>
      socios.habilitado &&
      !!o.customerId &&
      socios.customerIds.includes(o.customerId);

    return {
      // Bruto = lo que entro a la cuenta, propina incluida. Es contra esto que
      // se cuadra el extracto del banco.
      pagoMovil: enBruto(MOVIL),
      pagoMovilVenta: neto(MOVIL),
      pagoMovilN: contar(MOVIL),
      punto: enBruto([PaymentMethodEnum.CARD]),
      puntoVenta: neto([PaymentMethodEnum.CARD]),
      puntoN: contar([PaymentMethodEnum.CARD]),
      efectivoUsd: enBruto([PaymentMethodEnum.CASH_USD]),
      efectivoBs: enBruto([PaymentMethodEnum.CASH_BS]),
      bsNominal,
      propinaMovil: propinaDe(MOVIL),
      propinaPunto: propinaDe([PaymentMethodEnum.CARD]),
      propina: propinaDe([
        ...MOVIL,
        PaymentMethodEnum.CARD,
        PaymentMethodEnum.CASH_USD,
        PaymentMethodEnum.CASH_BS,
      ]),
      credito: creditoOrders
        .filter((o) => !esSocio(o))
        .reduce((acc, o) => acc + (o.total ?? 0), 0),
      creditoN: creditoOrders.filter((o) => !esSocio(o)).length,
      creditoSocios: creditoOrders
        .filter(esSocio)
        .reduce((acc, o) => acc + (o.total ?? 0), 0),
      creditoSociosN: creditoOrders.filter(esSocio).length,
      deOrdenesAnteriores,
      deCartera,
      deNomina,
      nAnteriores,
    };
  }, [payments, orders, interval, socios]);

  const tarjeta =
    'hover:scale-105 transition-transform duration-300 cursor-pointer';

  return (
    <>
      {/* Pago Móvil */}
      <Card
        className={tarjeta}
        onClick={() => router.push(PRIVATE_ROUTES.ORDERS)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-dim">
              Pago Móvil
            </CardTitle>
            <Smartphone className="h-5 w-5 text-brand" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-content">
            {formatearUsdConMiles(totales.pagoMovil)}
          </div>
          <Badge variant="info" className="mt-2">
            {totales.pagoMovilN} pago{totales.pagoMovilN === 1 ? '' : 's'}
          </Badge>
          {totales.propinaMovil > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between text-dim">
                <span>Venta</span>
                <span className="font-semibold text-content">
                  {formatearUsdConMiles(totales.pagoMovilVenta)}
                </span>
              </div>
              <div className="flex justify-between text-dim">
                <span>Propina</span>
                <span className="font-semibold text-content">
                  {formatearUsdConMiles(totales.propinaMovil)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Punto de Venta */}
      <Card
        className={tarjeta}
        onClick={() => router.push(PRIVATE_ROUTES.ORDERS)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-dim">
              Punto de Venta
            </CardTitle>
            <CreditCard className="h-5 w-5 text-brand" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-content">
            {formatearUsdConMiles(totales.punto)}
          </div>
          <Badge variant="info" className="mt-2">
            {totales.puntoN} pago{totales.puntoN === 1 ? '' : 's'}
          </Badge>
          {totales.propinaPunto > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between text-dim">
                <span>Venta</span>
                <span className="font-semibold text-content">
                  {formatearUsdConMiles(totales.puntoVenta)}
                </span>
              </div>
              <div className="flex justify-between text-dim">
                <span>Propina</span>
                <span className="font-semibold text-content">
                  {formatearUsdConMiles(totales.propinaPunto)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Efectivo */}
      <Card
        className={tarjeta}
        onClick={() => router.push(PRIVATE_ROUTES.ORDERS)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-dim">
              Efectivo
            </CardTitle>
            <Banknote className="h-5 w-5 text-brand" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-content">
            {formatearUsdConMiles(totales.efectivoUsd + totales.efectivoBs)}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between text-dim">
              <span>Divisa</span>
              <span className="font-semibold text-content">
                {formatearUsdConMiles(totales.efectivoUsd)}
              </span>
            </div>
            <div className="flex justify-between text-dim">
              <span>Bolívares</span>
              <span className="font-semibold text-content">
                {formatearUsdConMiles(totales.efectivoBs)}
                {totales.bsNominal > 0 && (
                  <span className="ml-1 font-normal text-dim">
                    (Bs{' '}
                    {totales.bsNominal.toLocaleString('es-VE', {
                      maximumFractionDigits: 2,
                    })}
                    )
                  </span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Crédito */}
      <Card
        className={tarjeta}
        onClick={() => router.push(PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-dim">
              Crédito
            </CardTitle>
            <HandCoins className="h-5 w-5 text-brand" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-content">
            {formatearUsdConMiles(totales.credito)}
          </div>
          <Badge
            variant={totales.credito > 0 ? 'warning' : 'success'}
            className="mt-2"
          >
            {totales.creditoN} cuenta{totales.creditoN === 1 ? '' : 's'}
          </Badge>
          {totales.creditoSocios > 0 && (
            <p className="mt-2 text-xs text-dim">
              No incluye {formatearUsdConMiles(totales.creditoSocios)} de
              consumo de socios
              {totales.creditoSociosN > 1
                ? ` (${totales.creditoSociosN} cuentas)`
                : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* De otros periodos: plata que entro esta semana pero se vendio antes.
          Va aparte de las tarjetas de venta para no inflarlas, pero se muestra
          porque para la caja SI es dinero que entro. */}
      <Card
        className={tarjeta}
        onClick={() => router.push(PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-dim">
              De otros períodos
            </CardTitle>
            <CalendarClock className="h-5 w-5 text-brand" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-content">
            {formatearUsdConMiles(
              totales.deOrdenesAnteriores + totales.deCartera,
            )}
          </div>
          {totales.nAnteriores > 0 ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between text-dim">
                <span>Órdenes anteriores</span>
                <span className="font-semibold text-content">
                  {formatearUsdConMiles(totales.deOrdenesAnteriores)}
                </span>
              </div>
              <div className="flex justify-between text-dim">
                <span>Cobros de cartera</span>
                <span className="font-semibold text-content">
                  {formatearUsdConMiles(totales.deCartera)}
                </span>
              </div>
            </div>
          ) : (
            <Badge variant="success" className="mt-2">
              Nada de antes
            </Badge>
          )}
          {totales.deNomina > 0 && (
            <p className="mt-2 text-[11px] text-dim">
              + {formatearUsdConMiles(totales.deNomina)} de consumo de personal
              descontado de nómina (no es plata que entró)
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
