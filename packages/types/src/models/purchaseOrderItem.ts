export interface PurchaseOrderItem {
  productId: string; // 🔗 relación con Product
  quantity: number;
  unitCost: number;
  subtotal: number;
  productName?: string; // Para mostrar en la UI
}
