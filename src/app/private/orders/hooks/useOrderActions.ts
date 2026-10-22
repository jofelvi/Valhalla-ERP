import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { useToast } from '@/components/hooks/useToast';
import { Order } from '@/modelTypes/order';
import { orderKeys } from '@/hooks/useOrders';

interface WaiterInfo {
  id: string;
  name: string;
}

export function useOrderActions(waiters: WaiterInfo[]) {
  const qc = useQueryClient();
  const toast = useToast();
  const [savingWaiterId, setSavingWaiterId] = useState<string | null>(null);

  const handleAssignWaiter = useCallback(
    async (orderId: string, waiterId: string | null) => {
      setSavingWaiterId(orderId);

      // Optimistic update
      const queryKey = orderKeys.list(undefined);
      const previous = qc.getQueryData<Order[]>(queryKey);
      qc.setQueryData<Order[]>(queryKey, (old) =>
        old?.map((o) =>
          o.id === orderId ? { ...o, waiterId: waiterId ?? undefined } : o,
        ),
      );

      try {
        await api.patch(`/api/orders/${orderId}`, {
          waiterId: waiterId ?? null,
        });
        const waiterName = waiterId
          ? waiters.find((w) => w.id === waiterId)?.name
          : null;
        toast.success({
          title: 'Mesonero actualizado',
          description: waiterName
            ? `Asignado a ${waiterName}`
            : 'Mesonero removido',
        });
      } catch {
        qc.setQueryData(queryKey, previous);
        toast.error({
          title: 'Error',
          description: 'No se pudo asignar el mesonero',
        });
      } finally {
        setSavingWaiterId(null);
      }
    },
    [qc, toast, waiters],
  );

  return {
    savingWaiterId,
    handleAssignWaiter,
  };
}
