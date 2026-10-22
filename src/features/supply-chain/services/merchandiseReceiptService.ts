/**
 * Merchandise Receipt Service using NestJS API
 */

import { api } from '@/services/api/apiClient';
import { Product } from '@odin6/types';
import {
  InventoryUpdate,
  MerchandiseReceipt,
  PriceVarianceReport,
  ReceivedItem,
} from '../types/merchandiseReceiptTypes';
import { PurchaseOrderStatusEnum } from '@/shared/types/enumShared';

export const createMerchandiseReceipt = async (
  receiptData: Omit<MerchandiseReceipt, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  try {
    const now = new Date();
    const result = await api.post<MerchandiseReceipt>(
      '/api/purchase-orders/receipts',
      {
        ...receiptData,
        createdAt: now,
        updatedAt: now,
      },
    );
    return result.id;
  } catch (error) {
    console.error('Error creating merchandise receipt:', error);
    throw error;
  }
};

export const updateInventoryFromReceipt = async (
  items: ReceivedItem[],
  receiptId: string,
): Promise<InventoryUpdate[]> => {
  const inventoryUpdates: InventoryUpdate[] = [];
  const now = new Date();

  try {
    for (const item of items) {
      const productData = await api.get<Product & { unitCost?: number }>(
        `/api/products/${item.productId}`,
      );

      if (productData) {
        const previousStock = productData.stock || 0;
        const previousUnitCost = productData.unitCost || 0;
        const newStock = previousStock + item.receivedQuantity;

        const totalPreviousValue = previousStock * previousUnitCost;
        const totalNewValue = item.receivedQuantity * item.receivedUnitPrice;
        const newUnitCost =
          newStock > 0
            ? (totalPreviousValue + totalNewValue) / newStock
            : item.receivedUnitPrice;

        const costVariance = newUnitCost - previousUnitCost;

        await api.patch(`/api/products/${item.productId}`, {
          stock: newStock,
          unitCost: newUnitCost,
          lastReceivedAt: now,
          lastReceiptId: receiptId,
        });

        inventoryUpdates.push({
          productId: item.productId,
          previousStock,
          addedQuantity: item.receivedQuantity,
          newStock,
          unitCost: newUnitCost,
          previousUnitCost,
          costVariance,
          updatedAt: now,
        });
      }
    }

    return inventoryUpdates;
  } catch (error) {
    console.error('Error updating inventory:', error);
    throw error;
  }
};

export const updatePurchaseOrderStatus = async (
  purchaseOrderId: string,
  items: ReceivedItem[],
): Promise<void> => {
  try {
    const isCompleteDelivery = items.every(
      (item) => item.receivedQuantity >= item.orderedQuantity,
    );

    const hasPartialDelivery = items.some(
      (item) =>
        item.receivedQuantity > 0 &&
        item.receivedQuantity < item.orderedQuantity,
    );

    let newStatus: PurchaseOrderStatusEnum;
    if (isCompleteDelivery) {
      newStatus = PurchaseOrderStatusEnum.RECEIVED;
    } else if (hasPartialDelivery) {
      newStatus = PurchaseOrderStatusEnum.PARTIALLY_RECEIVED;
    } else {
      newStatus = PurchaseOrderStatusEnum.APPROVED;
    }

    await api.patch(`/api/purchase-orders/${purchaseOrderId}`, {
      status: newStatus,
      receivedAt: new Date(),
    });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    throw error;
  }
};

export const calculatePriceVariances = (
  items: ReceivedItem[],
): PriceVarianceReport[] => {
  return items.map((item) => {
    const variance = item.receivedUnitPrice - item.orderedUnitPrice;
    const variancePercentage =
      item.orderedUnitPrice > 0 ? (variance / item.orderedUnitPrice) * 100 : 0;

    let impact: 'positive' | 'negative' | 'neutral';
    if (variance > 0) {
      impact = 'negative';
    } else if (variance < 0) {
      impact = 'positive';
    } else {
      impact = 'neutral';
    }

    return {
      productId: item.productId,
      productName: item.productName,
      orderedPrice: item.orderedUnitPrice,
      receivedPrice: item.receivedUnitPrice,
      variance,
      variancePercentage,
      impact,
    };
  });
};

export const getMerchandiseReceiptsByPurchaseOrder = async (
  purchaseOrderId: string,
): Promise<MerchandiseReceipt[]> => {
  try {
    return await api.get<MerchandiseReceipt[]>(
      '/api/purchase-orders/receipts',
      {
        purchaseOrderId,
      },
    );
  } catch (error) {
    console.error('Error getting merchandise receipts:', error);
    throw error;
  }
};

export const getAllMerchandiseReceipts = async (): Promise<
  MerchandiseReceipt[]
> => {
  try {
    return await api.get<MerchandiseReceipt[]>('/api/purchase-orders/receipts');
  } catch (error) {
    console.error('Error getting all merchandise receipts:', error);
    throw error;
  }
};

export const merchandiseReceiptService = {
  create: createMerchandiseReceipt,
  updateInventory: updateInventoryFromReceipt,
  updatePurchaseOrderStatus,
  calculatePriceVariances,
  getByPurchaseOrder: getMerchandiseReceiptsByPurchaseOrder,
  getAll: getAllMerchandiseReceipts,
};
