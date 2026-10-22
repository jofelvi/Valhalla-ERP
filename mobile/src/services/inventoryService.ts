import { api } from './api/apiClient';
import { esInsumoDeInventario } from '../utils/esInsumoDeInventario';
import { toSafeDate } from './dateUtils';
import { useAuthStore } from '../store/authStore';

/**
 * Estacion que le corresponde a cada rol de estacion. Los demas roles
 * (admin, compras, mesonero) devuelven undefined y ven el catalogo completo.
 */
const ESTACION_POR_ROL: Record<string, string> = {
  kitchen: 'KITCHEN',
  bar: 'BAR',
  pizza: 'PIZZA',
};

const estacionDelUsuario = (): string | undefined => {
  const rol = String(useAuthStore.getState().user?.role ?? '').toLowerCase();
  return ESTACION_POR_ROL[rol];
};

// Categoría fija "Insumos" en producción (no venta) — requerida por el DTO
const INSUMOS_CATEGORY_ID = '6a5a598d5f23a90e4336ce0d';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type BaseUnit = 'GR' | 'ML' | 'UND';

// Espejo de la normalización del backend (inventory/units.ts): la unidad base
// de un insumo se deriva de su presentación. Necesario para conteos INICIALES
// de insumos que aún no tienen snapshot de stock en el almacén.
const PRESENTATION_BASE: Record<string, BaseUnit> = {
  kilogramo: 'GR',
  kg: 'GR',
  gramo: 'GR',
  gr: 'GR',
  g: 'GR',
  litro: 'ML',
  l: 'ML',
  mililitro: 'ML',
  ml: 'ML',
  galon: 'ML',
};

export function baseUnitFromPresentation(
  presentation?: string | null,
): BaseUnit {
  const key = (presentation ?? '').trim().toLowerCase();
  return PRESENTATION_BASE[key] ?? 'UND';
}

export interface InsumoProduct {
  id: string;
  name: string;
  presentation?: string | null;
  presentationQuantity?: number | null;
  cost?: number | null;
  barcode?: string | null;
  imageUrl?: string | null;
  baseUnit?: BaseUnit;
  isForInventory?: boolean;
  type?: string;
  isActive?: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  area: 'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA';
  isDefault?: boolean;
  isActive?: boolean;
}

export interface StockItem {
  productId: string;
  qty: number;
  baseUnit: BaseUnit;
  productName?: string; // Enriched by API (see movements.service.ts getStock)
  isActive?: boolean; // Product is active/not deleted
}

export interface InventoryMovement {
  id: string;
  type: string;
  warehouseId: string;
  productId: string;
  qty: number;
  baseUnit: BaseUnit;
  unitCost: number;
  totalCost: number;
  refType?: string;
  refId?: string;
  notes?: string;
  userId: string;
  createdAt: Date;
}

export interface InventoryCountItem {
  productId: string;
  quantity: number;
  unit: string;
}

export interface InventoryCount {
  id: string;
  warehouseId: string;
  type: 'INICIAL' | 'DIARIO' | 'SEMANAL';
  items: Array<{
    productId: string;
    productName?: string;
    systemQty: number;
    countedQty: number;
    diff: number;
    diffCost: number;
    baseUnit: BaseUnit; // Unit for the diff display (unitCost is per baseUnit)
  }>;
  createdAt: Date;
}

export interface TransferDto {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface WasteDto {
  warehouseId: string;
  productId: string;
  quantity: number;
  unit: string;
  reason: string;
  photoUrl: string;
  notes?: string;
}

export interface CreateCountDto {
  warehouseId: string;
  type: 'INICIAL' | 'DIARIO' | 'SEMANAL';
  items: InventoryCountItem[];
  confirmLargeDiffs?: boolean;
}

export interface MovementsFilter {
  warehouseId?: string;
  productId?: string;
  type?: string;
  refId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// RAW TYPES (para normalizar desde el backend)
// ────────────────────────────────────────────────────────────────────────────

interface RawWarehouse {
  id?: string;
  _id?: string;
  name: string;
  area: 'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA';
  isDefault?: boolean;
  isActive?: boolean;
}

interface RawStockItem {
  productId: string;
  qty: number;
  baseUnit: BaseUnit;
  productName?: string;
  isActive?: boolean;
}

interface RawInventoryMovement {
  id?: string;
  _id?: string;
  type: string;
  warehouseId: string;
  productId: string;
  qty: number;
  baseUnit: BaseUnit;
  unitCost: number;
  totalCost: number;
  refType?: string;
  refId?: string;
  notes?: string;
  userId: string;
  createdAt?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// ────────────────────────────────────────────────────────────────────────────

const normalizeWarehouse = (raw: RawWarehouse): Warehouse => ({
  id: String(raw.id ?? raw._id ?? ''),
  name: raw.name,
  area: raw.area,
  isDefault: raw.isDefault,
  isActive: raw.isActive,
});

const normalizeMovement = (raw: RawInventoryMovement): InventoryMovement => ({
  id: String(raw.id ?? raw._id ?? ''),
  type: raw.type,
  warehouseId: raw.warehouseId,
  productId: raw.productId,
  qty: raw.qty,
  baseUnit: raw.baseUnit,
  unitCost: raw.unitCost,
  totalCost: raw.totalCost,
  refType: raw.refType,
  refId: raw.refId,
  notes: raw.notes,
  userId: raw.userId,
  createdAt: toSafeDate(raw.createdAt) || new Date(),
});

// ────────────────────────────────────────────────────────────────────────────
// SERVICE
// ────────────────────────────────────────────────────────────────────────────

export const inventoryService = {
  async getWarehouses(): Promise<Warehouse[]> {
    const raw = await api.get<RawWarehouse[]>('/api/inventory/warehouses');
    return raw.map(normalizeWarehouse);
  },

  async getStock(warehouseId: string): Promise<StockItem[]> {
    const items = await api.get<RawStockItem[]>(
      `/api/inventory/stock/${warehouseId}`,
    );
    return items.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      baseUnit: item.baseUnit,
      productName: item.productName,
      isActive: item.isActive,
    }));
  },

  /**
   * Insumos que la estacion puede manejar.
   *
   * `station` lo manda el llamador, pero el SERVIDOR lo pisa con la estacion
   * del rol: cocina no puede pedir el catalogo de barra aunque lo intente.
   * Antes se pedia el catalogo entero y cocina veia licores y bebidas.
   */
  async getInsumos(station?: string): Promise<InsumoProduct[]> {
    // La estacion sale del rol si el llamador no la pasa: asi ninguna pantalla
    // tiene que acordarse, y admin/compras (sin estacion) siguen viendo todo.
    // El servidor igual pisa el valor con la estacion del rol.
    const est = station ?? estacionDelUsuario();
    const products = await api.get<InsumoProduct[]>(
      '/api/products',
      est ? { station: est } : undefined,
    );
    return products.filter(esInsumoDeInventario).map((p) => ({
      id: p.id,
      name: p.name,
      presentation: p.presentation,
      presentationQuantity: p.presentationQuantity,
      cost: p.cost,
      barcode: p.barcode,
      imageUrl: p.imageUrl,
      baseUnit: p.baseUnit,
      isForInventory: p.isForInventory,
      type: p.type,
      isActive: p.isActive,
    }));
  },

  async createInsumo(dto: {
    name: string;
    presentation?: string;
    presentationQuantity?: number;
    area?: 'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA';
    barcode?: string;
    imageUrl?: string;
    /** Costo de la unidad de compra en USD (interno siempre USD) */
    cost?: number;
  }): Promise<InsumoProduct> {
    const payload = {
      name: dto.name,
      presentation: dto.presentation,
      presentationQuantity: dto.presentationQuantity,
      isForInventory: true,
      type: 'BASE',
      barcode: dto.barcode,
      imageUrl: dto.imageUrl,
      area: dto.area || 'GENERAL',
      // El backend exige price y categoryId (daba 400 sin ellos). Los insumos
      // no se venden: precio 0 y categoría "Insumos" (creada 17/07/2026)
      price: 0,
      categoryId: INSUMOS_CATEGORY_ID,
      isForSale: false,
      isActive: true,
      cost: dto.cost,
    };
    return api.post<InsumoProduct>('/api/products', payload);
  },

  async transfer(dto: TransferDto): Promise<InventoryMovement> {
    const raw = await api.post<RawInventoryMovement>(
      '/api/inventory/transfer',
      dto,
    );
    return normalizeMovement(raw);
  },

  async declareWaste(dto: WasteDto): Promise<InventoryMovement> {
    const raw = await api.post<RawInventoryMovement>(
      '/api/inventory/waste',
      dto,
    );
    return normalizeMovement(raw);
  },

  async createCount(dto: CreateCountDto): Promise<InventoryCount> {
    try {
      const response = await api.post<{
        id: string;
        warehouseId: string;
        type: 'INICIAL' | 'DIARIO' | 'SEMANAL';
        items: Array<{
          productId: string;
          productName?: string;
          systemQty: number;
          countedQty: number;
          diff: number;
          diffCost: number;
          baseUnit: BaseUnit;
        }>;
        createdAt: string;
      }>('/api/inventory/counts', dto);
      return {
        ...response,
        createdAt: toSafeDate(response.createdAt) || new Date(),
      };
    } catch (error) {
      // Re-throw errors including the 400 with 50% message
      throw error;
    }
  },

  async getMovements(filters: MovementsFilter): Promise<InventoryMovement[]> {
    const params = new URLSearchParams();
    if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters.productId) params.append('productId', filters.productId);
    if (filters.type) params.append('type', filters.type);
    if (filters.refId) params.append('refId', filters.refId);
    if (filters.from) params.append('from', filters.from.toISOString());
    if (filters.to) params.append('to', filters.to.toISOString());
    if (filters.limit) params.append('limit', String(filters.limit));

    const raw = await api.get<RawInventoryMovement[]>(
      `/api/inventory/movements?${params.toString()}`,
    );
    return raw.map(normalizeMovement);
  },

  async getCountHistory(warehouseId: string): Promise<InventoryCount[]> {
    const counts = await api.get<
      Array<{
        id: string;
        warehouseId: string;
        type: 'INICIAL' | 'DIARIO' | 'SEMANAL';
        items: Array<{
          productId: string;
          productName?: string;
          systemQty: number;
          countedQty: number;
          diff: number;
          diffCost: number;
          baseUnit: BaseUnit;
        }>;
        createdAt: string;
      }>
    >(`/api/inventory/counts?warehouseId=${warehouseId}`);
    return counts.map((c) => ({
      id: c.id,
      warehouseId: c.warehouseId,
      type: c.type,
      items: c.items,
      createdAt: toSafeDate(c.createdAt) || new Date(),
    }));
  },

  // ── Solicitudes de insumos (estación → admin) ──
  async listInsumoRequests(status?: string): Promise<InsumoRequest[]> {
    return api.get<InsumoRequest[]>(
      '/api/insumo-requests',
      status ? { status } : undefined,
    );
  },

  /**
   * Aprueba y traslada del deposito a la estacion.
   * Con , autoriza el jefe dueño de ese PIN aunque el telefono sea de la
   * estacion; sin el, manda el rol del usuario logueado.
   */
  async approveInsumoRequest(id: string, pin?: string): Promise<void> {
    await api.patch(`/api/insumo-requests/${id}/approve`, pin ? { pin } : {});
  },

  async rejectInsumoRequest(id: string, reason?: string): Promise<void> {
    await api.patch(`/api/insumo-requests/${id}/reject`, { reason });
  },

  // ── Producción de la estación (masas, salsa, porciones) ──

  /**
   * Qué descontaría producir esto, sin registrar nada. Sirve para que la
   * estación vea el crudo que se va antes de enviar la solicitud.
   */
  async previewProduction(
    station: string,
    items: Array<{ productId: string; qty: number; unit?: string }>,
  ): Promise<ProductionPlan[]> {
    return api.post<ProductionPlan[]>(
      '/api/insumo-requests/preview-production',
      { station, items },
    );
  },

  /** Declara lo elaborado. Queda PENDIENTE hasta que gerencia lo autorice. */
  async requestProduction(
    station: string,
    items: InsumoRequestItem[],
    note?: string,
  ): Promise<InsumoRequest> {
    return api.post<InsumoRequest>('/api/insumo-requests', {
      station,
      type: 'PRODUCCION',
      items,
      note,
    });
  },

  /** Propone un insumo que no está en el catálogo. Lo crea gerencia al aprobar. */
  async requestNewInsumo(
    station: string,
    proposedProduct: { name: string; unit?: string; purpose?: string },
    note?: string,
  ): Promise<InsumoRequest> {
    return api.post<InsumoRequest>('/api/insumo-requests', {
      station,
      type: 'ALTA_INSUMO',
      items: [],
      proposedProduct,
      note,
    });
  },
};

/** Lo que el backend calcula para una producción (ver production.helper.ts). */
export interface ProductionPlan {
  output: {
    productId: string;
    productName: string;
    qty: number;
    baseUnit: string;
    unitCost: number;
  };
  consumptions: Array<{
    productId: string;
    productName: string;
    qtyBase: number;
    baseUnit: string;
    resultingStock?: number;
  }>;
  /** Impiden producir (p. ej. falta la receta). */
  blockers: string[];
  /** No impiden, pero gerencia debe saberlo (p. ej. queda negativo). */
  warnings: string[];
}

export interface InsumoRequestItem {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
}

export interface InsumoRequest {
  _id: string;
  station: string;
  /** Ausente en las solicitudes viejas: son TRASLADO. */
  type?: 'TRASLADO' | 'PRODUCCION' | 'ALTA_INSUMO';
  items: InsumoRequestItem[];
  proposedProduct?: { name: string; unit?: string; purpose?: string };
  warnings?: string[];
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedById: string;
  requestedByName?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
}
