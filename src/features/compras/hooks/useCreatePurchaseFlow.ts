import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { CreatePurchaseRequest, CreatePurchaseResponse } from '../types';
import { inventoryKeys } from '@/hooks/useInventory';

export function useCreatePurchaseFlow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreatePurchaseRequest,
    ): Promise<CreatePurchaseResponse> => {
      const response = await api.post<CreatePurchaseResponse>(
        '/api/inventory/purchases',
        data,
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate purchases list and related queries
      qc.invalidateQueries({ queryKey: inventoryKeys.purchases() });
      qc.invalidateQueries({ queryKey: inventoryKeys.purchasesList() });
      // Invalidar stock y alertas si existen en el cache
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
