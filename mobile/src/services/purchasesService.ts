import { api } from './api/apiClient';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: 'kg' | 'gr' | 'l' | 'ml' | 'und' | 'unidad-compra';
  unitCost: number;
  subtotal: number;
  baseQty: number;
  baseUnit: 'GR' | 'ML' | 'UND';
  costPerBaseUnit: number;
}

export interface PriceAlert {
  productId: string;
  productName: string;
  prevCostPerBase: number;
  newCostPerBase: number;
  variationPct: number;
}

export interface BestPlaceHint {
  productId: string;
  placeId: string;
  placeName: string;
  costPerBase: number;
  savingPct: number;
}

export interface CreatePurchaseDto {
  placeId: string;
  /** Categoria del gasto: insumos de cocina, bebidas, limpieza... */
  category?: string;
  /** Opcional: sin él, el backend usa el almacén por defecto del área GENERAL */
  warehouseId?: string;
  /** Idempotencia: un id por intento de guardar — reintentos por mala red no duplican */
  clientRequestId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: 'kg' | 'gr' | 'l' | 'ml' | 'und' | 'unidad-compra';
    unitCost: number;
    /** Renglon crudo de la factura: al guardar, el backend aprende el alias. */
    invoiceText?: string;
    /** Unidades por bulto confirmadas, para respaldar al OCR la proxima vez. */
    unitsPerPack?: number;
  }>;
  invoiceUrls?: string[];
  currency?: 'USD' | 'BS';
  bcvRate?: number;
}

export interface Purchase {
  id: string;
  placeId: string;
  placeName: string;
  date: Date;
  items: PurchaseItem[];
  total: number;
  totalBs?: number;
  currency?: 'USD' | 'BS';
  exchangeRate?: number;
  invoiceUrls: string[];
  warehouseId: string;
  alerts: PriceAlert[];
  bestPlaceHints: BestPlaceHint[];
  listItemsMarked: number;
  createdBy?: string;
}

export interface PurchaseListItem {
  id: string;
  placeId: string;
  placeName: string;
  date: Date;
  total: number;
  itemsCount: number;
  invoiceUrls: string[];
  createdBy?: string;
}

export interface OcrLine {
  text: string;
  qty: number;
  unitCost: number;
  matchedProductId?: string;
  matchedProductName?: string;
  score: number;
  /** Unidades que trae el bulto, leidas de la descripcion ("222Mlx36UN" -> 36). */
  unitsPerPack?: number | null;
  /** 'alias' = ya aprendido de este proveedor; 'catalogo' = parecido de texto. */
  source?: 'alias' | 'catalogo' | null;
  /** Columna de unidad de la factura: "15 C" = 15 CAJAS, "2 U" = 2 sueltas. */
  invoiceUnit?: 'CAJA' | 'BULTO' | 'UNIDAD' | null;
}

export interface OcrResponse {
  rawText: string;
  lines: OcrLine[];
  /** Cuantos renglones resolvio la memoria del proveedor. */
  aliasesAplicados?: number;
  durationMs: number;
}

export interface Supplier {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface PriceHistoryItem {
  id: string;
  productId: string;
  unitCost: number;
  placeId: string;
  placeName: string;
  purchaseId: string;
  date: Date;
}

export interface BestPlaceInfo {
  productId: string;
  bestPlaceId: string;
  bestPlaceName: string;
  bestCost: number;
  lastCost: number;
  lastPlaceId: string;
  savingPct: number;
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE
// ────────────────────────────────────────────────────────────────────────────

export const purchasesService = {
  // Obtener compras con filtros
  async getPurchases(
    filters: {
      from?: string;
      to?: string;
      placeId?: string;
      limit?: number;
    } = {},
  ): Promise<PurchaseListItem[]> {
    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.placeId) params.append('placeId', filters.placeId);
    if (filters.limit) params.append('limit', String(filters.limit));

    const query = params.toString();
    const url = query
      ? `/api/inventory/purchases?${query}`
      : '/api/inventory/purchases';
    const data = await api.get<PurchaseListItem[]>(url);
    return data.map((item) => ({
      ...item,
      date: new Date(item.date),
    }));
  },

  // Obtener compra por ID
  async getPurchase(id: string): Promise<Purchase> {
    const data = await api.get<Purchase>(`/api/inventory/purchases/${id}`);
    return {
      ...data,
      date: new Date(data.date),
    };
  },

  // Crear compra
  /** Categorias de gasto ya usadas + las sugeridas (para el selector). */
  async listCategories(): Promise<string[]> {
    return api.get<string[]>('/api/inventory/purchases/categories');
  },

  async createPurchase(dto: CreatePurchaseDto): Promise<Purchase> {
    const payload = {
      ...dto,
      currency: dto.currency || 'USD',
      bcvRate: dto.bcvRate,
    };
    const data = await api.post<Purchase>('/api/inventory/purchases', payload);
    return {
      ...data,
      date: new Date(data.date),
    };
  },

  // OCR de factura
  async ocrInvoice(
    imageBase64: string,
    extension: string,
    placeId?: string,
  ): Promise<OcrResponse> {
    // placeId es lo que activa los alias aprendidos de ESE proveedor.
    return api.post<OcrResponse>('/api/inventory/purchases/ocr', {
      imageBase64,
      extension,
      ...(placeId ? { placeId } : {}),
    });
  },

  // Obtener lista de suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return api.get<Supplier[]>('/api/suppliers');
  },

  // Crear supplier
  async createSupplier(name: string): Promise<Supplier> {
    return api.post<Supplier>('/api/suppliers', { name });
  },

  // Actualizar supplier (renombrar)
  async updateSupplier(id: string, name: string): Promise<Supplier> {
    return api.patch<Supplier>(`/api/suppliers/${id}`, { name });
  },

  // Crear insumo rápido
  async createInsumo(dto: {
    name: string;
    presentation?: string;
    presentationQuantity?: number;
    cost?: number;
    barcode?: string;
    imageUrl?: string;
    inventoryArea?: 'COCINA' | 'PIZZERIA' | 'BARRA';
  }): Promise<{ id: string; name: string }> {
    // Buscar categoría "Insumos"
    const categories =
      await api.get<Array<{ id: string; name: string }>>('/api/categories');
    const insumosCategory = categories.find((c) =>
      c.name.toLowerCase().includes('insumo'),
    );
    if (!insumosCategory) {
      throw new Error(
        'No se encontró la categoría "Insumos". Créala en el POS antes de continuar.',
      );
    }

    return api.post<{ id: string; name: string }>('/api/products', {
      name: dto.name,
      presentation: dto.presentation || null,
      presentationQuantity: dto.presentationQuantity || null,
      cost: dto.cost || null,
      barcode: dto.barcode || null,
      imageUrl: dto.imageUrl || null,
      inventoryArea: dto.inventoryArea || null,
      isForInventory: true,
      isForSale: false,
      isActive: true,
      categoryId: insumosCategory.id,
    });
  },

  // Historial de precios
  async getPriceHistory(
    productId: string,
    limit = 50,
  ): Promise<PriceHistoryItem[]> {
    const data = await api.get<PriceHistoryItem[]>(
      `/api/inventory/price-history?productId=${productId}&limit=${limit}`,
    );
    return data.map((item) => ({
      ...item,
      date: new Date(item.date),
    }));
  },

  // Mejores lugares por producto
  async getBestPlaces(productIds: string[]): Promise<BestPlaceInfo[]> {
    return api.post<BestPlaceInfo[]>(
      '/api/inventory/price-history/best-places',
      {
        productIds,
      },
    );
  },
};
