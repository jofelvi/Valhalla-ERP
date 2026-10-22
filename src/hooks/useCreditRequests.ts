import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { OrderWithCreditRequest } from '@odin6/types';

export const creditRequestsKeys = {
  all: ['creditRequests'] as const,
  pending: () => [...creditRequestsKeys.all, 'pending'] as const,
};

/**
 * Cada cuanto se vuelve a preguntar por solicitudes nuevas.
 *
 * El sondeo vive AQUI y no en la pantalla: el bloque de solicitudes se monta
 * en tres sitios a la vez (la pantalla propia, el POS y verificar pagos) y
 * React Query deduplica por clave, asi que hay UNA peticion aunque esten las
 * tres abiertas.
 *
 * Era cada 15 s y resulto ser la peticion mas frecuente de todo el sistema:
 * 6.625 de 43.868 en cinco dias, el 15 % del trafico (log de produccion,
 * 23-27/09/2026). Lo que hace aparecer la solicitud al instante es el
 * WebSocket: useRealtimePos invalida esta lista con cada order:updated que
 * trae `creditRequest`. El sondeo queda como red de seguridad si el socket
 * se cae.
 */
const CADA_MINUTO = 60_000;

export function usePendingCreditRequests() {
  return useQuery({
    queryKey: creditRequestsKeys.pending(),
    queryFn: async () => {
      const raw = await api.get<
        Array<OrderWithCreditRequest & { _id?: string }>
      >('/api/orders', { creditRequested: 'true' });
      // Normalizar _id → id
      return raw.map((o) => ({
        ...o,
        id: o.id ?? o._id ?? '',
      }));
    },
    refetchInterval: CADA_MINUTO,
  });
}

export function useApproveCreditRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, pin }: { orderId: string; pin: string }) =>
      api.post<OrderWithCreditRequest>(
        `/api/orders/${orderId}/credit-request/approve`,
        { pin },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditRequestsKeys.pending() });
    },
  });
}

export function useRejectCreditRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.post<OrderWithCreditRequest>(
        `/api/orders/${orderId}/credit-request/reject`,
        { reason },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditRequestsKeys.pending() });
    },
  });
}
