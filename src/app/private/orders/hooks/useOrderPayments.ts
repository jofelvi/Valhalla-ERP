import React, { useState } from 'react';
import { Payment } from '@/modelTypes/payment';
import { Order } from '@/modelTypes/order';
import { api } from '@/services/api/apiClient';

export function useOrderPayments() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderPayments, setSelectedOrderPayments] = useState<Payment[]>(
    [],
  );
  const [loadingPayments, setLoadingPayments] = useState(false);

  React.useEffect(() => {
    if (selectedOrder && selectedOrder.id && loadingPayments) {
      api
        .get<Payment[]>('/api/payments', { orderId: selectedOrder.id })
        .then((payments) => setSelectedOrderPayments(payments))
        .catch(() => setSelectedOrderPayments([]))
        .finally(() => setLoadingPayments(false));
    }
  }, [selectedOrder, loadingPayments]);

  return {
    selectedOrder,
    setSelectedOrder,
    selectedOrderPayments,
    setSelectedOrderPayments,
    loadingPayments,
    setLoadingPayments,
  };
}
