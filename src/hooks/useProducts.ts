import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Product } from '@odin6/types';

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  menu: () => [...productKeys.all, 'menu', 'pos'] as const,
};

export function useProducts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () =>
      api.get<Product[]>('/api/products', filters as Record<string, string>),
  });
}

/**
 * Catalogo para tomar pedido: solo lo vendible y sin la metadata que la
 * pantalla no usa (`vista=pos` = el menu + receta + descripcion). La lista
 * completa pesaba 484 KB en PRE (27/09/2026).
 *
 * La receta viene porque el selector decide con ella si un producto se puede
 * personalizar. Los INSUMOS no vienen (no son vendibles): quien necesite sus
 * nombres los pide con `useProductsByIds`.
 *
 * No usar en recetas, costeo ni en pantallas que editen productos.
 */
export function useProductsForMenu() {
  return useQuery({
    queryKey: productKeys.menu(),
    queryFn: () =>
      api.get<Product[]>('/api/products', { forSale: 'true', vista: 'pos' }),
  });
}

/**
 * Carga solo los productos especificados por IDs.
 * Util para pantallas que necesitan datos parciales de un catalogo grande.
 * Ejemplo: en cobro de orden, solo los productos de esa orden.
 */
export function useProductsByIds(productIds: string[]) {
  const idsParam = productIds.length > 0 ? productIds.join(',') : undefined;
  return useQuery({
    queryKey: productKeys.list({ ids: idsParam }),
    queryFn: () =>
      api.get<Product[]>('/api/products', {
        ids: idsParam,
      } as Record<string, string>),
    enabled: productIds.length > 0,
  });
}

export function useProductsByCategory(categoryId: string) {
  return useQuery({
    queryKey: productKeys.list({ categoryId }),
    queryFn: () => api.get<Product[]>('/api/products', { categoryId }),
    enabled: !!categoryId,
  });
}

export function useProductsBySupplier(supplierId: string) {
  return useQuery({
    queryKey: productKeys.list({ supplierId }),
    queryFn: () => api.get<Product[]>('/api/products', { supplierId }),
    enabled: !!supplierId,
  });
}

export function useActiveProducts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: productKeys.list({ ...filters, active: true }),
    queryFn: () =>
      api.get<Product[]>('/api/products', {
        ...filters,
        active: true,
      } as Record<string, string | number | boolean | undefined>),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => api.get<Product>(`/api/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) =>
      api.post<Product>('/api/products', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      api.patch<Product>(`/api/products/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
      qc.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

export interface RecipeIngredientInput {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage?: number;
}

/**
 * Guarda SOLO la receta. Endpoint aparte del PATCH general porque el personal
 * de estación (cocina/pizza/barra) puede usarlo para los productos de SU
 * estación — el precio y el resto de campos quedan fuera de su alcance.
 */
export function useUpdateProductRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ingredients,
      isForInventory,
    }: {
      id: string;
      ingredients: RecipeIngredientInput[];
      isForInventory?: boolean;
    }) =>
      api.patch<Product>(`/api/products/${id}/recipe`, {
        ingredients,
        ...(typeof isForInventory === 'boolean' ? { isForInventory } : {}),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
      qc.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

/**
 * Fija la naturaleza de un producto en un toque, desde la lista de Recetas.
 *
 * Va por `PATCH /api/products/:id` (no por `/recipe`) porque cambiar la
 * naturaleza no es editar una receta: el servidor deriva `isForInventory` y
 * apaga `naturalezaPendiente`. Solo admin/manager.
 */
export function useSetNaturaleza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      api.patch<Product>(`/api/products/${id}`, { type }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
      qc.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

/** Productos que hoy se venden con margen bajo, nulo o negativo. */
export function useMargenesEnRiesgo() {
  return useQuery({
    queryKey: [...productKeys.all, 'margenes'],
    queryFn: () =>
      api.get<
        Array<{
          productId: string;
          name: string;
          price: number;
          cost: number;
          marginPct: number;
          nivel: 'NEGATIVO' | 'NULO' | 'BAJO';
          insumoName?: string;
          causa?: string;
        }>
      >('/api/products/margenes'),
    staleTime: 60_000,
  });
}

export interface CambioDeCosto {
  productId: string;
  name: string;
  costoAnterior: number;
  costoNuevo: number;
  /** Cambio tan grande que más parece un dato roto que un precio nuevo. */
  sospechoso?: 'baja-fuerte' | 'sube-fuerte';
}

export interface LineaConProblema {
  kind: 'insumo-inexistente' | 'unidad-incompatible' | 'sin-costo';
  ingredientId: string;
  insumoName?: string;
  unit?: string;
  falta?: 'gramsPerMl' | 'gramsPerUnit' | 'mlPerUnit';
  mensaje: string;
}

export interface ResultadoRecalculo {
  dryRun: boolean;
  costosActualizados: CambioDeCosto[];
  /** Sospechosos que NO se aplicaron: hay que revisar el dato primero. */
  retenidos: CambioDeCosto[];
  /** Platos que no se pudieron costear, con la línea que lo impide. */
  omitidos: Array<{
    productId: string;
    name: string;
    issues: LineaConProblema[];
  }>;
  alertas: Array<{ productId: string; name: string; marginPct: number }>;
  total: number;
}

export interface OpcionesRecalculo {
  /** Solo calcula y devuelve el plan, sin guardar nada. */
  dryRun?: boolean;
  /** Aplica también los sospechosos (después de revisarlos). */
  forzar?: boolean;
}

/**
 * Repasa TODO el catálogo: recalcula el costo de cada preparado desde su receta
 * y revisa los márgenes. Lo hace el servidor, en cascada; antes esto se
 * calculaba en el navegador y dependía de tener la pantalla abierta.
 *
 * Siempre se llama primero con `dryRun` (vista previa): el servidor retiene
 * los cambios sospechosos y no guarda nada hasta que alguien confirma.
 */
export function useRecalcularCostos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opciones: OpcionesRecalculo = {}) =>
      api.post<ResultadoRecalculo>('/api/products/recalcular-costos', opciones),
    onSuccess: (_resultado, opciones) => {
      if (opciones?.dryRun) return; // la vista previa no cambia nada
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
