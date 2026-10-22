import { api } from './api/apiClient';
import { toSafeDate } from './dateUtils';

export interface SalesMetric {
  interval: 'today' | 'week' | 'month';
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface WeeklySalesData {
  week: string;
  total: number;
  byDay: Array<{
    day: string;
    date: string;
    sales: number;
    orders: number;
  }>;
}

export interface TopProduct {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopWaiter {
  id: string;
  name: string;
  orderCount: number;
  commission: number;
}

/* ── Formas crudas de la API ─────────────────────────────────────────────────
 *
 * Cada campo lleva el nombre CANÓNICO que manda la API (`total`, `count`,
 * `avgOrderValue`, `_id`, `waiterName`, `totalServiceCharge`) y, opcional, el
 * alias de compatibilidad que la API agregó para los APKs ya instalados. Los
 * normalizadores leen el canónico primero: así el servidor puede retirar los
 * alias sin que esta pantalla vuelva a quedarse en cero.
 *
 * POR QUÉ ESTÁ ESCRITO ESTO: hasta el 20/09/2026 estos tipos declaraban SOLO
 * los alias, que el servidor nunca mandó. Como cada campo cae en `?? 0`, el
 * Panel mostraba 0 en TODAS las tarjetas mientras la API servía $416,58 y 26
 * órdenes de ese mismo día — sin un solo error, ni en el teléfono ni en el VPS.
 * Al tocar este archivo hay que verificar contra la respuesta REAL de la API
 * (`curl`), nunca contra estos tipos: un nombre mal escrito acá no falla, miente.
 */

export interface RawSalesMetric {
  interval?: string;
  total?: number;
  count?: number;
  avgOrderValue?: number;
  /** alias para APKs anteriores a la 1.3.05 */
  totalSales?: number;
  orderCount?: number;
  averageOrderValue?: number;
}

/** Una fila diaria de `/api/analytics/sales/weekly` (devuelve un ARRAY) */
export interface RawDailySales {
  date?: string;
  total?: number;
  count?: number;
}

export interface RawTopProduct {
  _id?: string;
  name?: string;
  quantity?: number;
  total?: number;
  /** alias para APKs anteriores a la 1.3.05 */
  id?: string;
  revenue?: number;
}

export interface RawTopWaiter {
  _id?: string;
  waiterName?: string;
  orderCount?: number;
  totalServiceCharge?: number;
  /** alias para APKs anteriores a la 1.3.05 */
  id?: string;
  name?: string;
  commission?: number;
}

const DIAS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function nombreDelDia(fecha: string): string {
  const d = toSafeDate(fecha);
  return d ? (DIAS_ES[d.getDay()] ?? '') : '';
}

function normalizeSalesMetric(raw: RawSalesMetric): SalesMetric {
  return {
    interval: (raw.interval as 'today' | 'week' | 'month') ?? 'today',
    totalSales: raw.total ?? raw.totalSales ?? 0,
    orderCount: raw.count ?? raw.orderCount ?? 0,
    averageOrderValue: raw.avgOrderValue ?? raw.averageOrderValue ?? 0,
  };
}

function normalizeWeeklySalesData(filas: RawDailySales[]): WeeklySalesData {
  const byDay = (filas ?? []).map((fila) => ({
    day: nombreDelDia(fila.date ?? ''),
    date: fila.date ?? '',
    sales: fila.total ?? 0,
    orders: fila.count ?? 0,
  }));
  return {
    week:
      byDay.length > 0
        ? `${byDay[0].date} a ${byDay[byDay.length - 1].date}`
        : '',
    total: byDay.reduce((suma, dia) => suma + dia.sales, 0),
    byDay,
  };
}

function normalizeTopProduct(raw: RawTopProduct): TopProduct {
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.name ?? '',
    quantity: raw.quantity ?? 0,
    revenue: raw.total ?? raw.revenue ?? 0,
  };
}

function normalizeTopWaiter(raw: RawTopWaiter): TopWaiter {
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.waiterName ?? raw.name ?? '',
    orderCount: raw.orderCount ?? 0,
    commission: raw.totalServiceCharge ?? raw.commission ?? 0,
  };
}

export const analyticsService = {
  /**
   * Obtiene ventas de hoy
   */
  async getSalesToday(): Promise<SalesMetric> {
    const raw = await api.get<RawSalesMetric>('/api/analytics/sales', {
      interval: 'today',
    });
    return normalizeSalesMetric(raw);
  },

  /**
   * Obtiene ventas de la semana actual
   */
  async getSalesWeekly(): Promise<WeeklySalesData> {
    const filas = await api.get<RawDailySales[]>('/api/analytics/sales/weekly');
    return normalizeWeeklySalesData(filas);
  },

  /**
   * Obtiene productos más vendidos en un rango de fechas
   */
  async getTopProducts(from?: string, to?: string): Promise<TopProduct[]> {
    const params: Record<string, string | undefined> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const list = await api.get<RawTopProduct[]>(
      '/api/analytics/top-products',
      params,
    );
    return list.map(normalizeTopProduct);
  },

  /**
   * Obtiene mesoneros con más comisión en un rango de fechas
   */
  async getTopWaiters(from?: string, to?: string): Promise<TopWaiter[]> {
    const params: Record<string, string | undefined> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const list = await api.get<RawTopWaiter[]>(
      '/api/analytics/top-waiters',
      params,
    );
    return list.map(normalizeTopWaiter);
  },
};
