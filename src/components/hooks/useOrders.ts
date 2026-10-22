import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { PurchaseOrder } from '@odin6/types';

/**
 * Legacy hook - wraps React Query usePurchaseOrders to match old interface
 */
export function useOrders() {
  const { data, isLoading, error, refetch } = usePurchaseOrders();

  return {
    orders: (data ?? []) as PurchaseOrder[],
    loading: isLoading,
    error: error ? 'Error al cargar las ordenes' : null,
    refetch: () => void refetch(),
  };
}
