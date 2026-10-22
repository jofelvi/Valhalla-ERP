// features/purchase-orders/PurchaseOrderForm.tsx
'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { PurchaseOrder } from '@odin6/types';
import {
  PurchaseOrderFormValues,
  purchaseOrderSchema,
} from '@/shared/schemas/purchaseOrderSchema';
import { CurrencyEnum, PurchaseOrderStatusEnum } from '@/shared';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useUserStore } from '@/shared/store/useUserStore';
import {
  ErrorDisplay,
  FormFields,
  AttachmentField,
  ItemsSection,
  FormActions,
} from './components';
import {
  useImageUpload,
  useItemsManagement,
  usePurchaseOrderSubmit,
} from './hooks';
import { calculateOrderTotal } from './utils';

interface PurchaseOrderFormProps {
  initialData?: PurchaseOrder | null;
  isNew?: boolean;
}

export default function PurchaseOrderForm({
  initialData = null,
  isNew = false,
}: PurchaseOrderFormProps) {
  const { user } = useUserStore();
  const { data: suppliersData = [] } = useSuppliers();
  const { data: productsData = [] } = useProducts();

  // Hooks de imagen y envío
  const {
    imageFile,
    imagePreview,
    handleImageChange,
    handleRemoveImage,
    setImagePreview,
  } = useImageUpload(initialData?.imageUrl ?? undefined);

  // Setup del formulario
  const form = useForm<PurchaseOrderFormValues>({
    resolver: yupResolver(purchaseOrderSchema),
    mode: 'onChange',
    defaultValues: {
      supplierId: '',
      items: [],
      totalAmount: 0,
      currency: CurrencyEnum.USD,
      status: PurchaseOrderStatusEnum.PENDING,
      expectedDeliveryDate: null,
    },
  });

  const {
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { fields } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch valores del form
  const watchedSupplierId = watch('supplierId');
  const watchedItems = watch('items');

  // Estado derivado de supplier seleccionado
  const selectedSupplier = useMemo(
    () => watchedSupplierId || null,
    [watchedSupplierId],
  );

  // Cargar datos iniciales
  useEffect(() => {
    if (initialData) {
      const itemsWithNames = initialData.items.map((item) => {
        const product = productsData.find((p) => p.id === item.productId);
        return {
          ...item,
          productName:
            product?.name || item.productName || 'Producto no encontrado',
        };
      });

      reset({
        ...initialData,
        items: itemsWithNames,
        expectedDeliveryDate: initialData.expectedDeliveryDate
          ? new Date(initialData.expectedDeliveryDate)
          : null,
      });

      if (initialData.imageUrl) {
        setImagePreview(initialData.imageUrl);
      }
    }
  }, [initialData, reset, productsData, setImagePreview]);

  // Calcular total cuando cambian los items
  useEffect(() => {
    const subscription = watch((value) => {
      const items = value.items || [];
      const total = calculateOrderTotal(items);
      setValue('totalAmount', total);
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  // Hook de manejo de items
  const fieldArray = useFieldArray({
    control,
    name: 'items',
  });

  const itemsHandlers = useItemsManagement({
    fieldArray,
    selectedSupplier,
    setValue,
    watchedItems,
  });

  // Hook de envío
  const { isSubmitting, onSubmit: submitHandler } = usePurchaseOrderSubmit({
    isNew,
    initialData,
    userId: user?.id,
    suppliersData,
  });

  const handleFormSubmit = async (data: PurchaseOrderFormValues) => {
    await submitHandler(data, imageFile, imagePreview);
  };

  // Determinar si se puede enviar
  const canSubmit = useMemo(() => {
    const hasErrors = Object.keys(errors).length > 0;
    const hasItems = watchedItems?.length > 0;
    const hasSupplier = !!watchedSupplierId;

    return !hasErrors && hasItems && hasSupplier && !isSubmitting;
  }, [errors, watchedItems, watchedSupplierId, isSubmitting]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <ErrorDisplay errors={errors} />

      <FormFields form={form} suppliers={suppliersData} />

      <AttachmentField
        imageFile={imageFile}
        imagePreview={imagePreview}
        onImageChange={handleImageChange}
        onRemoveImage={handleRemoveImage}
      />

      <ItemsSection
        fields={fields}
        products={productsData}
        selectedSupplier={selectedSupplier}
        errors={errors}
        onAddItem={itemsHandlers.handleAddItem}
        onItemChange={itemsHandlers.handleItemChange}
        onRemoveItem={itemsHandlers.handleRemoveItem}
      />

      <FormActions
        isNew={isNew}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
        initialDataId={initialData?.id}
      />
    </form>
  );
}
