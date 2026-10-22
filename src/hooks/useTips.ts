import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Tip } from '@odin6/types';

export type { Tip };

export const tipKeys = {
  all: ['tips'] as const,
  lists: () => [...tipKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...tipKeys.lists(), filters] as const,
  details: () => [...tipKeys.all, 'detail'] as const,
  detail: (id: string) => [...tipKeys.details(), id] as const,
  byWaiter: (waiterId: string) => [...tipKeys.all, 'waiter', waiterId] as const,
};

export function useTips(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: tipKeys.list(filters),
    queryFn: () =>
      api.get<Tip[]>('/api/tips', filters as Record<string, string>),
  });
}

/**
 * LA propina de una orden, o `null`. El filtro lo hace el servidor: la
 * pantalla de recibo se bajaba todas las propinas del negocio para buscar una.
 */
export function useTipByOrder(orderId: string) {
  return useQuery({
    queryKey: [...tipKeys.all, 'order', orderId] as const,
    queryFn: () => api.get<Tip[]>('/api/tips', { orderId }),
    select: (propinas): Tip | null => propinas[0] ?? null,
    enabled: !!orderId,
  });
}

export function useTipsByWaiter(waiterId: string) {
  return useQuery({
    queryKey: tipKeys.byWaiter(waiterId),
    queryFn: () => api.get<Tip[]>('/api/tips', { waiterId }),
    enabled: !!waiterId,
  });
}

export function useTip(id: string) {
  return useQuery({
    queryKey: tipKeys.detail(id),
    queryFn: () => api.get<Tip>(`/api/tips/${id}`),
    enabled: !!id,
  });
}

export function useCreateTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Tip>) => api.post<Tip>('/api/tips', data),
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: tipKeys.lists() });
      if (data.waiterId) {
        qc.invalidateQueries({ queryKey: tipKeys.byWaiter(data.waiterId) });
      }
    },
  });
}

export function useUpdateTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tip> }) =>
      api.patch<Tip>(`/api/tips/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: tipKeys.lists() });
      qc.invalidateQueries({ queryKey: tipKeys.detail(id) });
    },
  });
}

export function useDeleteTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/tips/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tipKeys.lists() });
    },
  });
}
