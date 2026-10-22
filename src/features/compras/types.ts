import { CurrencyType, PurchaseItemUnit } from '@odin6/types';

export interface MarginAlert {
  productId: string;
  name: string;
  price: number;
  cost: number;
  marginPct: number;
  nivel: 'NEGATIVO' | 'NULO' | 'BAJO';
  causa: string;
  desde: Date;
  resueltaEn: Date | null;
}

export interface PurchaseWizardItem {
  productId: string;
  productName?: string;
  quantity: number;
  purchaseUnit: PurchaseItemUnit;
  lineTotal: number; // Total de la línea (cantidad * unitario)
  unitCost?: number; // Derivado de lineTotal / quantity
}

export interface PurchaseWizardFormData {
  // Paso 1: Factura
  hasInvoice: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceUrls?: string[];

  // Paso 2: Artículos
  items: PurchaseWizardItem[];

  // Paso 3: Cierre
  supplierId: string;
  supplierName?: string;
  purchaseDate: string; // ISO date
  currency: CurrencyType;
  bcvRate?: number;

  // Warehouse (opcional, derivable del contexto)
  warehouseId?: string;
}

export interface CreatePurchaseRequest {
  placeId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: PurchaseItemUnit;
    lineTotal: number;
    purchaseUnit?: PurchaseItemUnit;
  }>;
  currency: CurrencyType;
  bcvRate?: number;
  invoiceUrls?: string[];
  warehouseId?: string;
}

export interface CreatePurchaseResponse {
  id: string;
  placeId: string;
  placeName: string;
  date: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: PurchaseItemUnit;
    unitCost: number;
    currency: CurrencyType;
    subtotal: number;
  }>;
  total: number;
  currency: CurrencyType;
  exchangeRate?: number;
  invoiceUrls?: string[];
  alertasMargen: MarginAlert[];
  createdAt: string;
}
