import { useCallback } from 'react';
import { Order } from '../../../types';
import { orderService } from '../../../services';
import { showAlert } from '../../../utils/alert';

interface UseDeliveryManagementParams {
  order: Order | null;
  setOrder: (order: Order) => void;
  orderId: string;
}

export const useDeliveryManagement = ({
  order,
  setOrder,
  orderId,
}: UseDeliveryManagementParams) => {
  const handleDeliveryChange = useCallback(
    (itemIndex: number, newQty: number) => {
      if (!order) return;
      const safeQty = Math.max(0, newQty);
      const updatedItems = order.items.map((item, i) =>
        i === itemIndex ? { ...item, deliveredQty: safeQty } : item,
      );
      setOrder({ ...order, items: updatedItems });
      orderService.updateOrderItems(orderId, updatedItems).catch(() => {
        showAlert('Error', 'No se pudo actualizar la entrega');
      });
    },
    [order, orderId, setOrder],
  );

  return {
    handleDeliveryChange,
  };
};
