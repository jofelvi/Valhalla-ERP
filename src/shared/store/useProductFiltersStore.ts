import { create } from 'zustand';

/** Las tres naturalezas + todas. Sustituye al viejo Base/Compuesto. */
export type ProductTypeFilter = 'all' | 'BASE' | 'COMPUESTO' | 'SERVICIO';

/**
 * Filtro por rentabilidad. Cinco bandas clave del margen.
 * `sinCosto` va aparte: un producto sin costo no es "malo", es DESCONOCIDO.
 *
 * Bandas según margenPct (% de ganancia = (precio-costo)/precio*100):
 * - negativo: ≤ 0 % (pierde plata o no gana nada)
 * - critico: 0–30 % (ganancias bajas, en riesgo)
 * - sano: 30–50 % (margen saludable)
 * - excelente: > 50 % (margen muy bueno)
 * - sinCosto: null (sin costo cargado, desconocido)
 */
export type MargenFilter =
  | 'all'
  | 'negativo'
  | 'critico'
  | 'sano'
  | 'excelente'
  | 'sinCosto';

/** Orden de la lista. `ganancia` es el que pidió el dueño, en los dos sentidos. */
export type ProductSort =
  | 'catalogo'
  | 'gananciaAsc'
  | 'gananciaDesc'
  | 'nombre';

export interface ProductFiltersState {
  selectedCategory: string | null;
  stockFilter: 'all' | 'outOfStock' | 'lowStock';
  productTypeFilter: ProductTypeFilter;
  margenFilter: MargenFilter;
  sort: ProductSort;
  searchQuery: string;
  setSelectedCategory: (categoryId: string | null) => void;
  setStockFilter: (filter: 'all' | 'outOfStock' | 'lowStock') => void;
  setProductTypeFilter: (filter: ProductTypeFilter) => void;
  setMargenFilter: (filter: MargenFilter) => void;
  setSort: (sort: ProductSort) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
}

export const useProductFiltersStore = create<ProductFiltersState>((set) => ({
  selectedCategory: null,
  stockFilter: 'all',
  productTypeFilter: 'all',
  margenFilter: 'all',
  sort: 'catalogo',
  searchQuery: '',
  setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),
  setStockFilter: (filter) => set({ stockFilter: filter }),
  setProductTypeFilter: (filter) => set({ productTypeFilter: filter }),
  setMargenFilter: (filter) => set({ margenFilter: filter }),
  setSort: (sort) => set({ sort }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearFilters: () =>
    set({
      selectedCategory: null,
      stockFilter: 'all',
      productTypeFilter: 'all',
      margenFilter: 'all',
      sort: 'catalogo',
      searchQuery: '',
    }),
}));
