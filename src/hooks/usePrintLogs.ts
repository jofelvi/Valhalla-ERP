import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { PrintLog } from '@odin6/types';

export const printLogKeys = {
  all: ['printLogs'] as const,
  list: (orderId?: string) => [...printLogKeys.all, 'list', orderId] as const,
};

export function usePrintLogs(orderId?: string) {
  return useQuery({
    queryKey: printLogKeys.list(orderId),
    queryFn: () =>
      api.get<PrintLog[]>('/api/print-logs', orderId ? { orderId } : undefined),
  });
}

export function useCreatePrintLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/api/print-logs', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: printLogKeys.all });
    },
  });
}
