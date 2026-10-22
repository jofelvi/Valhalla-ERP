import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Order } from '@odin6/types';
import { OrderItemEvent } from '@odin6/types';
import { OrderStatusEnum } from '@/shared';

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  pos: () => [...orderKeys.all, 'pos'] as const,
  byTable: (tableId: string) => [...orderKeys.all, 'byTable', tableId] as const,
  itemEvents: (id: string) => [...orderKeys.all, 'itemEvents', id] as const,
};

export function useOrders(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () =>
      api.get<Order[]>('/api/orders', filters as Record<string, string>),
  });
}

export function usePOSData() {
  return useQuery({
    queryKey: orderKeys.pos(),
    queryFn: () => api.get<unknown>('/api/orders/pos-data', {}),
    // WS (useRealtimePos) mantiene el caché actualizado en tiempo real.
    // Polling desactivado para eliminar requests redundantes cada 30s.
    refetchInterval: false,
  });
}

export function usePendingVerificationOrders() {
  return useQuery({
    queryKey: [...orderKeys.all, 'pending-verification'],
    queryFn: () => api.get<Order[]>('/api/orders/pending-verification', {}),
    refetchInterval: false,
    staleTime: 20000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
    enabled: !!id,
  });
}

// Timeline de auditoría de una orden (eliminaciones, entregas, cortesías...)
export function useOrderItemEvents(orderId: string) {
  return useQuery({
    queryKey: orderKeys.itemEvents(orderId),
    queryFn: () =>
      api.get<OrderItemEvent[]>(`/api/orders/${orderId}/item-events`),
    enabled: !!orderId,
    staleTime: 15_000,
  });
}

export function useActiveOrderByTable(tableId: string) {
  return useQuery({
    queryKey: orderKeys.byTable(tableId),
    queryFn: async () => {
      const filtered = await api.get<Order[]>('/api/orders', {
        tableId,
        active: 'true',
      } as unknown as Record<string, string>);
      return filtered.length > 0 ? filtered[0] : null;
    },
    enabled: !!tableId,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Order>) => api.post<Order>('/api/orders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Order> }) =>
      api.patch<Order>(`/api/orders/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
      qc.invalidateQueries({ queryKey: orderKeys.itemEvents(id) });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatusEnum }) =>
      api.patch<Order>(`/api/orders/${id}`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
    },
  });
}

export function useAddAdditionalNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      text,
      authorId,
      authorName,
    }: {
      orderId: string;
      text: string;
      authorId?: string;
      authorName?: string;
    }) =>
      api.post<Order>(`/api/orders/${orderId}/additional-notes`, {
        text,
        authorId,
        authorName,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(vars.orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
    },
  });
}

export function useCancelOrderWithPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      pin,
      reason,
      userId,
      userName,
    }: {
      orderId: string;
      pin: string;
      reason?: string;
      userId?: string;
      userName?: string;
    }) =>
      api.patch<{ success: boolean; validatedBy?: string }>(
        `/api/orders/${orderId}/cancel`,
        { pin, reason, userId, userName },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(vars.orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}
