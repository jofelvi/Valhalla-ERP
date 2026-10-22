// Componente para una fila de item en la orden
'use client';

import { PurchaseOrderItemFormValues } from '@/shared/schemas/purchaseOrderSchema';
import { Product } from '@odin6/types';

interface ItemRowProps {
  item: PurchaseOrderItemFormValues & { id?: string };
  index: number;
  products: Product[];
  selectedSupplier: string | null;
  errors?: Record<string, unknown>;
  onItemChange: (
    index: number,
    field: keyof PurchaseOrderItemFormValues,
    value: string | number,
  ) => void;
  onRemoveItem: (index: number) => void;
}

/**
 * Componente para una fila de item en la orden de compra
 */
export function ItemRow({
  item,
  index,
  products,
  selectedSupplier,
  errors,
  onItemChange,
  onRemoveItem,
}: ItemRowProps) {
  // Obtener errores específicos para este item
  const hasProductError = !item.productId;
  const hasQuantityError = !item.quantity || item.quantity <= 0;
  const hasUnitCostError = !item.unitCost || item.unitCost <= 0;

  const errorProductId = errors?.productId as { message?: string } | undefined;
  const errorQuantity = errors?.quantity as { message?: string } | undefined;
  const errorUnitCost = errors?.unitCost as { message?: string } | undefined;

  const hasAnyError =
    errorProductId ||
    errorQuantity ||
    errorUnitCost ||
    hasProductError ||
    hasQuantityError ||
    hasUnitCostError;

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 p-4 border rounded-xl transition-all duration-200 ${
        hasAnyError
          ? 'border-danger bg-gradient-to-r from-danger/10 to-danger/5'
          : 'border-line bg-gradient-to-r from-page to-elevated'
      }`}
    >
      {/* Producto */}
      <div className="md:col-span-5">
        <label className="block text-sm font-medium text-dim">Producto *</label>
        <select
          value={item.productId}
          onChange={(e) => onItemChange(index, 'productId', e.target.value)}
          className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none transition-colors duration-200 ${
            hasProductError || errorProductId
              ? 'border-danger focus:ring-danger/30 focus:border-danger bg-danger/10'
              : 'border-line focus:ring-brand/30 focus:border-brand'
          }`}
        >
          <option value="">Seleccione un producto</option>
          {products
            .filter(
              (p) =>
                !selectedSupplier || p.supplierIds?.includes(selectedSupplier),
            )
            .map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.sku || 'Sin SKU'}
              </option>
            ))}
        </select>
        {(hasProductError || errorProductId) && (
          <p className="mt-1 text-xs text-danger font-medium">
            {errorProductId?.message || 'Producto es requerido'}
          </p>
        )}
      </div>

      {/* Cantidad */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-dim">Cantidad *</label>
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) =>
            onItemChange(index, 'quantity', parseInt(e.target.value) || 0)
          }
          className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none transition-colors duration-200 ${
            hasQuantityError || errorQuantity
              ? 'border-danger focus:ring-danger/30 focus:border-danger bg-danger/10'
              : 'border-line focus:ring-brand/30 focus:border-brand'
          }`}
        />
        {(hasQuantityError || errorQuantity) && (
          <p className="mt-1 text-xs text-danger font-medium">
            {errorQuantity?.message || 'Cantidad debe ser mayor a 0'}
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
          value={item.unitCost}
          onChange={(e) =>
            onItemChange(index, 'unitCost', parseFloat(e.target.value) || 0)
          }
          className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none transition-colors duration-200 ${
            hasUnitCostError || errorUnitCost
              ? 'border-danger focus:ring-danger/30 focus:border-danger bg-danger/10'
              : 'border-line focus:ring-brand/30 focus:border-brand'
          }`}
        />
        {(hasUnitCostError || errorUnitCost) && (
          <p className="mt-1 text-xs text-danger font-medium">
            {errorUnitCost?.message || 'Costo debe ser mayor a 0'}
          </p>
        )}
      </div>

      {/* Subtotal */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-dim">Subtotal</label>
        <input
          type="number"
          value={item.subtotal}
          disabled
          className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 bg-elevated focus:outline-none focus:ring-brand/30 focus:border-brand"
        />
      </div>

      {/* Eliminar */}
      <div className="md:col-span-1 flex items-end">
        <button
          type="button"
          onClick={() => onRemoveItem(index)}
          className="bg-gradient-to-r from-danger/10 to-danger/5 text-danger px-3 py-2 rounded-lg text-xs font-medium hover:from-danger/10 hover:to-danger/5 transition-all duration-200 shadow-sm"
        >
          ✕ Eliminar
        </button>
      </div>
    </div>
  );
}
