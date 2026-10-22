import { PurchaseOrder } from '@/features/supply-chain/types/purchaseOrderTypes';
import { Supplier } from '@/features/supply-chain/types/supplierTypes';
import { PriceVarianceReport } from '@/features/supply-chain/types/merchandiseReceiptTypes';

export interface EnrichedPurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit: string;
}

export interface ReceiptFormData {
  deliveryContactName: string;
  deliveryContactPhone: string;
  notes: string;
  items: {
    productId: string;
    productName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    orderedUnitPrice: number;
    receivedUnitPrice: number;
    unit: string;
    notes: string;
  }[];
}

export interface ReceiveMerchandiseContextData {
  purchaseOrder: PurchaseOrder | null;
  supplier: Supplier | null;
  priceVariances: PriceVarianceReport[];
  showVariances: boolean;
}
