// Hook para envío de órdenes de compra
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { PurchaseOrder } from '@odin6/types';
import { PurchaseOrderFormValues } from '@/shared/schemas/purchaseOrderSchema';
import { PRIVATE_ROUTES } from '@/shared';
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { useToast } from '@/components/hooks/useToast';
import { uploadFile } from '@/services/uploads/uploadImage';

interface UsePurchaseOrderSubmitParams {
  isNew: boolean;
  initialData?: PurchaseOrder | null;
  userId?: string;
  suppliersData: Array<{ id: string; name: string }>;
}

interface UsePurchaseOrderSubmitResult {
  isSubmitting: boolean;
  onSubmit: (
    data: PurchaseOrderFormValues,
    imageFile: File | null,
    imagePreview: string | null,
  ) => Promise<void>;
}

/**
 * Hook para manejar el envío de órdenes de compra
 * @param params Parámetros: isNew, initialData, userId, suppliersData
 * @returns Estado de envío y función de envío
 */
export const usePurchaseOrderSubmit = ({
  isNew,
  initialData,
  userId = 'unknown-user',
  suppliersData,
}: UsePurchaseOrderSubmitParams): UsePurchaseOrderSubmitResult => {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPurchaseOrder = useCreatePurchaseOrder();
  const updatePurchaseOrder = useUpdatePurchaseOrder();

  const onSubmit = useCallback(
    async (
      data: PurchaseOrderFormValues,
      imageFile: File | null,
      imagePreview: string | null,
    ) => {
      setIsSubmitting(true);

      // Validaciones adicionales
      if (!data.items || data.items.length === 0) {
        toast.error({
          title: 'Error de Validación',
          description: 'Debe agregar al menos un producto a la orden.',
        });
        setIsSubmitting(false);
        return;
      }

      const invalidItems = data.items.filter(
        (item) => !item.productId || item.quantity <= 0 || item.unitCost <= 0,
      );

      if (invalidItems.length > 0) {
        toast.error({
          title: 'Error de Validación',
          description:
            'Todos los productos deben tener cantidad y costo válidos.',
        });
        setIsSubmitting(false);
        return;
      }

      // Subir imagen si hay archivo nuevo
      let finalImageUrl: string | null = initialData?.imageUrl ?? null;
      if (imageFile) {
        try {
          finalImageUrl = await uploadFile(imageFile, 'purchase-orders');
        } catch {
          toast.error({
            title: 'Error al subir adjunto',
            description:
              'No se pudo subir el archivo. La orden se guardará sin imagen.',
          });
          finalImageUrl = null;
        }
      } else if (!imagePreview) {
        finalImageUrl = null;
      }

      try {
        const filteredSuppliers = suppliersData.find(
          (item) => item.id === data.supplierId,
        );

        if (isNew) {
          const orderData: Omit<PurchaseOrder, 'id'> = {
            ...data,
            userId,
            createdAt: new Date(),
            supplierName: filteredSuppliers?.name || '',
            imageUrl: finalImageUrl,
          };
          const newOrder = await createPurchaseOrder.mutateAsync(orderData);

          toast.success({
            title: '¡Órden Creada!',
            description: `La orden de compra ha sido creada exitosamente.`,
          });

          router.push(PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(newOrder.id));
        } else if (initialData?.id) {
          const orderData: PurchaseOrder = {
            ...data,
            id: initialData.id,
            userId,
            createdAt: initialData.createdAt,
            supplierName: filteredSuppliers?.name || '',
            imageUrl: finalImageUrl,
          };
          await updatePurchaseOrder.mutateAsync({
            id: initialData.id,
            data: orderData,
          });

          toast.success({
            title: '¡Órden Actualizada!',
            description: `Los cambios han sido guardados exitosamente.`,
          });

          router.push(PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(initialData.id));
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error desconocido';
        toast.error({
          title: isNew ? 'Error al Crear Órden' : 'Error al Actualizar Órden',
          description: `No se pudo ${isNew ? 'crear' : 'actualizar'} la orden: ${errorMessage}`,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isNew,
      initialData,
      userId,
      suppliersData,
      createPurchaseOrder,
      updatePurchaseOrder,
      router,
      toast,
    ],
  );

  return {
    isSubmitting,
    onSubmit,
  };
};
