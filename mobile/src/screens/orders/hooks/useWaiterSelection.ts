import { useState, useCallback } from 'react';
import { Order } from '../../../types';
import { orderService } from '../../../services';
import { api } from '../../../services/api/apiClient';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';
import { useTarifas } from '../../../config/hooks';
import { tarifasDeOrden } from '../../../config/tarifasDeOrden';
import { totalesDeSubtotal } from '../../../config/totalesDeOrden';

interface WaiterOption {
  id: string;
  name: string;
}

interface RawWaiter {
  id?: string;
  _id?: string;
  name?: string | undefined;
}

export const useWaiterSelection = (order: Order | null) => {
  const tarifasVigentes = useTarifas();
  const waiterModal = useModal('orderDetailWaiter');
  const [waiterOptions, setWaiterOptions] = useState<WaiterOption[]>([]);
  const [isLoadingWaiters, setIsLoadingWaiters] = useState(false);
  const [isUpdatingWaiter, setIsUpdatingWaiter] = useState(false);

  const loadWaiters = useCallback(async () => {
    setIsLoadingWaiters(true);
    try {
      const users = await api.get<RawWaiter[]>('/api/users/waiters');
      const list: WaiterOption[] = users.map((u) => ({
        id: String(u.id ?? u._id ?? ''),
        name: u.name || 'Sin nombre',
      }));
      setWaiterOptions(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      showAlert('Error', 'No se pudieron cargar los mesoneros');
    } finally {
      setIsLoadingWaiters(false);
    }
  }, []);

  const handleOpenWaiterSelector = useCallback(() => {
    waiterModal.open();
    if (waiterOptions.length === 0) {
      void loadWaiters();
    }
  }, [waiterOptions.length, loadWaiters, waiterModal]);

  const handleSelectWaiter = useCallback(
    async (waiter: WaiterOption | null) => {
      if (!order) return;
      setIsUpdatingWaiter(true);
      try {
        const updateData: Record<string, unknown> = {
          waiterId: waiter?.id ?? null,
          waiterName: waiter?.name ?? null,
          updatedAt: new Date(),
        };

        // Recalcular el servicio con la tarifa de la orden (o la vigente): sin mesonero, no hay servicio.
        const t = totalesDeSubtotal(
          order.subtotal ?? 0,
          !!waiter,
          tarifasDeOrden(order, tarifasVigentes),
        );
        updateData.serviceCharge = t.serviceCharge;
        updateData.total = t.total;

        await orderService.updateOrder(order.id, updateData);
        waiterModal.close();
      } catch {
        showAlert('Error', 'No se pudo actualizar el mesonero');
      } finally {
        setIsUpdatingWaiter(false);
      }
    },
    [order, waiterModal, tarifasVigentes],
  );

  return {
    waiterModal,
    waiterOptions,
    isLoadingWaiters,
    isUpdatingWaiter,
    handleOpenWaiterSelector,
    handleSelectWaiter,
  };
};
