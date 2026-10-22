'use client';

import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import SearchableSelect, {
  SearchableSelectOption,
} from '@/components/shared/searchableSelect/SearchableSelect';
import { formatearUsd } from '@/shared/utils/dinero';
import { PurchaseWizardItem } from '../types';
import { PurchaseItemUnit } from '@odin6/types';

interface Step2ItemsProps {
  items: PurchaseWizardItem[];
  onItemsChange: (items: PurchaseWizardItem[]) => void;
}

export function Step2Items({ items, onItemsChange }: Step2ItemsProps) {
  const { data: products = [] } = useProducts();

  // Solo insumos activos
  const inventoryProducts = useMemo(
    () => products.filter((p) => p.isForInventory && p.isActive),
    [products],
  );

  const productOptions: SearchableSelectOption[] = useMemo(
    () =>
      inventoryProducts.map((p) => ({
        value: p.id,
        label: `${p.name}${p.barcode ? ` (${p.barcode})` : ''}`,
      })),
    [inventoryProducts],
  );

  const getProductById = (id: string) =>
    inventoryProducts.find((p) => p.id === id);

  const addItem = () => {
    const newItem: PurchaseWizardItem = {
      productId: '',
      quantity: 1,
      purchaseUnit: 'und' as PurchaseItemUnit,
      lineTotal: 0,
    };
    onItemsChange([...items, newItem]);
  };

  const updateItem = (
    index: number,
    field: keyof PurchaseWizardItem,
    value: unknown,
  ) => {
    const updated = [...items];
    const item = updated[index];

    if (field === 'productId') {
      const product = getProductById(value as string);
      item.productId = value as string;
      item.productName = product?.name;
      // Usar presentationQuantity como default
      if (product?.presentationQuantity) {
        item.quantity = product.presentationQuantity;
      }
    } else if (field === 'quantity' || field === 'lineTotal') {
      item[field] = Number(value) || 0;
      // Derivar unitCost
      if (item.quantity > 0 && item.lineTotal > 0) {
        item.unitCost = item.lineTotal / item.quantity;
      }
    } else if (field === 'purchaseUnit') {
      item.purchaseUnit = value as PurchaseItemUnit;
    }

    onItemsChange(updated);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-content">Paso 2: Artículos</h3>

      {/* Items List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {items.map((item, idx) => {
          const product = getProductById(item.productId);
          return (
            <div
              key={idx}
              className="border border-line rounded-lg p-3 space-y-2"
            >
              <div className="grid grid-cols-1 gap-2">
                {/* Product Selector */}
                <SearchableSelect
                  id={`product-${idx}`}
                  label="Producto"
                  options={productOptions}
                  value={item.productId}
                  onChange={(value) => updateItem(idx, 'productId', value)}
                  placeholder="Selecciona un insumo..."
                  searchPlaceholder="Buscar producto..."
                />

                {/* Quantity & Unit */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-dim mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) =>
                        updateItem(idx, 'quantity', e.target.value)
                      }
                      placeholder="0"
                      className="w-full px-2 py-2 bg-elevated border border-line rounded text-content text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dim mb-1">
                      Unidad
                    </label>
                    <select
                      value={item.purchaseUnit}
                      onChange={(e) =>
                        updateItem(idx, 'purchaseUnit', e.target.value)
                      }
                      className="w-full px-2 py-2 bg-elevated border border-line rounded text-content text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="kg">kg</option>
                      <option value="gr">gr</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="und">und</option>
                      <option value="unidad-compra">unidad-compra</option>
                    </select>
                  </div>
                </div>

                {/* Line Total */}
                <div>
                  <label className="block text-xs font-medium text-dim mb-1">
                    ¿Cuánto pagaste? (total de la línea en USD)
                  </label>
                  <input
                    type="number"
                    value={item.lineTotal || ''}
                    onChange={(e) =>
                      updateItem(idx, 'lineTotal', e.target.value)
                    }
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-2 py-2 bg-elevated border border-line rounded text-content text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                {/* Calculated Unit Cost & Info */}
                {item.unitCost !== undefined && item.unitCost > 0 && (
                  <div className="bg-elevated p-2 rounded text-xs text-dim">
                    <div className="flex justify-between">
                      <span>Costo unitario:</span>
                      <span className="font-medium text-content">
                        {formatearUsd(item.unitCost)}
                      </span>
                    </div>
                    {product?.cost && (
                      <div className="flex justify-between">
                        <span>Costo actual en ficha:</span>
                        <span className="text-content font-medium">
                          {formatearUsd(product.cost)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-danger hover:bg-danger/10 rounded p-1 transition-colors"
                  title="Eliminar artículo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Item Button */}
      <button
        type="button"
        onClick={addItem}
        className="w-full px-4 py-2 bg-elevated text-brand hover:bg-elevated/80 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Agregar Artículo
      </button>

      {/* Summary */}
      {items.length > 0 && (
        <div className="bg-elevated rounded-lg p-3 border border-line">
          <div className="flex items-center justify-between">
            <span className="font-medium text-content">Total:</span>
            <span className="text-xl font-bold text-brand">
              {formatearUsd(total)} USD
            </span>
          </div>
          <div className="text-xs text-dim mt-1">
            {items.length} artículo{items.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
