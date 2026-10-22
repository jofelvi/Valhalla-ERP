import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import {
  Warehouse,
  StockItem,
  InventoryMovement,
  InventoryCount,
  CreateWarehouseDTO,
  UpdateWarehouseDTO,
  TransferDTO,
  WasteDTO,
  CreateCountDTO,
  AnnulMovementDTO,
  InventoryMovementsFilter,
  Purchase,
  PricePoint,
  ShoppingList,
  CreatePurchaseDTO,
  ProposeItemsDTO,
  UpdateListItemDTO,
  PriceHistorySummary,
  WeeklyReport,
  CatalogAudit,
} from '@odin6/types';
// Importar funciones de suppliers desde el módulo dedicado para evitar caché duplicado
import {
  useSuppliers as useSuppliers_canonical,
  useCreateSupplier as useCreateSupplier_canonical,
  useUpdateSupplier as useUpdateSupplier_canonical,
} from '@/hooks/useSuppliers';

export const inventoryKeys = {
  all: ['inventory'] as const,
  warehouses: () => [...inventoryKeys.all, 'warehouses'] as const,
  warehouse: (id: string) => [...inventoryKeys.warehouses(), id] as const,
  stock: () => [...inventoryKeys.all, 'stock'] as const,
  warehouseStock: (warehouseId: string) =>
    [...inventoryKeys.stock(), warehouseId] as const,
  movements: () => [...inventoryKeys.all, 'movements'] as const,
  movementsList: (filters?: InventoryMovementsFilter) =>
    [...inventoryKeys.movements(), filters] as const,
  counts: () => [...inventoryKeys.all, 'counts'] as const,
  countsList: (warehouseId: string) =>
    [...inventoryKeys.counts(), warehouseId] as const,
  purchases: () => [...inventoryKeys.all, 'purchases'] as const,
  purchasesList: (filters?: Record<string, unknown>) =>
    [...inventoryKeys.purchases(), filters] as const,
  purchase: (id: string) => [...inventoryKeys.purchases(), id] as const,
  priceHistory: () => [...inventoryKeys.all, 'priceHistory'] as const,
  priceHistoryByProduct: (productId: string) =>
    [...inventoryKeys.priceHistory(), productId] as const,
  bestPlaces: () => [...inventoryKeys.all, 'bestPlaces'] as const,
  shoppingLists: () => [...inventoryKeys.all, 'shoppingLists'] as const,
  shoppingListCurrent: () =>
    [...inventoryKeys.shoppingLists(), 'current'] as const,
  shoppingListHistory: (limit?: number) =>
    [...inventoryKeys.shoppingLists(), 'history', limit] as const,
  shoppingListItem: (listId: string, productId: string) =>
    [...inventoryKeys.shoppingLists(), listId, productId] as const,
  suppliers: () => [...inventoryKeys.all, 'suppliers'] as const,
  weeklyReports: () => [...inventoryKeys.all, 'weeklyReports'] as const,
  weeklyReportList: (limit?: number) =>
    [...inventoryKeys.weeklyReports(), 'list', limit] as const,
  weeklyReport: (id: string) => [...inventoryKeys.weeklyReports(), id] as const,
  catalogAudit: (days: number) =>
    [...inventoryKeys.all, 'catalogAudit', days] as const,
};

// Warehouses

export function useWarehouses() {
  return useQuery({
    queryKey: inventoryKeys.warehouses(),
    queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses'),
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: inventoryKeys.warehouse(id),
    queryFn: () => api.get<Warehouse>(`/api/inventory/warehouses/${id}`),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWarehouseDTO) =>
      api.post<Warehouse>('/api/inventory/warehouses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() });
    },
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseDTO }) =>
      api.patch<Warehouse>(`/api/inventory/warehouses/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() });
      qc.invalidateQueries({ queryKey: inventoryKeys.warehouse(id) });
    },
  });
}

// Stock

export function useWarehouseStock(warehouseId: string) {
  return useQuery({
    queryKey: inventoryKeys.warehouseStock(warehouseId),
    queryFn: () => api.get<StockItem[]>(`/api/inventory/stock/${warehouseId}`),
    enabled: !!warehouseId,
  });
}

// Movements

export function useInventoryMovements(filters?: InventoryMovementsFilter) {
  return useQuery({
    queryKey: inventoryKeys.movementsList(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            params[k] = String(v);
          }
        });
      }
      return api.get<InventoryMovement[]>('/api/inventory/movements', params);
    },
  });
}

export function useTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TransferDTO) =>
      api.post<InventoryMovement>('/api/inventory/transfer', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.stock() });
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
    },
  });
}

export function useAnnulMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AnnulMovementDTO }) =>
      api.post<InventoryMovement>(`/api/inventory/movements/${id}/annul`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
      qc.invalidateQueries({ queryKey: inventoryKeys.stock() });
    },
  });
}

// Waste

export function useDeclareWaste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WasteDTO) =>
      api.post<InventoryMovement>('/api/inventory/waste', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.stock() });
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
    },
  });
}

// Counts

export function useInventoryCounts(warehouseId: string) {
  return useQuery({
    queryKey: inventoryKeys.countsList(warehouseId),
    queryFn: () =>
      api.get<InventoryCount[]>('/api/inventory/counts', { warehouseId }),
    enabled: !!warehouseId,
  });
}

export function useCreateCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCountDTO) =>
      api.post<InventoryCount>('/api/inventory/counts', data),
    onSuccess: (_, { warehouseId }) => {
      qc.invalidateQueries({
        queryKey: inventoryKeys.countsList(warehouseId),
      });
      qc.invalidateQueries({
        queryKey: inventoryKeys.warehouseStock(warehouseId),
      });
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
    },
  });
}

// Reconcile

export function useReconcile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (warehouseId: string) =>
      api.post(`/api/inventory/reconcile/${warehouseId}`, {}),
    onSuccess: (_, warehouseId) => {
      qc.invalidateQueries({
        queryKey: inventoryKeys.warehouseStock(warehouseId),
      });
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
    },
  });
}

// Purchases

export function usePurchases(filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: inventoryKeys.purchasesList(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            params[k] = String(v);
          }
        });
      }
      return api.get<Purchase[]>('/api/inventory/purchases', params);
    },
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: inventoryKeys.purchase(id),
    queryFn: () => api.get<Purchase>(`/api/inventory/purchases/${id}`),
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePurchaseDTO) =>
      api.post<Purchase>('/api/inventory/purchases', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.purchases() });
      qc.invalidateQueries({ queryKey: inventoryKeys.stock() });
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingListCurrent() });
      qc.invalidateQueries({ queryKey: inventoryKeys.priceHistory() });
    },
  });
}

// Price History

export function usePriceHistory(productId: string, limit?: number) {
  return useQuery({
    queryKey: inventoryKeys.priceHistoryByProduct(productId),
    queryFn: () => {
      const params: Record<string, string> = { productId };
      if (limit) params.limit = String(limit);
      return api.get<PricePoint[]>('/api/inventory/price-history', params);
    },
    enabled: !!productId,
  });
}

export function useBestPlaces(productIds: string[]) {
  return useQuery({
    queryKey: inventoryKeys.bestPlaces(),
    queryFn: () =>
      api.post<PriceHistorySummary[]>(
        '/api/inventory/price-history/best-places',
        {
          productIds,
        },
      ),
    enabled: productIds.length > 0,
  });
}

// Shopping Lists

export function useShoppingListCurrent() {
  return useQuery({
    queryKey: inventoryKeys.shoppingListCurrent(),
    queryFn: () =>
      api.get<ShoppingList | null>('/api/inventory/shopping-lists/current'),
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useShoppingListHistory(limit?: number) {
  return useQuery({
    queryKey: inventoryKeys.shoppingListHistory(limit),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (limit) params.limit = String(limit);
      return api.get<ShoppingList[]>('/api/inventory/shopping-lists', params);
    },
  });
}

export function useSuggestItems(area: string | undefined) {
  return useQuery({
    queryKey: ['inventorySuggestions', area],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (area) params.area = area;
      return api.get<unknown[]>(
        '/api/inventory/shopping-lists/suggest',
        params,
      );
    },
    enabled: !!area,
  });
}

export function useProposeItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProposeItemsDTO) =>
      api.post<ShoppingList>('/api/inventory/shopping-lists/propose', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingListCurrent() });
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingListHistory() });
    },
  });
}

export function useApproveList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) =>
      api.post<ShoppingList>(
        `/api/inventory/shopping-lists/${listId}/approve`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingLists() });
    },
  });
}

export function useUpdateListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      productId,
      data,
    }: {
      listId: string;
      productId: string;
      data: UpdateListItemDTO;
    }) =>
      api.patch<ShoppingList>(
        `/api/inventory/shopping-lists/${listId}/items/${productId}`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingLists() });
    },
  });
}

// Suppliers (Places)
// Re-exportar desde src/hooks/useSuppliers.ts para usar un único query key
// y evitar caché duplicado (bug arreglado en Fase 5.1)
export const useSuppliers = useSuppliers_canonical;
export const useCreateSupplier = useCreateSupplier_canonical;
export const useUpdateSupplier = useUpdateSupplier_canonical;

// Weekly Reports (Phase 4 - Lane B)

export function useWeeklyReports(limit = 12) {
  return useQuery({
    queryKey: inventoryKeys.weeklyReportList(limit),
    queryFn: async () => {
      const params: Record<string, string> = { limit: String(limit) };
      // El backend devuelve documentos lean con `_id` — normalizar a `id`
      const raw = await api.get<Array<WeeklyReport & { _id?: string }>>(
        '/api/inventory/weekly-reports',
        params,
      );
      return raw.map((r) => ({ ...r, id: r.id ?? r._id ?? '' }));
    },
  });
}

export function useWeeklyReport(id: string) {
  return useQuery({
    queryKey: inventoryKeys.weeklyReport(id),
    queryFn: async () => {
      const raw = await api.get<WeeklyReport & { _id?: string }>(
        `/api/inventory/weekly-reports/${id}`,
      );
      return { ...raw, id: raw.id ?? raw._id ?? '' };
    },
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<WeeklyReport>('/api/inventory/weekly-reports', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.weeklyReports() });
      qc.invalidateQueries({ queryKey: inventoryKeys.weeklyReportList() });
    },
  });
}

export function useRetryAi(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<WeeklyReport>(
        `/api/inventory/weekly-reports/${reportId}/retry-ai`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.weeklyReport(reportId) });
      qc.invalidateQueries({ queryKey: inventoryKeys.weeklyReports() });
    },
  });
}

export function useSendReportWhatsapp(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: boolean; error?: string }>(
        `/api/inventory/weekly-reports/${reportId}/send-whatsapp`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.weeklyReport(reportId) });
      qc.invalidateQueries({ queryKey: inventoryKeys.weeklyReports() });
    },
  });
}

export function useCatalogAudit(days = 30) {
  return useQuery({
    queryKey: inventoryKeys.catalogAudit(days),
    queryFn: () => {
      const params: Record<string, string> = { days: String(days) };
      return api.get<CatalogAudit>('/api/inventory/catalog-audit', params);
    },
  });
}

export function useBuildAiPlan(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ShoppingList>(
        `/api/inventory/shopping-lists/${listId}/ai-plan`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingListCurrent() });
      qc.invalidateQueries({ queryKey: inventoryKeys.shoppingLists() });
    },
  });
}
