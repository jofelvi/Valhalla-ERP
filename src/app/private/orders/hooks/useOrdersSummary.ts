import { useMemo } from 'react';
import { Order } from '@/modelTypes/order';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { PaymentStatusEnum, OrderStatusEnum } from '@/shared';

interface OrdersSummary {
  totalCobrado: number;
  totalCreditos: number;
  totalVentas: number;
  cancelledCount: number;
  cancelledTotal: number;
  pendingCount: number;
  inProgressCount: number;
}

export function useOrdersSummary(
  orders: Order[],
  accountReceivables: AccountReceivable[],
): OrdersSummary {
  const receivableByOrderId = useMemo(() => {
    const map = new Map<string, AccountReceivable>();
    for (const ar of accountReceivables) {
      if (ar.orderId) map.set(ar.orderId, ar);
    }
    return map;
  }, [accountReceivables]);

  const summary = useMemo(() => {
    let cobrado = 0;
    let creditos = 0;
    let ventas = 0;
    let cancelledCount = 0;
    let cancelledTotal = 0;
    let pendingCount = 0;
    let inProgressCount = 0;

    for (const order of orders) {
      const ar = receivableByOrderId.get(order.id);
      const isPaid =
        order.paymentStatus === PaymentStatusEnum.PAID ||
        order.paymentStatus === PaymentStatusEnum.PARTIAL;

      if (ar) {
        const pendiente = Math.max(ar.amount - ar.paidAmount, 0);
        creditos += pendiente;
        cobrado += ar.paidAmount;
        ventas += order.total;
      } else if (isPaid) {
        cobrado += order.total;
        ventas += order.total;
      }

      if (order.status === OrderStatusEnum.CANCELLED) {
        cancelledCount += 1;
        cancelledTotal += order.total;
      }

      if (order.status === OrderStatusEnum.PENDING) {
        pendingCount += 1;
      }

      if (order.status === OrderStatusEnum.IN_PROGRESS) {
        inProgressCount += 1;
      }
    }

    return {
      totalCobrado: Math.max(cobrado, 0),
      totalCreditos: Math.max(creditos, 0),
      totalVentas: Math.max(ventas, 0),
      cancelledCount,
      cancelledTotal,
      pendingCount,
      inProgressCount,
    };
  }, [orders, receivableByOrderId]);

  return summary;
}
