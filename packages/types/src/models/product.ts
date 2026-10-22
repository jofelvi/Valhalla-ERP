import {
  CurrencyEnum,
  ProductStationEnum,
  ProductTypeEnum,
} from '../enums/enumShared';

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: CurrencyEnum;
  type: ProductTypeEnum;
  station?: ProductStationEnum | null;
  categoryId: string;
  subcategoryId?: string | null; // Subcategoría para insumos (opcional)
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
  criticality?: 'ALTA' | 'MEDIA' | 'BAJA' | null; // Impacto de falta de stock
  inventoryArea?: 'COCINA' | 'PIZZERIA' | 'BARRA' | null; // Almacén por defecto
  naturalezaPendiente?: boolean; // Naturaleza sin decidir
  costUpdatedAt?: Date | string | null; // Último cálculo de costo
  nivel?: number | null;
}

export interface Ingredient {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage: number; // Nuevo campo
}
