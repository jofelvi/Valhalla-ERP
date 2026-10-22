'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Order } from '@/modelTypes/order';
import { OrderItem } from '@/modelTypes/orderItem';

interface CrearColumnasArgs {
  splitMode: boolean;
  previousPaymentsTotal: number;
  order: Order | undefined;
  splitSelection: Map<number, number>;
  setSplitSelection: Dispatch<SetStateAction<Map<number, number>>>;
  onSplitToggle: (index: number, maxQty: number) => void;
  onSplitQtyChange: (index: number, qty: number, maxQty: number) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onDiscountClick: (item: OrderItem) => void;
  onRemoveItem: (index: number) => void;
}

/**
 * Columnas de la tabla de ítems de la orden en la pantalla de cobro.
 * Factory (no componente) porque TanStack Table consume un ColumnDef[];
 * recibe estado y handlers de la página para no acoplarse a ella.
 */
export function crearColumnasDeItems({
  splitMode,
  previousPaymentsTotal,
  order,
  splitSelection,
  setSplitSelection,
  onSplitToggle,
  onSplitQtyChange,
  onUpdateQuantity,
  onDiscountClick,
  onRemoveItem,
}: CrearColumnasArgs): ColumnDef<OrderItem>[] {
  return [
    // Columna de checkbox para dividir cuenta
    ...(splitMode
      ? [
          {
            id: 'split',
            header: () => {
              // Cuando hay pagos previos no hay select-all
              if (previousPaymentsTotal > 0)
                return <span className="text-[10px] text-dim">Sel.</span>;
              return (
                <input
                  type="checkbox"
                  checked={
                    order ? splitSelection.size === order.items.length : false
                  }
                  onChange={() => {
                    if (!order) return;
                    if (splitSelection.size === order.items.length) {
                      setSplitSelection(new Map());
                    } else {
                      const all = new Map<number, number>();
                      order.items.forEach((item, i) =>
                        all.set(i, item.quantity),
                      );
                      setSplitSelection(all);
                    }
                  }}
                  className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                />
              );
            },
            cell: ({
              row,
            }: {
              row: { index: number; original: OrderItem };
            }) => {
              const idx =
                order?.items.findIndex(
                  (item) =>
                    item.productId === row.original.productId &&
                    item.unitPrice === row.original.unitPrice,
                ) ?? row.index;
              const isSelected = splitSelection.has(idx);
              const selectedQty = splitSelection.get(idx) ?? 0;
              const maxQty = row.original.quantity;

              // Cuando hay pagos previos: marcar items como pagados progresivamente
              if (previousPaymentsTotal > 0 && order) {
                let accumulated = 0;
                for (let i = 0; i < order.items.length; i++) {
                  const item = order.items[i];
                  accumulated += item.unitPrice * item.quantity;
                  if (i === idx) {
                    const isPaid = accumulated <= previousPaymentsTotal;
                    if (isPaid) {
                      return (
                        <span
                          className="text-[10px] text-ok font-medium"
                          title="Ya pagado"
                        >
                          ✓ Pagado
                        </span>
                      );
                    }
                    break;
                  }
                }
              }

              return (
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSplitToggle(idx, maxQty)}
                    className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                  />
                  {isSelected && maxQty > 1 && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() =>
                          onSplitQtyChange(idx, selectedQty - 1, maxQty)
                        }
                        className="h-5 w-5 flex items-center justify-center rounded bg-elevated text-xs font-bold hover:bg-elevated"
                      >
                        -
                      </button>
                      <span className="text-xs font-medium min-w-[1.2rem] text-center">
                        {selectedQty}
                      </span>
                      <button
                        onClick={() =>
                          onSplitQtyChange(idx, selectedQty + 1, maxQty)
                        }
                        className="h-5 w-5 flex items-center justify-center rounded bg-elevated text-xs font-bold hover:bg-elevated"
                        disabled={selectedQty >= maxQty}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            },
          } as ColumnDef<OrderItem>,
        ]
      : []),
    {
      accessorKey: 'name',
      header: 'PRODUCTO',
      cell: ({ row }) => (
        <div className="font-medium text-content">
          <div className="flex items-center gap-2">
            <span>{row.original.name}</span>
            {row.original.customizations && (
              <span className="text-accent text-xs">⚙️</span>
            )}
          </div>

          {/* Personalizaciones */}
          {row.original.customizations && (
            <div className="mt-2 space-y-1">
              {/* Ingredientes removidos */}
              {row.original.customizations.removedIngredients.length > 0 && (
                <div className="text-xs text-danger">
                  🚫 Sin:{' '}
                  {row.original.customizations.removedIngredients.length}{' '}
                  ingrediente(s)
                </div>
              )}
              {/* Adicionales */}
              {row.original.customizations.addedExtras.length > 0 && (
                <div className="text-xs text-accent">
                  ⭐ +{row.original.customizations.addedExtras.length} extra(s)
                  {row.original.customizations.addedExtras.map((extra, idx) => (
                    <div key={idx} className="ml-3">
                      • {extra.name} x{extra.quantity} (+$
                      {(extra.price * extra.quantity).toFixed(2)})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          {row.original.notes && (
            <div className="mt-1 text-xs text-dim italic">
              📝 {row.original.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'unitPrice',
      header: 'PRECIO',
      cell: ({ row }) => (
        <div>
          <span className="font-medium">
            ${row.original.unitPrice.toFixed(2)}
          </span>
          {row.original.customizations &&
            row.original.customizations.customizationPrice > 0 && (
              <div className="text-xs text-accent">
                (+${row.original.customizations.customizationPrice.toFixed(2)})
              </div>
            )}
        </div>
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'CANT',
      cell: ({ row }) => {
        const itemIndex =
          order?.items.findIndex(
            (item) =>
              item.productId === row.original.productId &&
              item.unitPrice === row.original.unitPrice,
          ) ?? -1;

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() =>
                onUpdateQuantity(itemIndex, row.original.quantity - 1)
              }
              className="flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-sm font-bold hover:bg-elevated"
              disabled={row.original.quantity <= 1}
            >
              -
            </button>
            <span className="text-center font-medium min-w-[2rem]">
              {row.original.quantity}
            </span>
            <button
              onClick={() =>
                onUpdateQuantity(itemIndex, row.original.quantity + 1)
              }
              className="flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-sm font-bold hover:bg-elevated"
            >
              +
            </button>
          </div>
        );
      },
    },
    {
      accessorKey: 'subtotal',
      header: 'SUBTOTAL',
      cell: ({ row }) => {
        const itemIndex =
          order?.items.findIndex(
            (item) =>
              item.productId === row.original.productId &&
              item.unitPrice === row.original.unitPrice,
          ) ?? -1;

        const bruto = row.original.unitPrice * row.original.quantity;
        const desc = row.original.discountAmount ?? 0;
        const enCortesia = row.original.noCharge === true;

        return (
          <div className="flex items-center justify-end gap-2 text-right">
            <div className="flex flex-col items-end leading-tight">
              {desc > 0 ? (
                <>
                  <span className="text-[10px] text-dim line-through">
                    ${bruto.toFixed(2)}
                  </span>
                  <span className="font-semibold text-ok">
                    ${(bruto - desc).toFixed(2)}
                  </span>
                  <span
                    className="text-[10px] text-ok"
                    title={row.original.discountReason ?? ''}
                  >
                    −${desc.toFixed(2)}
                    {row.original.discountType === 'PCT'
                      ? ` (${row.original.discountValue}%)`
                      : ''}
                  </span>
                </>
              ) : (
                <span className="font-semibold">${bruto.toFixed(2)}</span>
              )}
            </div>
            {/* El descuento exige PIN admin: el boton solo abre el modal. */}
            {!enCortesia && row.original._id && (
              <button
                onClick={() => onDiscountClick(row.original)}
                className={`rounded p-1 hover:bg-ok/10 ${
                  desc > 0 ? 'text-ok' : 'text-dim hover:text-ok'
                }`}
                title={
                  desc > 0
                    ? `Descuento: ${row.original.discountReason ?? ''}`
                    : 'Aplicar descuento (PIN admin)'
                }
              >
                %
              </button>
            )}
            <button
              onClick={() => onRemoveItem(itemIndex)}
              className="rounded p-1 text-danger hover:bg-danger/10 hover:text-danger"
              title="Eliminar item"
            >
              🗑️
            </button>
          </div>
        );
      },
    },
  ];
}
