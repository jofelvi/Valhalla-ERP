import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import {
  MetodosDePagoDelPanel,
  OrdenReciente,
  TopMesonerosDelPanel,
  TopProductosDelPanel,
  VentaPorDiaDelPanel,
  VentasDelPanel,
} from '@odin6/types';

/**
 * Un hook por tarjeta del panel, cada uno con su propia clave de cache.
 *
 * Que sean independientes no es un lujo: antes las seis tarjetas colgaban de
 * la misma descarga de 14,35 MB, asi que hasta que no llegaba la mas pesada no
 * se pintaba ninguna. Y si esa descarga fallaba, las tarjetas mostraban
 * USD 0,00 — un cero por fallo se veia igual que un dia sin ventas.
 *
 * Ahora cada tarjeta pide lo suyo, se pinta sola y muestra SU error.
 */

export const panelKeys = {
  all: ['panel'] as const,
  ventas: (interval: SalesIntervalEnum) =>
    [...panelKeys.all, 'ventas', interval] as const,
  metodosPago: (interval: SalesIntervalEnum) =>
    [...panelKeys.all, 'metodos-pago', interval] as const,
  ventaPorDia: (interval: SalesIntervalEnum) =>
    [...panelKeys.all, 'venta-por-dia', interval] as const,
  topProductos: (interval: SalesIntervalEnum, orden: 'desc' | 'asc') =>
    [...panelKeys.all, 'top-productos', interval, orden] as const,
  topMesoneros: (interval: SalesIntervalEnum) =>
    [...panelKeys.all, 'top-mesoneros', interval] as const,
  actividad: (limite: number) =>
    [...panelKeys.all, 'actividad', limite] as const,
};

/**
 * Los numeros del panel envejecen en minutos, no en segundos: el dueno mira
 * esto entre servicio y servicio. Un minuto de frescura evita que cambiar de
 * pestana vuelva a pegarle a la base seis veces.
 */
const FRESCURA_MS = 60_000;

export function usePanelVentas(interval: SalesIntervalEnum) {
  return useQuery({
    queryKey: panelKeys.ventas(interval),
    queryFn: () =>
      api.get<VentasDelPanel>('/api/analytics/panel/ventas', { interval }),
    staleTime: FRESCURA_MS,
  });
}

export function usePanelMetodosPago(interval: SalesIntervalEnum) {
  return useQuery({
    queryKey: panelKeys.metodosPago(interval),
    queryFn: () =>
      api.get<MetodosDePagoDelPanel>('/api/analytics/panel/metodos-pago', {
        interval,
      }),
    staleTime: FRESCURA_MS,
  });
}

export function usePanelVentaPorDia(interval: SalesIntervalEnum) {
  return useQuery({
    queryKey: panelKeys.ventaPorDia(interval),
    queryFn: () =>
      api.get<VentaPorDiaDelPanel>('/api/analytics/panel/venta-por-dia', {
        interval,
      }),
    staleTime: FRESCURA_MS,
  });
}

export function usePanelTopProductos(
  interval: SalesIntervalEnum,
  orden: 'desc' | 'asc' = 'desc',
  limite = 10,
) {
  return useQuery({
    queryKey: panelKeys.topProductos(interval, orden),
    queryFn: () =>
      api.get<TopProductosDelPanel>('/api/analytics/panel/top-productos', {
        interval,
        orden,
        limite: String(limite),
      }),
    staleTime: FRESCURA_MS,
  });
}

export function usePanelTopMesoneros(interval: SalesIntervalEnum) {
  return useQuery({
    queryKey: panelKeys.topMesoneros(interval),
    queryFn: () =>
      api.get<TopMesonerosDelPanel>('/api/analytics/panel/top-mesoneros', {
        interval,
      }),
    staleTime: FRESCURA_MS,
  });
}

export function usePanelActividad(limite = 8) {
  return useQuery({
    queryKey: panelKeys.actividad(limite),
    queryFn: () =>
      api.get<OrdenReciente[]>('/api/analytics/panel/actividad', {
        limite: String(limite),
      }),
    staleTime: FRESCURA_MS,
  });
}
