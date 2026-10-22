'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { SalesIntervalEnum } from '@/shared';
import { PRIVATE_ROUTES } from '@/shared';
import { Order } from '@odin6/types';
import { getIntervalDateRange } from './intervalUtils';
import { SalesSummary, summarizeSales } from './salesMetrics';
import { useSociosExcluidos } from '@/hooks/useSociosExcluidos';
import { usePayments } from '@/hooks/usePayments';
import { Payment } from '@odin6/types';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

interface SalesTotalsCardProps {
  interval?: SalesIntervalEnum;
  orders?: Order[];
}

const compareMap: Record<string, SalesIntervalEnum> = {
  [SalesIntervalEnum.TODAY]: SalesIntervalEnum.YESTERDAY,
  [SalesIntervalEnum.CURRENT_WEEK]: SalesIntervalEnum.PREVIOUS_WEEK,
  [SalesIntervalEnum.CURRENT_MONTH]: SalesIntervalEnum.PREVIOUS_MONTH,
};

const compareLabelMap: Record<string, string> = {
  [SalesIntervalEnum.TODAY]: 'vs ayer',
  [SalesIntervalEnum.CURRENT_WEEK]: 'vs semana pasada',
  [SalesIntervalEnum.CURRENT_MONTH]: 'vs mes anterior',
};

const periodLabels: Record<string, string> = {
  [SalesIntervalEnum.TODAY]: 'Hoy',
  [SalesIntervalEnum.YESTERDAY]: 'Ayer',
  [SalesIntervalEnum.CURRENT_WEEK]: 'Esta semana',
  [SalesIntervalEnum.PREVIOUS_WEEK]: 'Semana pasada',
  [SalesIntervalEnum.CURRENT_MONTH]: 'Este mes',
  [SalesIntervalEnum.PREVIOUS_MONTH]: 'Mes anterior',
};

interface PeriodSales extends SalesSummary {
  period: string;
}

function calcSales(
  orders: Order[],
  interval: SalesIntervalEnum,
  excluir: string[],
  payments: Payment[],
): PeriodSales {
  return {
    ...summarizeSales(
      orders,
      getIntervalDateRange(interval),
      excluir,
      payments,
    ),
    period: periodLabels[interval] || interval,
  };
}

const SalesTotalsCard = ({
  interval = SalesIntervalEnum.TODAY,
  orders = [],
}: SalesTotalsCardProps) => {
  const router = useRouter();
  const { socios } = useSociosExcluidos();
  // Lo cobrado sale de los pagos, no del estado de la orden: sin esto el panel
  // da por entrada la plata de una orden mal cerrada.
  const { data: payments = [] } = usePayments();
  // El consumo de los socios no cuenta como venta ni como por cobrar: ellos
  // acordaron no cobrarse. Se muestra aparte, debajo. Memoizado porque un
  // array nuevo en cada render anularia los useMemo de abajo.
  const excluir = useMemo(
    () => (socios.habilitado ? socios.customerIds : []),
    [socios],
  );

  const salesData = useMemo(
    () => calcSales(orders, interval, excluir, payments as Payment[]),
    [orders, interval, excluir, payments],
  );

  const compareData = useMemo(() => {
    const compareInterval = compareMap[interval];
    if (!compareInterval) return null;
    return calcSales(orders, compareInterval, excluir, payments as Payment[]);
  }, [orders, interval, excluir, payments]);

  const getChangePercent = (): number | null => {
    if (!compareData) return null;
    if (compareData.billed === 0 && salesData.billed === 0) return 0;
    if (compareData.billed === 0) return 100;
    return ((salesData.billed - compareData.billed) / compareData.billed) * 100;
  };

  const changePercent = getChangePercent();
  const compareLabel = compareLabelMap[interval] ?? null;

  return (
    <Card
      className="hover:scale-105 transition-transform duration-300 cursor-pointer"
      onClick={() => router.push(PRIVATE_ROUTES.ORDERS)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-brand">
            Ventas Totales
          </CardTitle>
          <TrendingUp className="h-5 w-5 text-ok" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-content">
          {formatearUsdConMiles(salesData.billed)}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="success">{salesData.orders} órdenes</Badge>
          {salesData.pending > 0 && (
            <Badge variant="warning">
              {formatearUsdConMiles(salesData.pending)} por cobrar
            </Badge>
          )}
        </div>
        {(salesData.collected > 0 ||
          salesData.tips > 0 ||
          salesData.excluded > 0) && (
          <div className="text-[11px] text-dim mt-2 space-y-0.5">
            {/* El numero grande es la VENTA, sin propina: la propina es del
                mesonero. Pero el cliente paga las dos cosas juntas, asi que
                lo que entro al cajon se muestra aparte y completo — si no,
                el arqueo nunca cuadra contra este panel. */}
            {(salesData.collected > 0 || salesData.tipsCollected > 0) && (
              <p className="text-content">
                Entró en caja{' '}
                <span className="font-semibold">
                  {formatearUsdConMiles(
                    salesData.collected + salesData.tipsCollected,
                  )}
                </span>
              </p>
            )}
            {salesData.tipsCollected > 0 ? (
              <p className="pl-2">
                {formatearUsdConMiles(salesData.collected)} de venta +{' '}
                {formatearUsdConMiles(salesData.tipsCollected)} en propinas{' '}
                <span className="text-dim/70">(del mesonero)</span>
              </p>
            ) : (
              salesData.tips > 0 && (
                <p className="pl-2">
                  + {formatearUsdConMiles(salesData.tips)} en propinas{' '}
                  <span className="text-dim/70">
                    (del mesonero, sin cobrar)
                  </span>
                </p>
              )
            )}
            {/* Propina de cuentas que aun no se cobraron: no entro al cajon,
                pero se le debe al mesonero igual. */}
            {salesData.tips - salesData.tipsCollected > 0.01 &&
              salesData.tipsCollected > 0 && (
                <p className="pl-2 text-dim/70">
                  Faltan{' '}
                  {formatearUsdConMiles(
                    salesData.tips - salesData.tipsCollected,
                  )}{' '}
                  de propina en cuentas sin cobrar
                </p>
              )}
            {salesData.excluded > 0 && (
              <p>
                No incluye {formatearUsdConMiles(salesData.excluded)} de consumo
                de socios ({salesData.excludedOrders} órdenes)
              </p>
            )}
          </div>
        )}
        {changePercent !== null && compareLabel && (
          <div className="flex items-center gap-1 mt-2">
            {changePercent > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-ok" />
            ) : changePercent < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-danger" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-dim" />
            )}
            <span
              className={`text-xs font-semibold ${
                changePercent > 0
                  ? 'text-ok'
                  : changePercent < 0
                    ? 'text-danger'
                    : 'text-dim'
              }`}
            >
              {changePercent > 0 ? '+' : ''}
              {changePercent.toFixed(0)}%
            </span>
            <span className="text-xs text-brand">{compareLabel}</span>
          </div>
        )}
        <p className="text-[11px] text-brand mt-1">{salesData.period}</p>
      </CardContent>
    </Card>
  );
};

export default SalesTotalsCard;
