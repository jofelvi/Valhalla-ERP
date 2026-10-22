// features/purchase-orders/PurchaseOrderForm.tsx
'use client';

import { Controller, useFieldArray, useForm, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { PurchaseOrder } from '@odin6/types';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { Button } from '@/components/shared/button/Button';
import { useToast } from '@/shared/hooks/useToast';
import { useUserStore } from '@/shared/store/useUserStore';
import {
  PurchaseOrderFormValues,
  PurchaseOrderItemFormValues,
  purchaseOrderSchema,
} from '@/shared/schemas/purchaseOrderSchema';
import { CurrencyEnum, PurchaseOrderStatusEnum } from '@/shared';

interface PurchaseOrderFormProps {
  initialData?: PurchaseOrder | null;
  isNew?: boolean;
}

export default function PurchaseOrderForm({
  initialData = null,
  isNew = false,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const { user } = useUserStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const toast = useToast();

  const { data: suppliersData = [] } = useSuppliers();
  const { data: productsData = [] } = useProducts();
  const createPurchaseOrder = useCreatePurchaseOrder();
  const updatePurchaseOrder = useUpdatePurchaseOrder();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver: yupResolver(
      purchaseOrderSchema,
    ) as Resolver<PurchaseOrderFormValues>,
    mode: 'onChange', // Validar en tiempo real
    defaultValues: {
      supplierId: '',
      items: [],
      totalAmount: 0,
      currency: CurrencyEnum.USD,
      status: PurchaseOrderStatusEnum.PENDING,
      expectedDeliveryDate: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch supplierId to keep selectedSupplier in sync
  const watchedSupplierId = watch('supplierId');

  // Sync selectedSupplier with form value
  useEffect(() => {
    setSelectedSupplier(watchedSupplierId || null);
  }, [watchedSupplierId]);

  // Cargar datos iniciales del formulario
  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        items: initialData.items,
        expectedDeliveryDate: initialData.expectedDeliveryDate
          ? new Date(initialData.expectedDeliveryDate)
          : null,
      });
    }
  }, [initialData, reset]);

  // Calcular total cuando cambian los items
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name?.startsWith('items') || name === 'supplierId') {
        const items = value.items || [];
        const total = items.reduce(
          (sum, item) => sum + (item?.subtotal || 0),
          0,
        );
        setValue('totalAmount', total);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  const handleAddItem = () => {
    if (!selectedSupplier) {
      toast.warning({
        title: 'Selecciona un Proveedor',
        description:
          'Primero debes seleccionar un proveedor antes de agregar productos.',
      });
      return;
    }

    append({
      productId: '',
      quantity: 1,
      unitCost: 0,
      subtotal: 0,
    });

    toast.success({
      title: 'Producto Agregado',
      description: 'Se ha agregado un nuevo producto a la orden.',
    });
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
    toast.info({
      title: 'Producto Eliminado',
      description: 'El producto ha sido eliminado de la orden.',
    });
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseOrderItemFormValues,
    value: string | number,
  ) => {
    const items = watch('items') || [];
    const newItems = [...items];

    if (field === 'quantity' || field === 'unitCost') {
      const quantity =
        field === 'quantity' ? Number(value) : newItems[index]?.quantity || 0;
      const unitCost =
        field === 'unitCost' ? Number(value) : newItems[index]?.unitCost || 0;
      newItems[index] = {
        ...newItems[index],
        [field]: value,
        subtotal: quantity * unitCost,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }

    setValue('items', newItems);
  };

  // Función para determinar si el formulario puede ser enviado
  const canSubmit = () => {
    const hasErrors = Object.keys(errors).length > 0;
    const hasItems = watch('items')?.length > 0;
    const hasSupplier = watch('supplierId');

    return !hasErrors && hasItems && hasSupplier && !isSubmitting;
  };

  const onSubmit = async (data: {
    supplierId: string;
    items: PurchaseOrderItemFormValues[];
    totalAmount: number;
    currency: string;
    status: string;
    expectedDeliveryDate: Date | null;
  }) => {
    setIsSubmitting(true);

    // Validaciones adicionales antes de enviar
    if (!data.items || data.items.length === 0) {
      toast.error({
        title: 'Error de Validación',
        description: 'Debe agregar al menos un producto a la orden.',
      });
      setIsSubmitting(false);
      return;
    }

    // Verificar que todos los productos tengan datos válidos
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

    try {
      const filteredSuppliers = suppliersData.find(
        (item) => item.id === data.supplierId,
      );

      if (isNew) {
        const orderData: {
          supplierId: string;
          items: PurchaseOrderItemFormValues[];
          totalAmount: number;
          currency: string;
          status: string;
          expectedDeliveryDate: Date | null;
          userId: string;
          createdAt: Date;
          supplierName: string;
        } = {
          ...data,
          userId: user?.id || 'unknown-user',
          createdAt: new Date(),
          supplierName: filteredSuppliers?.name || '',
        };
        const newOrder = await createPurchaseOrder.mutateAsync(
          orderData as PurchaseOrder,
        );

        toast.success({
          title: '¡Órden Creada!',
          description: `La orden de compra ha sido creada exitosamente.`,
        });

        // Redirigir a la página de detalles de la nueva orden
        router.push(PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(newOrder.id));
      } else if (initialData?.id) {
        const orderData: {
          supplierId: string;
          items: PurchaseOrderItemFormValues[];
          totalAmount: number;
          currency: string;
          status: string;
          expectedDeliveryDate: Date | null;
          id: string;
          userId: string;
          createdAt: Date | null | undefined;
          supplierName: string;
        } = {
          ...data,
          id: initialData.id,
          userId: user?.id || 'unknown-user',
          createdAt: initialData.createdAt,
          supplierName: filteredSuppliers?.name || '',
        };
        await updatePurchaseOrder.mutateAsync({
          id: initialData.id,
          data: orderData as PurchaseOrder,
        });

        toast.success({
          title: '¡Órden Actualizada!',
          description: `Los cambios han sido guardados exitosamente.`,
        });

        // Redirigir a la página de detalles de la orden editada
        router.push(PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(initialData.id));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Mostrar mensaje de error específico
      const errorMessage = error?.message || 'Error desconocido';
      toast.error({
        title: isNew ? 'Error al Crear Órden' : 'Error al Actualizar Órden',
        description: `No se pudo ${isNew ? 'crear' : 'actualizar'} la orden: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {Object.keys(errors).length > 0 && (
        <div className="bg-gradient-to-r from-danger/10 to-danger/10 border border-danger text-danger px-4 py-3 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-danger rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-danger mb-2">
                Se encontraron los siguientes errores:
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {Object.entries(errors).map(([key, err]) => {
                  let message = (err as { message: string }).message;
                  // Mejorar mensajes de error específicos
                  if (key === 'items' && message.includes('al menos un item')) {
                    message = 'Debe agregar al menos un producto a la orden';
                  }
                  return (
                    <li key={key} className="text-sm">
                      {message}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label
            htmlFor="supplierId"
            className="block text-sm font-medium text-dim"
          >
            Proveedor *
          </label>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <select
                id="supplierId"
                {...field}
                className={`mt-1 block w-full border ${
                  errors.supplierId ? 'border-danger' : 'border-line'
                } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
              >
                <option value="">Seleccione un proveedor</option>
                {suppliersData.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.supplierId && (
            <p className="mt-1 text-sm text-danger">
              {errors.supplierId.message}
            </p>
          )}
        </div>

        {/* Campo Moneda */}
        <div>
          <label
            htmlFor="currency"
            className="block text-sm font-medium text-dim"
          >
            Moneda *
          </label>
          <select
            id="currency"
            {...register('currency')}
            className={`mt-1 block w-full border ${
              errors.currency ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          >
            <option value="USD">Dólares (USD)</option>
            <option value="EUR">Euros (EUR)</option>
            <option value="COP">Pesos Colombianos (COP)</option>
            <option value="MXN">Pesos Mexicanos (MXN)</option>
          </select>
          {errors.currency && (
            <p className="mt-1 text-sm text-danger">
              {errors.currency.message}
            </p>
          )}
        </div>

        {/* Campo Estado */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-dim"
          >
            Estado *
          </label>
          <select
            id="status"
            {...register('status')}
            className={`mt-1 block w-full border ${
              errors.status ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          >
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobada</option>
            <option value="RECEIVED">Recibida</option>
            <option value="CANCELED">Cancelada</option>
            <option value="PARTIALLY_RECEIVED">Parcialmente Recibida</option>
          </select>
          {errors.status && (
            <p className="mt-1 text-sm text-danger">{errors.status.message}</p>
          )}
        </div>

        {/* Campo Fecha de Entrega */}
        <div>
          <label
            htmlFor="expectedDeliveryDate"
            className="block text-sm font-medium text-dim"
          >
            Fecha Esperada de Entrega
          </label>
          <Controller
            control={control}
            name="expectedDeliveryDate"
            render={({ field }) => (
              <DatePicker
                selected={field.value ? new Date(field.value) : null}
                onChange={(date) => field.onChange(date)}
                className={`mt-1 block w-full border ${
                  errors.expectedDeliveryDate ? 'border-danger' : 'border-line'
                } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
                dateFormat="dd/MM/yyyy"
                placeholderText="Seleccione una fecha"
              />
            )}
          />
        </div>

        {/* Campo Total */}
        <div>
          <label
            htmlFor="totalAmount"
            className="block text-sm font-medium text-dim"
          >
            Total
          </label>
          <input
            id="totalAmount"
            type="number"
            {...register('totalAmount')}
            disabled
            className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 bg-elevated focus:outline-none focus:ring-brand focus:border-brand"
          />
        </div>
      </div>

      {/* Items de la Orden */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Items de la Orden</h3>
          <button
            type="button"
            onClick={handleAddItem}
            className="bg-gradient-to-r from-ok to-ok text-on-brand px-4 py-2 rounded-xl text-sm font-medium hover:from-ok hover:to-ok transition-all duration-200 shadow-sm"
          >
            + Agregar Item
          </button>
        </div>

        {fields.length === 0 && (
          <div className="text-center py-8 bg-gradient-to-br from-elevated to-page rounded-xl border border-line">
            <div className="w-16 h-16 bg-gradient-to-br from-elevated to-elevated rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-dim"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-dim mb-2">
              No hay productos agregados
            </h4>
            <p className="text-sm text-dim mb-4">
              Comienza agregando productos a tu orden de compra
            </p>
            {!selectedSupplier && (
              <p className="text-xs text-accent bg-accent/10 px-3 py-1 rounded-full inline-block">
                ⚠️ Primero selecciona un proveedor
              </p>
            )}
          </div>
        )}

        {fields.map((item, index) => {
          // Obtener errores específicos para este item
          const itemErrors = errors.items?.[index];
          const hasProductError = !item.productId;
          const hasQuantityError = !item.quantity || Number(item.quantity) <= 0;
          const hasUnitCostError = !item.unitCost || Number(item.unitCost) <= 0;

          return (
            <div
              key={item.id}
              className={`grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 p-4 border rounded-xl transition-all duration-200 ${
                itemErrors ||
                hasProductError ||
                hasQuantityError ||
                hasUnitCostError
                  ? 'border-danger bg-gradient-to-r from-danger/10 to-danger/10'
                  : 'border-line bg-gradient-to-r from-page to-elevated'
              }`}
            >
              {/* Producto */}
              <div className="md:col-span-5">
                <label className="block text-sm font-medium text-dim">
                  Producto *
                </label>
                <select
                  value={item.productId || ''}
                  onChange={(e) =>
                    handleItemChange(index, 'productId', e.target.value)
                  }
                  className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none transition-colors duration-200 ${
                    hasProductError || itemErrors?.productId
                      ? 'border-danger focus:ring-danger focus:border-danger bg-danger/10'
                      : 'border-line focus:ring-brand focus:border-brand'
                  }`}
                >
                  <option value="">Seleccione un producto</option>
                  {productsData
                    .filter(
                      (p) =>
                        !selectedSupplier ||
                        p.supplierIds?.includes(selectedSupplier),
                    )
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.sku || 'Sin SKU'}
                      </option>
                    ))}
                </select>
                {(hasProductError || itemErrors?.productId) && (
                  <p className="mt-1 text-xs text-danger font-medium">
                    {itemErrors?.productId?.message || 'Producto es requerido'}
                  </p>
                )}
              </div>

              {/* Cantidad */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dim">
                  Cantidad *
                </label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity || 1}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      'quantity',
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none transition-colors duration-200 ${
                    hasQuantityError || itemErrors?.quantity
                      ? 'border-danger focus:ring-danger focus:border-danger bg-danger/10'
                      : 'border-line focus:ring-brand focus:border-brand'
                  }`}
                />
                {(hasQuantityError || itemErrors?.quantity) && (
                  <p className="mt-1 text-xs text-danger font-medium">
                    {itemErrors?.quantity?.message ||
                      'Cantidad debe ser mayor a 0'}
                  </p>
                )}
              </div>

              {/* Costo Unitario */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dim">
                  Costo Unitario *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitCost || 0}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      'unitCost',
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none transition-colors duration-200 ${
                    hasUnitCostError || itemErrors?.unitCost
                      ? 'border-danger focus:ring-danger focus:border-danger bg-danger/10'
                      : 'border-line focus:ring-brand focus:border-brand'
                  }`}
                />
                {(hasUnitCostError || itemErrors?.unitCost) && (
                  <p className="mt-1 text-xs text-danger font-medium">
                    {itemErrors?.unitCost?.message ||
                      'Costo debe ser mayor a 0'}
                  </p>
                )}
              </div>

              {/* Subtotal */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dim">
                  Subtotal
                </label>
                <input
                  type="number"
                  value={item.subtotal || 0}
                  disabled
                  className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 bg-elevated focus:outline-none focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Eliminar */}
              <div className="md:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="bg-gradient-to-r from-danger to-danger text-on-brand px-3 py-2 rounded-lg text-xs font-medium hover:from-danger hover:to-danger transition-all duration-200 shadow-sm"
                >
                  ✕ Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-line">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (initialData?.id) {
              // Si estamos editando, volver a los detalles
              router.push(
                PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(initialData.id),
              );
            } else {
              // Si estamos creando, volver a la lista
              router.push(PRIVATE_ROUTES.PURCHASE_ORDERS);
            }
          }}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit()} isLoading={isSubmitting}>
          {isSubmitting
            ? isNew
              ? 'Creando...'
              : 'Actualizando...'
            : isNew
              ? 'Crear Orden'
              : 'Actualizar Orden'}
        </Button>
      </div>
    </form>
  );
}
