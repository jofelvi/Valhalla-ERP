'use client';
import { formatearUsdSinDecimales } from '@/shared/utils/dinero';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Order } from '@odin6/types';
import { aFecha } from '@/shared/utils/dateHelpers';
import { getBusinessDayStart } from '@/shared/utils/businessDay';
import { SalesIntervalEnum } from '@/shared';
import { getIntervalDateRange } from './intervalUtils';
import { isCountableSale } from './salesMetrics';

interface WeeklySalesData {
  day: string;
  sales: number;
  orders: number;
}

interface WeeklySalesChartProps {
  orders: Order[];
  interval: SalesIntervalEnum;
}

const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const WeeklySalesChart = ({ orders, interval }: WeeklySalesChartProps) => {
  const salesData = useMemo(() => {
    // Para intervalos semanales, mostrar desglose por día
    const isWeekly =
      interval === SalesIntervalEnum.CURRENT_WEEK ||
      interval === SalesIntervalEnum.PREVIOUS_WEEK;

    const { start, end } = getIntervalDateRange(
      isWeekly ? interval : SalesIntervalEnum.CURRENT_WEEK,
    );

    // Si es hoy/ayer, usar la semana actual como referencia
    // Si es mes, usar la semana actual
    const filtered = orders.filter((o) => {
      if (!o.createdAt || !isCountableSale(o)) return false;
      const date = aFecha(o.createdAt);
      return date >= start && date <= end;
    });

    const data: WeeklySalesData[] = daysOfWeek.map((day) => ({
      day,
      sales: 0,
      orders: 0,
    }));

    for (const order of filtered) {
      if (!order.createdAt || !order.total) continue;
      // Se imputa a la JORNADA, no al dia de calendario: lo vendido el sabado
      // a la 01:00 es del viernes, no del sabado.
      const dayIndex = getBusinessDayStart(aFecha(order.createdAt)).getDay();
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      data[adjustedIndex].sales += order.total;
      data[adjustedIndex].orders += 1;
    }

    return data;
  }, [orders, interval]);

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
      payload: WeeklySalesData;
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface p-3 border border-line rounded-lg shadow-lg">
          <p className="font-semibold text-content">{label}</p>
          <p className="text-dim">
            Ventas: {formatearUsdSinDecimales(payload[0].value)}
          </p>
          <p className="text-brand text-sm">
            {payload[0].payload.orders} órdenes
          </p>
        </div>
      );
    }
    return null;
  };

  const hasData = salesData.some((d) => d.sales > 0);

  if (!hasData) {
    return (
      <div className="h-64 flex items-center justify-center bg-gradient-to-br from-page to-elevated rounded-xl border border-line">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-surface to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-8 w-8 text-brand"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-brand font-medium mb-2">
            Sin ventas en este período
          </p>
          <p className="text-brand text-sm">
            Selecciona otro período para ver datos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={salesData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
          <XAxis
            dataKey="day"
            stroke="#0891b2"
            fontSize={12}
            tick={{ fill: '#0891b2' }}
          />
          <YAxis
            stroke="#0891b2"
            fontSize={12}
            tick={{ fill: '#0891b2' }}
            tickFormatter={formatearUsdSinDecimales}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="sales"
            fill="url(#colorGradient)"
            radius={[4, 4, 0, 0]}
            stroke="#0891b2"
            strokeWidth={1}
          />
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0891b2" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.6} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeeklySalesChart;
