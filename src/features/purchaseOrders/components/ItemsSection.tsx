// Componente para la sección de items en la orden
'use client';

import { PurchaseOrderItemFormValues } from '@/shared/schemas/purchaseOrderSchema';
import { Product } from '@odin6/types';
import { ItemRow } from './ItemRow';
import { EmptyItemsMessage } from './EmptyItemsMessage';

interface ItemsSectionProps {
  fields: Array<PurchaseOrderItemFormValues & { id?: string }>;
  products: Product[];
  selectedSupplier: string | null;
  errors: Record<string, unknown>;
  onAddItem: () => void;
  onItemChange: (
    index: number,
    field: keyof PurchaseOrderItemFormValues,
    value: string | number,
  ) => void;
  onRemoveItem: (index: number) => void;
}

/**
 * Componente para la sección de items de la orden de compra
 */
export function ItemsSection({
  fields,
  products,
  selectedSupplier,
  errors,
  onAddItem,
  onItemChange,
  onRemoveItem,
}: ItemsSectionProps) {
  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Items de la Orden</h3>
        <button
          type="button"
          onClick={onAddItem}
          className="bg-gradient-to-r from-ok/10 to-ok/5 text-ok px-4 py-2 rounded-xl text-sm font-medium hover:from-ok/10 hover:to-ok/5 transition-all duration-200 shadow-sm"
        >
          + Agregar Item
        </button>
      </div>

      {fields.length === 0 ? (
        <EmptyItemsMessage selectedSupplier={selectedSupplier} />
      ) : (
        fields.map((item, index) => {
          const itemErrors = (
            errors.items as Array<Record<string, unknown>> | undefined
          )?.[index];
          return (
            <ItemRow
              key={item.id || index}
              item={item}
              index={index}
              products={products}
              selectedSupplier={selectedSupplier}
              errors={itemErrors}
              onItemChange={onItemChange}
              onRemoveItem={onRemoveItem}
            />
          );
        })
      )}
    </div>
  );
}
