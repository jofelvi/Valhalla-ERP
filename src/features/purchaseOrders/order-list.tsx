'use client';
import OrderGrid from '@/features/purchaseOrders/OrderGrid';
import { useOrders } from '@/components/hooks/useOrders';
import { OrderGridSkeleton } from '@/features/purchaseOrders/order-skeleton';

export function OrderList() {
  const { orders, loading, error, refetch } = useOrders();

  if (loading) {
    return <OrderGridSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-danger mb-4">{error}</div>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-brand text-on-brand rounded hover:bg-brand"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return <OrderGrid orders={orders} />;
}
