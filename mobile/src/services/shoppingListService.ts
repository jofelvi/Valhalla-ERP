import { api, ApiError } from './api/apiClient';
import { BaseUnit } from './inventoryService';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface ShoppingListItem {
  productId: string;
  productName: string;
  suggestedQty?: number;
  adjustedQty?: number;
  unit: string;
  lastCost?: number;
  currentStock?: number;
  purchased?: boolean;
  discarded?: boolean;
  reason?: string;
  station?: 'COCINA' | 'PIZZERIA' | 'BARRA';
}

export interface AiPlanItem {
  productId: string;
  productName: string;
  qty: number;
  unit: BaseUnit;
  lastCost: number;
}

export interface AiPlanGroup {
  placeId: string | null;
  placeName: string;
  items: AiPlanItem[];
  estimatedTotal: number;
  savingsVsWorst: number;
}

export interface ShoppingList {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  status: 'PROPUESTA' | 'APROBADA' | 'COMPLETADA' | 'CERRADA';
  items: ShoppingListItem[];
  itemsCount: number;
  purchasedCount: number;
  createdAt: Date;
  aiPlanByPlace?: AiPlanGroup[];
  aiSummary?: string;
  aiError?: string;
}

export interface ShoppingListHistoryItem {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  status: 'PROPUESTA' | 'APROBADA' | 'COMPLETADA';
  itemsCount: number;
  purchasedCount: number;
}

export interface SuggestedItem {
  productId: string;
  productName: string;
  suggestedQty: number;
  unit: string;
  reason: string;
  lastCost?: number;
  currentStock?: number;
}

export interface ProposeItemsDto {
  station: 'COCINA' | 'PIZZERIA' | 'BARRA';
  items: Array<{
    productId: string;
    quantity: number;
    unit: string;
    reason?: string;
  }>;
}

export interface UpdateListItemPatch {
  adjustedQty?: number;
  purchased?: boolean;
  discarded?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE
// ────────────────────────────────────────────────────────────────────────────

// El backend devuelve documentos Mongoose con `_id` — normalizar a `id`
type RawList = ShoppingList & { _id?: string };
const normalizeList = (data: RawList): ShoppingList => ({
  ...data,
  id: data.id ?? data._id ?? '',
  weekStart: new Date(data.weekStart),
  weekEnd: new Date(data.weekEnd),
  createdAt: new Date(data.createdAt),
});

export const shoppingListService = {
  // Obtener lista actual (puede ser null)
  async getCurrentList(): Promise<ShoppingList | null> {
    try {
      const data = await api.get<RawList>(
        '/api/inventory/shopping-lists/current',
      );
      return normalizeList(data);
    } catch (error) {
      // 404 es esperado cuando no hay lista
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Obtener historial de listas
  async getListHistory(limit = 10): Promise<ShoppingListHistoryItem[]> {
    const data = await api.get<
      Array<ShoppingListHistoryItem & { _id?: string }>
    >(`/api/inventory/shopping-lists?limit=${limit}`);
    return data.map((item) => ({
      ...item,
      id: item.id ?? item._id ?? '',
      weekStart: new Date(item.weekStart),
      weekEnd: new Date(item.weekEnd),
    }));
  },

  // Obtener sugerencias de compra (sin persistir)
  async getSuggestions(area?: string): Promise<SuggestedItem[]> {
    const url = area
      ? `/api/inventory/shopping-lists/suggest?area=${area}`
      : '/api/inventory/shopping-lists/suggest';
    return api.get<SuggestedItem[]>(url);
  },

  // Proponer items para agregar a la lista
  async proposeItems(dto: ProposeItemsDto): Promise<ShoppingList> {
    const data = await api.post<RawList>(
      '/api/inventory/shopping-lists/propose',
      dto,
    );
    return normalizeList(data);
  },

  // Aprobar lista (cambiar status a APROBADA)
  async approveList(listId: string): Promise<ShoppingList> {
    const data = await api.post<RawList>(
      `/api/inventory/shopping-lists/${listId}/approve`,
      {},
    );
    return normalizeList(data);
  },

  // Actualizar item individual de la lista
  async updateListItem(
    listId: string,
    productId: string,
    patch: UpdateListItemPatch,
  ): Promise<ShoppingList> {
    const data = await api.patch<RawList>(
      `/api/inventory/shopping-lists/${listId}/items/${productId}`,
      patch,
    );
    return normalizeList(data);
  },

  // Generar plan de compras organizado por IA
  async buildAiPlan(listId: string): Promise<ShoppingList> {
    const data = await api.post<RawList>(
      `/api/inventory/shopping-lists/${listId}/ai-plan`,
      {},
    );
    return normalizeList(data);
  },
};
