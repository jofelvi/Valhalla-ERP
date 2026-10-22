import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { PurchaseOrder } from '@odin6/types';

export const purchaseOrderKeys = {
  all: ['purchaseOrders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...purchaseOrderKeys.lists(), filters] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
};

export function usePurchaseOrders(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(filters),
    queryFn: () =>
      api.get<PurchaseOrder[]>(
        '/api/purchase-orders',
        filters as Record<string, string>,
      ),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: () => api.get<PurchaseOrder>(`/api/purchase-orders/${id}`),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PurchaseOrder>) =>
      api.post<PurchaseOrder>('/api/purchase-orders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PurchaseOrder> }) =>
      api.patch<PurchaseOrder>(`/api/purchase-orders/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
    },
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/purchase-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

export function useReceiveMerchandise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(`/api/purchase-orders/${id}/receive`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}
