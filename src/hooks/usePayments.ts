import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Payment } from '@odin6/types';

export interface PaymentWithReference extends Omit<Payment, 'reference'> {
  reference?: string | null;
}

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...paymentKeys.lists(), filters] as const,
  details: () => [...paymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
  byOrder: (orderId: string) => [...paymentKeys.all, 'order', orderId] as const,
};

export function usePayments(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: () =>
      api.get<Payment[]>('/api/payments', filters as Record<string, string>),
  });
}

export function usePaymentsByOrder(orderId: string) {
  return useQuery({
    queryKey: paymentKeys.byOrder(orderId),
    queryFn: () => api.get<Payment[]>('/api/payments', { orderId }),
    enabled: !!orderId,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => api.get<Payment>(`/api/payments/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Payment>) =>
      api.post<Payment>('/api/payments', data),
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: paymentKeys.lists() });
      if (data.orderId) {
        qc.invalidateQueries({
          queryKey: paymentKeys.byOrder(data.orderId as string),
        });
      }
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payment> }) =>
      api.patch<Payment>(`/api/payments/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: paymentKeys.lists() });
      qc.invalidateQueries({ queryKey: paymentKeys.detail(id) });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
  });
}

export function useCheckReference() {
  return useMutation({
    mutationFn: (reference: string) =>
      api.get<{ exists: boolean; orderId?: string }>(
        '/api/payments/check-reference',
        {
          reference,
        },
      ),
  });
}
