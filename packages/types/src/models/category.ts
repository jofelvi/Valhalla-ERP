export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt?: Date | null;
  imageUrl?: string | null;
  isForSale: boolean;
  /**
   * Categoría padre (auto-referencia). Cuando está presente, esta categoría es
   * una SUBCATEGORÍA de `parentId`. Se reutiliza la misma colección para no
   * migrar datos: todas las categorías existentes quedan como categorías raíz
   * (sin `parentId`). Solo los insumos (BASE) usan subcategorías al vender/gestionar.
   */
  parentId?: string | null;
}
