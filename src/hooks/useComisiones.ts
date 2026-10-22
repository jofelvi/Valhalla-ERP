import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { PagoComision } from '@odin6/types';

export interface ComisionData {
  id: string;
  waiterId: string;
  waiterName: string;
  totalOrders: number;
  totalSales: number;
  commissionRate: number;
  totalCommission: number;
  isPaid: boolean;
  paidAt?: Date;
  createdAt: Date;
}

export const comisionKeys = {
  all: ['comisiones'] as const,
  lists: () => [...comisionKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...comisionKeys.lists(), filters] as const,
  details: () => [...comisionKeys.all, 'detail'] as const,
  detail: (id: string) => [...comisionKeys.details(), id] as const,
  pending: () => [...comisionKeys.all, 'pending'] as const,
  history: () => [...comisionKeys.all, 'history'] as const,
};

export function useComisiones(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: comisionKeys.list(filters),
    queryFn: () =>
      api.get<PagoComision[]>(
        '/api/comisiones',
        filters as Record<string, string>,
      ),
  });
}

export function useComisionPending() {
  return useQuery({
    queryKey: comisionKeys.pending(),
    queryFn: () => api.get<ComisionData[]>('/api/comisiones/pending', {}),
  });
}

/**
 * Historico de pagos de comision.
 *
 * La clave incluye los filtros: antes era fija (`history()`), asi que pedir
 * otra semana devolvia la de la anterior desde cache sin ir al servidor.
 */
export function useComisionHistorial(
  filters?: Record<string, string | undefined>,
) {
  return useQuery({
    queryKey: [...comisionKeys.history(), filters ?? null] as const,
    queryFn: () =>
      api.get<PagoComision[]>('/api/comisiones/historial', filters),
  });
}

export function useComision(id: string) {
  return useQuery({
    queryKey: comisionKeys.detail(id),
    queryFn: () => api.get<PagoComision>(`/api/comisiones/${id}`),
    enabled: !!id,
  });
}

export function useOrdenesPendientes(waiterId: string) {
  return useQuery({
    queryKey: ['comisiones', 'ordenes', waiterId],
    queryFn: () =>
      api.get('/api/comisiones/ordenes/pendientes', { waiterId } as Record<
        string,
        string
      >),
    enabled: !!waiterId,
  });
}

export function useCalcularComision() {
  return useMutation({
    mutationFn: (waiterId: string) =>
      api.get<ComisionData>('/api/comisiones/calcular', { waiterId } as Record<
        string,
        string
      >),
  });
}

export function usePagarComision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      waiterId: string;
      amount: number;
      reference?: string;
    }) => api.post<PagoComision>('/api/comisiones/pagar', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comisionKeys.lists() });
      qc.invalidateQueries({ queryKey: comisionKeys.pending() });
    },
  });
}
