import { PurchaseOrderItem } from './purchaseOrderItem';
import { CurrencyEnum, PurchaseOrderStatusEnum } from '../enums/enumShared';

export interface PurchaseOrder {
  id: string;
  supplierId: string; // 🔗 relación con Supplier
  userId: string; // 🔗 usuario que hizo la orden
  items: PurchaseOrderItem[];
  supplierName: string;
  totalAmount: number;
  currency: CurrencyEnum;
  isPaid?: boolean;
  status: PurchaseOrderStatusEnum;
  createdAt?: Date | null;
  expectedDeliveryDate?: Date | null | string;
  receivedAt?: Date | null; // fecha real de recepción (cuando se registra la entrada)
  imageUrl?: string | null; // orden de compra / prefactura / factura adjunta
}
