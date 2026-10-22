'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useToast } from '@/shared/hooks/useToast';
import { Loader } from '@/shared';
import { EmptyState } from '@/components/shared/EmptyState/EmptyState';
import { merchandiseReceiptService } from '@/features/supply-chain/services/merchandiseReceiptService';
import { ReceivedItem } from '@/features/supply-chain/types/merchandiseReceiptTypes';
import { MerchandiseReceipt } from '@/features/supply-chain/types/merchandiseReceiptTypes';
import {
  ReceiveHeader,
  VarianceAlerts,
  DeliveryInfoSection,
  ReceivedItemsSection,
  SidePanel,
} from './components';
import { useReceiveMerchandise, useReceiptVariances } from './hooks';
import { buildReceivedItemsForSubmit, calculateOrderTotals } from './utils';
import { ReceiptFormData } from './types';

export default function ReceiveMerchandisePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { success, error } = useToast();

  const { id: purchaseOrderId } = params;

  // Cargar datos de orden, proveedor e items
  const { purchaseOrder, supplier, loading, formItems } =
    useReceiveMerchandise(purchaseOrderId);

  // Estado de UI
  const [saving, setSaving] = useState(false);

  // Formulario
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiptFormData>({
    defaultValues: {
      deliveryContactName: '',
      deliveryContactPhone: '',
      notes: '',
      items: [],
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  // Calcular varianzas de precios
  const { priceVariances, showVariances } = useReceiptVariances(watchedItems);

  // Inicializar formulario cuando se carguen los items
  if (formItems.length > 0 && fields.length === 0) {
    setValue('items', formItems);
  }

  // Manejador de envío
  const onSubmit = async (data: ReceiptFormData) => {
    if (!purchaseOrder || !session?.user) return;

    try {
      setSaving(true);

      // Convertir items a ReceivedItems con cálculos de varianza
      const receivedItems: ReceivedItem[] = buildReceivedItemsForSubmit(
        data.items,
      );

      // Calcular totales
      const { totalOrderedAmount, totalReceivedAmount } =
        calculateOrderTotals(receivedItems);

      // Construir datos de recepción
      const receiptData: Omit<
        MerchandiseReceipt,
        'id' | 'createdAt' | 'updatedAt'
      > = {
        purchaseOrderId: purchaseOrder.id,
        supplierId: purchaseOrder.supplierId,
        supplierName: supplier?.name || purchaseOrder.supplierName,
        receivedBy: session.user.id,
        receivedByName: session.user.name || 'Usuario',
        receivedAt: new Date(),
        deliveryContactName: data.deliveryContactName,
        deliveryContactPhone: data.deliveryContactPhone,
        items: receivedItems,
        totalOrderedAmount,
        totalReceivedAmount,
        totalVariance: totalReceivedAmount - totalOrderedAmount,
        documents: [], // Por ahora vacío, se implementará subida de archivos
        notes: data.notes,
        isCompleteDelivery: receivedItems.every(
          (item) => item.receivedQuantity >= item.orderedQuantity,
        ),
      };

      // Crear la recepción
      const receiptId = await merchandiseReceiptService.create(receiptData);

      // Actualizar inventario
      await merchandiseReceiptService.updateInventory(receivedItems, receiptId);

      // Actualizar estado de la orden de compra
      await merchandiseReceiptService.updatePurchaseOrderStatus(
        purchaseOrder.id,
        receivedItems,
      );

      success({ title: 'Mercancía recibida correctamente' });
      router.push(`/private/purchase-orders/${purchaseOrder.id}/details`);
    } catch {
      error({ title: 'Error al registrar la recepción' });
    } finally {
      setSaving(false);
    }
  };

  // Estados de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-elevated">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <Loader />
          </div>
        </div>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="min-h-screen bg-elevated">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EmptyState
            title="Orden de compra no encontrada"
            description="La orden de compra que buscas no existe o fue eliminada"
            icon="📦"
            actionLabel="Volver a Órdenes de Compra"
            actionHref="/private/purchase-orders"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-elevated">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <ReceiveHeader purchaseOrder={purchaseOrder} supplier={supplier} />

        {/* Alertas de Variación */}
        <VarianceAlerts priceVariances={priceVariances} show={showVariances} />

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Contenido principal */}
            <div className="lg:col-span-3 space-y-6">
              <DeliveryInfoSection register={register} errors={errors} />
              <ReceivedItemsSection
                fields={fields}
                register={register}
                errors={errors}
                watchedItems={watchedItems}
              />
            </div>

            {/* Sidebar */}
            <SidePanel
              purchaseOrder={purchaseOrder}
              itemCount={fields.length}
              watchedItems={watchedItems}
              saving={saving}
              onSubmit={handleSubmit(onSubmit)}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
