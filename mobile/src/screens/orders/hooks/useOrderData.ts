import { useState, useEffect } from 'react';
import { Order } from '../../../types';
import { orderService } from '../../../services';

export const useOrderData = (orderId: string) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = orderService.subscribeToOrder(
      orderId,
      (updatedOrder) => {
        setOrder(updatedOrder);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [orderId]);

  return { order, setOrder, isLoading };
};
