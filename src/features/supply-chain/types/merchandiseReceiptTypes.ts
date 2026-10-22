import { DocumentTypeEnum } from '@/shared';

export interface ReceivedItem {
  productId: string;
  productName: string; // Duplicado para historial
  orderedQuantity: number; // Cantidad pedida
  receivedQuantity: number; // Cantidad recibida
  orderedUnitPrice: number; // Precio unitario pedido
  receivedUnitPrice: number; // Precio unitario recibido
  priceVariance?: number; // Diferencia en precio absoluta
  priceVariancePercentage?: number; // Porcentaje de variación
  unit: string; // Unidad de medida
  notes?: string; // Observaciones del item
  isPartialDelivery: boolean; // Si es entrega parcial
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  documentType: DocumentTypeEnum;
  uploadedAt: Date;
  uploadedBy: string; // ID del usuario que subió
}

export interface MerchandiseReceipt {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  supplierName: string; // Duplicado para historial
  receivedBy: string; // ID del usuario que recibió
  receivedByName: string; // Nombre del usuario que recibió
  receivedAt: Date;
  deliveryContactName?: string; // Nombre de quien entregó
  deliveryContactPhone?: string; // Teléfono de quien entregó
  items: ReceivedItem[];
  totalOrderedAmount: number; // Total pedido
  totalReceivedAmount: number; // Total recibido
  totalVariance: number; // Diferencia total
  documents: UploadedDocument[]; // Facturas y documentos subidos
  notes?: string; // Observaciones generales
  isCompleteDelivery: boolean; // Si es entrega completa
  createdAt: Date;
  updatedAt?: Date;
}

export interface InventoryUpdate {
  productId: string;
  previousStock: number;
  addedQuantity: number;
  newStock: number;
  unitCost: number; // Costo unitario actualizado
  previousUnitCost: number; // Costo unitario anterior
  costVariance: number; // Variación en el costo
  updatedAt: Date;
}

export interface PriceVarianceReport {
  productId: string;
  productName: string;
  orderedPrice: number;
  receivedPrice: number;
  variance: number;
  variancePercentage: number;
  impact: 'positive' | 'negative' | 'neutral';
}
