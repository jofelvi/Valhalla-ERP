import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';

export interface BcvRateResponse {
  rate: number;
  source: string;
  timestamp: string;
}

export const bcvRateKeys = {
  all: ['bcvRate'] as const,
  current: () => [...bcvRateKeys.all, 'current'] as const,
};

export function useBcvRate() {
  return useQuery({
    queryKey: bcvRateKeys.current(),
    queryFn: () => api.get<BcvRateResponse>('/api/exchange/bcv-rate'),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchInterval: 24 * 60 * 60 * 1000, // refetch every 24 hours
  });
}
