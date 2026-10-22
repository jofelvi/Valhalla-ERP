import { api } from './api/apiClient';
import {
  KitchenStockItem,
  KitchenSession,
  KitchenLiveStock,
} from '../types/models';

export const kitchenInventoryService = {
  async getInventoryProducts(): Promise<KitchenStockItem[]> {
    return api.get<KitchenStockItem[]>('/api/kitchen/products');
  },

  async getActiveSession(): Promise<KitchenSession | null> {
    return api.get<KitchenSession | null>('/api/kitchen/session/active');
  },

  async getLiveStock(): Promise<KitchenLiveStock> {
    return api.get<KitchenLiveStock>('/api/kitchen/session/stock');
  },

  async openSession(initialStock: KitchenStockItem[]): Promise<KitchenSession> {
    return api.post<KitchenSession>('/api/kitchen/session/open', {
      initialStock,
    });
  },

  async addMidPull(
    item: KitchenStockItem & { by: string },
  ): Promise<KitchenSession> {
    return api.post<KitchenSession>('/api/kitchen/session/pull', item);
  },

  async closeSession(
    closedBy: string,
    physicalCount: Array<{ productId: string; quantity: number }>,
  ): Promise<KitchenSession> {
    return api.post<KitchenSession>('/api/kitchen/session/close', {
      closedBy,
      physicalCount,
    });
  },

  async getHistory(): Promise<KitchenSession[]> {
    return api.get<KitchenSession[]>('/api/kitchen/sessions/history');
  },
};
