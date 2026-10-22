import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { PagoMovil } from '@odin6/types';
import { AccountReceivable } from '@odin6/types';
import { InvoiceStatusEnum } from '@/shared/types/enumShared';

export interface ReferenceConflict {
  source: 'payments' | 'pagoMoviles';
  paymentId: string;
  orderId?: string;
  amount: number;
  method?: string;
  createdAt?: Date;
}

export const pagoMovilKeys = {
  all: ['pago-movil'] as const,
  lists: () => [...pagoMovilKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...pagoMovilKeys.lists(), filters] as const,
  byReference: (ref: string) => [...pagoMovilKeys.all, 'ref', ref] as const,
  isVerified: (ref: string) => [...pagoMovilKeys.all, 'verified', ref] as const,
};

export function usePagoMoviles(filters?: {
  orderId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: pagoMovilKeys.list(filters),
    queryFn: () =>
      api.get<PagoMovil[]>(
        '/api/pago-movil',
        filters as Record<string, string>,
      ),
    enabled: !!filters?.orderId || !!filters?.status,
  });
}

export function useCreatePagoMovil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PagoMovil>) =>
      api.post<PagoMovil>('/api/pago-movil', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pagoMovilKeys.lists() });
    },
  });
}

// Imperative functions for use in event handlers (not hooks)
export async function getPagoMovilByReference(
  ref: string,
): Promise<PagoMovil | null> {
  try {
    return await api.get<PagoMovil | null>(
      `/api/pago-movil/by-reference/${encodeURIComponent(ref)}`,
    );
  } catch {
    return null;
  }
}

export async function isReferenceAlreadyVerified(ref: string): Promise<{
  isVerified: boolean;
  existingPayment: PagoMovil | null;
}> {
  return api.get(`/api/pago-movil/is-verified/${encodeURIComponent(ref)}`);
}

export async function isPaymentReferenceUsed(
  reference: string,
  excludeOrderId?: string,
): Promise<ReferenceConflict | null> {
  const params: Record<string, string> = {};
  if (excludeOrderId) params.excludeOrderId = excludeOrderId;
  return api.get(
    `/api/payments/check-reference-used/${encodeURIComponent(reference)}`,
    params,
  );
}

export async function getCustomerReceivables(customerId: string) {
  const all = await api.get<AccountReceivable[]>('/api/accounts-receivable', {
    customerId,
  });
  return all.filter(
    (ar) =>
      ar.status === InvoiceStatusEnum.PENDING ||
      ar.status === InvoiceStatusEnum.PARTIALLY_PAID,
  );
}

export async function createPagoMovilRecord(
  data: Partial<PagoMovil>,
): Promise<PagoMovil> {
  return api.post<PagoMovil>('/api/pago-movil', data);
}
