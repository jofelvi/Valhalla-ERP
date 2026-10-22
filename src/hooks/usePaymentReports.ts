import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { PaymentReport } from '@odin6/types';

export const paymentReportKeys = {
  all: ['paymentReports'] as const,
  lists: () => [...paymentReportKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...paymentReportKeys.lists(), filters] as const,
  details: () => [...paymentReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentReportKeys.details(), id] as const,
};

export function usePaymentReports(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: paymentReportKeys.list(filters),
    queryFn: () =>
      api.get<PaymentReport[]>(
        '/api/payment-reports',
        filters as Record<string, string>,
      ),
  });
}

export function usePaymentReport(id: string) {
  return useQuery({
    queryKey: paymentReportKeys.detail(id),
    queryFn: () => api.get<PaymentReport>(`/api/payment-reports/${id}`),
    enabled: !!id,
  });
}

export function useCreatePaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PaymentReport>) =>
      api.post<PaymentReport>('/api/payment-reports', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentReportKeys.lists() });
    },
  });
}

export function useCreatePublicPaymentReport() {
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post('/api/public/payment-reports', data),
  });
}

export function useUpdatePaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PaymentReport> }) =>
      api.patch<PaymentReport>(`/api/payment-reports/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: paymentReportKeys.lists() });
      qc.invalidateQueries({ queryKey: paymentReportKeys.detail(id) });
    },
  });
}

export function useApprovePaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/payment-reports/${id}`, { status: 'approved' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentReportKeys.lists() });
    },
  });
}

export function useRejectPaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/payment-reports/${id}`, {
        status: 'rejected',
        rejectionReason: reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentReportKeys.lists() });
    },
  });
}

export function useDeletePaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/payment-reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentReportKeys.lists() });
    },
  });
}
