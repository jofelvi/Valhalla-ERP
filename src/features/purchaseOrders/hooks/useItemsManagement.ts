// Hook para manejo de items en órdenes de compra
'use client';

import { useCallback } from 'react';
import { UseFieldArrayReturn, UseFormSetValue } from 'react-hook-form';
import {
  PurchaseOrderFormValues,
  PurchaseOrderItemFormValues,
} from '@/shared/schemas/purchaseOrderSchema';
import { useToast } from '@/components/hooks/useToast';
import { updateItemWithCalculation } from '../utils';

interface UseItemsManagementParams {
  fieldArray: UseFieldArrayReturn<PurchaseOrderFormValues, 'items'>;
  selectedSupplier: string | null;
  setValue: UseFormSetValue<PurchaseOrderFormValues>;
  watchedItems: PurchaseOrderItemFormValues[];
}

interface UseItemsManagementResult {
  handleAddItem: () => void;
  handleRemoveItem: (index: number) => void;
  handleItemChange: (
    index: number,
    field: keyof PurchaseOrderItemFormValues,
    value: string | number,
  ) => void;
}

/**
 * Hook para manejo de items en la orden de compra
 * @param params Parámetros: fieldArray, selectedSupplier, setValue, watchedItems
 * @returns Manejadores para agregar, remover y cambiar items
 */
export const useItemsManagement = ({
  fieldArray,
  selectedSupplier,
  setValue,
  watchedItems,
}: UseItemsManagementParams): UseItemsManagementResult => {
  const toast = useToast();
  const { append, remove } = fieldArray;

  const handleAddItem = useCallback(() => {
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
    } as PurchaseOrderItemFormValues);

    toast.success({
      title: 'Producto Agregado',
      description: 'Se ha agregado un nuevo producto a la orden.',
    });
  }, [selectedSupplier, append, toast]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      remove(index);
      toast.info({
        title: 'Producto Eliminado',
        description: 'El producto ha sido eliminado de la orden.',
      });
    },
    [remove, toast],
  );

  const handleItemChange = useCallback(
    (
      index: number,
      field: keyof PurchaseOrderItemFormValues,
      value: string | number,
    ) => {
      const newItems = [...watchedItems];
      newItems[index] = updateItemWithCalculation(
        newItems[index],
        field as 'quantity' | 'unitCost' | 'productId',
        value,
      );
      setValue('items', newItems);
    },
    [watchedItems, setValue],
  );

  return {
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
  };
};
