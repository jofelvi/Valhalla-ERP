'use client';

import { useParams } from 'next/navigation';
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import PurchaseOrderForm from '@/features/purchaseOrders/PurchaseOrderForm';
import { formatDateForDisplay } from '@/shared/utils/serializeTimestamp';
import BackIcon from '@/components/shared/BackButton/BackButton';
import { PRIVATE_ROUTES } from '@/shared';
import { Loader2 } from 'lucide-react';

export default function EditPurchaseOrderPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const { data: orderData, isLoading } = usePurchaseOrder(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <p className="text-content">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
        <div className="container mx-auto p-6">
          <p className="text-lg text-content">Orden no encontrada</p>
        </div>
      </div>
    );
  }

  const order = {
    ...orderData,
    createdAt: new Date(formatDateForDisplay(orderData.createdAt)),
    expectedDeliveryDate: new Date(
      formatDateForDisplay(orderData.expectedDeliveryDate),
    ),
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <BackIcon
            href={PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(id)}
            tooltip="Volver a Detalles"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand/10 to-ok/5 bg-clip-text text-transparent mt-4">
            Editar Orden de Compra
          </h1>
          <p className="text-brand/80 mt-1">
            Modifica los datos de la orden #{order.id.slice(0, 8)}
          </p>
        </div>
        <div className="bg-surface/90 backdrop-blur-sm shadow-xl rounded-2xl p-8 border border-line/50">
          <PurchaseOrderForm initialData={order} />
        </div>
      </div>
    </div>
  );
}
