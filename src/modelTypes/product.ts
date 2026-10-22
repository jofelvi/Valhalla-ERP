import { CurrencyEnum, ProductStationEnum, ProductTypeEnum } from '@/shared';

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: CurrencyEnum;
  type: ProductTypeEnum;
  station?: ProductStationEnum | null;
  categoryId: string;
  /**
   * Subcategoría del insumo (opcional). Apunta a una categoría con `parentId`
   * igual a `categoryId`. Solo aplica a productos BASE (Insumo); el servidor la
   * ignora/limpia para preparados y servicios.
   */
  subcategoryId?: string | null;
  supplierIds?: (string | undefined)[] | null;
  createdAt?: Date | null;
  isActive: boolean;
  isForSale: boolean;
  isForInventory?: boolean;
  cost?: number; // Removemos null para compatibilidad
  category?: string;
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  minStock?: number | null;
  presentation?: string | null;
  presentationQuantity?: number | null;
  /** Gramos del insumo por cada ml de la receta (peso ↔ volumen). */
  gramsPerMl?: number | null;
  /** Gramos que pesa UNA unidad del insumo (peso ↔ contable). */
  gramsPerUnit?: number | null;
  /** ml que tiene UNA unidad del insumo (volumen ↔ contable). */
  mlPerUnit?: number | null;
  updatedAt?: Date | null;
  imageUrl?: string | null;
  ingredients?: Ingredient[] | null;

  /**
   * Cuánto duele que falte. ALTA/MEDIA hacen que el POS avise "Agotado";
   * BAJA solo informa (la sal está en 31 recetas: si bloqueara, no se vendería
   * nada).
   */
  criticality?: 'ALTA' | 'MEDIA' | 'BAJA' | null;

  /** Almacén de inventario cuando no lo define la estación de comanda. */
  inventoryArea?: 'COCINA' | 'PIZZERIA' | 'BARRA' | null;

  /** Naturaleza sin decidir: se vende y no descuenta nada. Lo pone el servidor. */
  naturalezaPendiente?: boolean;

  /** Cuándo se recalculó `cost` por última vez (compra, receta o precio). */
  costUpdatedAt?: Date | string | null;

  /**
   * LEGACY. El stock real vive en `warehouse_stocks` por almacén; este número
   * lleva congelado desde la migración y ya no se edita desde la ficha.
   */
  nivel?: number | null;
}

export interface Ingredient {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage: number; // Nuevo campo
}
