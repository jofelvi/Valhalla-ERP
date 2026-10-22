import { useState, useCallback } from 'react';
import { Order } from '../../../types';
import { orderService } from '../../../services';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';
import { SelectedCustomer } from '../../../components';

export const useCustomerSelection = (order: Order | null) => {
  const customerModal = useModal('orderDetailCustomer');
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);

  const handleSelectCustomer = useCallback(
    async (customer: SelectedCustomer) => {
      customerModal.close();
      if (!order) return;
      setIsUpdatingCustomer(true);
      try {
        await orderService.updateOrder(order.id, {
          customerId: customer.id,
          customerName: customer.name,
        });
        showAlert(
          'Cliente asociado',
          `${customer.name} quedó vinculado a la orden`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        showAlert('Error al asociar cliente', msg.slice(0, 200));
      } finally {
        setIsUpdatingCustomer(false);
      }
    },
    [order, customerModal],
  );

  return {
    customerModal,
    isUpdatingCustomer,
    handleSelectCustomer,
  };
};
