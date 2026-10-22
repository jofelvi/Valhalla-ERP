'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Order, OrderStatusEnum } from '@odin6/types';

export type WaiterOrdersTab = 'active' | 'paid' | 'all';

/**
 * "Mis pedidos" bajaba las ultimas 500 ordenes completas del mesonero
 * (~1,2 MB con historial) y filtraba la pestaña en memoria. Ahora cada
 * pestaña pide lo suyo, y solo la que esta a la vista.
 *
 * - Activas: TODO lo que no esta pagado ni anulado, sin fecha: una orden
 *   abierta o fiada de hace dias tiene que seguir apareciendo. No se usa
 *   `active=true` de la API porque deja fuera DELIVERED y CREDIT (276 fiadas
 *   en 60 dias en produccion, 27/09/2026).
 * - Pagadas y Todas: ultimos 30 dias.
 * Tope de 500, el mismo que tenia antes.
 */
const ESTADOS_ACTIVOS = [
  OrderStatusEnum.PENDING,
  OrderStatusEnum.IN_PROGRESS,
  OrderStatusEnum.READY,
  OrderStatusEnum.DELIVERED,
  OrderStatusEnum.CREDIT,
].join(',');

const TOPE = 500;
const DIAS_DE_HISTORIAL = 30;

const desdeHaceDias = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

const filtrosDe = (
  waiterId: string,
  tab: WaiterOrdersTab,
): Record<string, string | number> => {
  if (tab === 'active') {
    return { waiterId, status: ESTADOS_ACTIVOS, limit: TOPE };
  }
  const base = {
    waiterId,
    from: desdeHaceDias(DIAS_DE_HISTORIAL),
    limit: TOPE,
  };
  // 'COMPLETED' no existe en OrderStatusEnum pero la pantalla lo contaba
  // como pagada; se conserva para no cambiar lo que se ve.
  return tab === 'paid' ? { ...base, status: 'PAID,COMPLETED' } : base;
};

export const waiterOrderKeys = {
  all: ['waiter-orders'] as const,
  tab: (waiterId: string | undefined, tab: WaiterOrdersTab) =>
    [...waiterOrderKeys.all, tab, waiterId] as const,
};

export function useWaiterOrders(
  waiterId: string | undefined,
  tab: WaiterOrdersTab,
) {
  return useQuery({
    queryKey: waiterOrderKeys.tab(waiterId, tab),
    queryFn: () =>
      api.get<Order[]>('/api/orders', filtrosDe(waiterId ?? '', tab)),
    enabled: !!waiterId,
  });
}
