import { useMemo } from 'react';
import {
  StockItem,
  InventoryMovement,
  InventoryCount,
  CountItem,
  InventoryBaseUnit,
} from '@odin6/types';
import { Product } from '@odin6/types';
import { baseUnitFromPresentation } from '@/shared/utils/inventoryFormatters';

export interface EnrichedStockItem
  extends Omit<StockItem, 'presentationQuantity' | 'presentation'> {
  productName: string;
  // El producto puede traer estos campos como null (vs undefined en StockItem)
  presentationQuantity?: number | null;
  presentation?: string | null;
}

export interface EnrichedMovement extends InventoryMovement {
  productName: string;
}

export interface EnrichedCountItem extends CountItem {
  productName: string;
  baseUnit: InventoryBaseUnit;
}

export interface EnrichedCount extends Omit<InventoryCount, 'items'> {
  items: EnrichedCountItem[];
}

/**
 * Enriquece stock/movements/counts con el nombre (y datos derivados) del
 * producto, buscándolo en la lista de products ya cargada. Es puramente
 * derivado — se recalcula con useMemo, sin useState/useEffect de sync.
 */
export function useEnrichedInventoryData(
  stock: StockItem[],
  movements: InventoryMovement[],
  counts: InventoryCount[],
  products: Product[],
) {
  const enrichedStock = useMemo<EnrichedStockItem[]>(() => {
    return stock.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || 'Desconocido',
        cost: product?.cost,
        presentationQuantity: product?.presentationQuantity,
        presentation: product?.presentation,
      };
    });
  }, [stock, products]);

  const enrichedMovements = useMemo<EnrichedMovement[]>(() => {
    return movements.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || 'Desconocido',
      };
    });
  }, [movements, products]);

  // El API no envía baseUnit por item de conteo — se deriva de la presentación
  const enrichedCounts = useMemo<EnrichedCount[]>(() => {
    return counts.map((count) => {
      const enrichedItems = count.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          ...item,
          productName: product?.name || 'Desconocido',
          baseUnit:
            item.baseUnit ?? baseUnitFromPresentation(product?.presentation),
        };
      });
      return { ...count, items: enrichedItems };
    });
  }, [counts, products]);

  return { enrichedStock, enrichedMovements, enrichedCounts };
}
