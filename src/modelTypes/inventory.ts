// Inventory type definitions

export type InventoryBaseUnit = 'GR' | 'ML' | 'UND';
export type WarehouseArea = 'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA';
export type MovementType =
  | 'COMPRA'
  | 'CONSUMO_VENTA'
  | 'TRASLADO'
  | 'MERMA_DECLARADA'
  | 'CONTEO_AJUSTE'
  | 'CONTEO_INICIAL'
  | 'ANULACION';
export type CountType = 'INICIAL' | 'DIARIO' | 'SEMANAL';

export interface Warehouse {
  id: string;
  name: string;
  area: WarehouseArea;
  isDefault?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockItem {
  productId: string;
  qty: number;
  baseUnit: InventoryBaseUnit;
  cost?: number;
  presentationQuantity?: number;
  presentation?: string;
  productName?: string;
}

export interface InventoryMovement {
  id: string;
  type: MovementType;
  warehouseId: string;
  productId: string;
  qty: number;
  baseUnit: InventoryBaseUnit;
  unitCost?: number;
  totalCost?: number;
  refType?: string;
  refId?: string;
  notes?: string;
  userId: string;
  createdAt: Date;
  productName?: string;
  userName?: string;
}

export interface CountItem {
  productId: string;
  systemQty: number;
  countedQty: number;
  /** El API no lo envía por item — la UI lo deriva de la presentación del producto */
  baseUnit?: InventoryBaseUnit;
  diff: number;
  diffCost?: number;
  productName?: string;
}

export interface InventoryCount {
  id: string;
  warehouseId: string;
  type: CountType;
  items: CountItem[];
  totalDiffCost?: number;
  totalDiffQty?: number;
  createdAt: Date;
  userId: string;
}

// DTOs

export interface CreateWarehouseDTO {
  name: string;
  area: WarehouseArea;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateWarehouseDTO {
  name?: string;
  area?: WarehouseArea;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface TransferDTO {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  unit: InventoryBaseUnit;
  notes?: string;
}

export interface WasteDTO {
  warehouseId: string;
  productId: string;
  quantity: number;
  unit: InventoryBaseUnit;
  reason: string;
  photoUrl: string;
  notes?: string;
}

export interface CreateCountDTO {
  warehouseId: string;
  type: CountType;
  items: {
    productId: string;
    quantity: number;
    unit: InventoryBaseUnit;
  }[];
  confirmLargeDiffs?: boolean;
}

export interface AnnulMovementDTO {
  notes?: string;
}

export interface InventoryMovementsFilter {
  warehouseId?: string;
  productId?: string;
  type?: MovementType;
  refType?: string;
  refId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

// Purchases (Phase 3 - Lane B)

export type CurrencyType = 'USD' | 'BS';
export type PurchaseItemUnit =
  | 'kg'
  | 'gr'
  | 'l'
  | 'ml'
  | 'und'
  | 'unidad-compra';
export type ShoppingListStatus = 'PROPUESTA' | 'APROBADA' | 'CERRADA';

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: PurchaseItemUnit;
  unitCost: number;
  currency: CurrencyType;
  subtotal: number;
  baseQty?: number;
  baseUnit?: InventoryBaseUnit;
  costPerBaseUnit?: number;
  unitCostBs?: number;
  subtotalBs?: number;
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

export interface Purchase {
  id: string;
  placeId: string;
  placeName: string;
  date: Date;
  items: PurchaseItem[];
  total: number;
  totalBs?: number;
  currency: CurrencyType;
  exchangeRate?: number;
  invoiceUrls?: string[];
  warehouseId: string;
  alerts?: PriceAlert[];
  bestPlaceHints?: BestPlaceHint[];
  listItemsMarked?: number;
  createdBy?: string;
  createdAt?: Date;
}

export interface PricePoint {
  id: string;
  productId: string;
  unitCost: number;
  placeId: string;
  placeName: string;
  purchaseId: string;
  date: Date;
}

export interface ShoppingListItem {
  productId: string;
  productName: string;
  suggestedQty?: number;
  adjustedQty: number;
  unit: PurchaseItemUnit;
  lastCost?: number;
  currentStock?: number;
  station?: WarehouseArea;
  purchased: boolean;
  discarded: boolean;
  reason?: string;
}

export interface ShoppingList {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  status: ShoppingListStatus;
  items: ShoppingListItem[];
  itemsCount?: number;
  purchasedCount?: number;
  createdAt?: Date;
  aiPlanByPlace?: AiPlanGroup[];
  aiSummary?: string | null;
}

// DTOs

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unit: PurchaseItemUnit;
  unitCost: number;
  currency?: CurrencyType;
}

export interface CreatePurchaseDTO {
  placeId: string;
  placeName?: string;
  items: PurchaseItemInput[];
  currency: CurrencyType;
  bcvRate?: number;
  invoiceUrls?: string[];
  warehouseId?: string;
}

export interface PriceHistoryFilter {
  productId: string;
  limit?: number;
}

export interface PriceHistorySummary {
  productId: string;
  bestPlaceId: string;
  bestPlaceName: string;
  bestCost: number;
  lastCost: number;
  lastPlaceId: string;
  savingPct: number;
}

export interface ProposeItemsDTO {
  station: WarehouseArea;
  items: {
    productId: string;
    quantity: number;
    unit: PurchaseItemUnit;
    reason?: string;
  }[];
}

export interface UpdateListItemDTO {
  adjustedQty?: number;
  purchased?: boolean;
  discarded?: boolean;
}

// Phase 4 - Weekly Reports (Lane B)

export interface WeeklySalesKpi {
  totalUsd: number;
  ordenes: number;
  ticketPromedio: number;
  vsSemanaAnterior: {
    deltaPct: number | null;
  };
}

// Espejo EXACTO del objeto kpis que construye weekly-report.service (backend)
export interface WeeklyProfitabilityKpi {
  topVendidos: Array<{
    productId: string;
    name: string;
    unidades: number;
    ingreso: number;
    costoReceta: number | null;
    margenUsd: number | null;
    margenPct: number | null;
  }>;
  gananciaBrutaTeorica: number;
}

export interface WeeklyFoodCostKpi {
  consumoUsd: number;
  ventasUsd: number;
  foodCostPct: number | null;
}

export interface WeeklyLossesKpi {
  declaradaUsd: number;
  faltanteUsd: number;
  sobranteUsd: number;
  totalUsd: number;
  pctSobreCompras: number | null;
  topInsumos: Array<{ productId: string; name: string; diffUsd: number }>;
}

export interface WeeklyPurchasesKpi {
  totalUsd: number;
  totalCompras: number;
  topVariaciones: Array<{
    productId: string;
    name: string;
    variationPct: number;
    prevCost: number;
    newCost: number;
  }>;
}

export interface WeeklyCoverageKpi {
  ventasConReceta: number;
  ventasTotal: number;
  pct: number;
}

export interface WeeklyKpis {
  ventas: WeeklySalesKpi;
  rentabilidad: WeeklyProfitabilityKpi;
  foodCost: WeeklyFoodCostKpi;
  merma: WeeklyLossesKpi;
  compras: WeeklyPurchasesKpi;
  cobertura: WeeklyCoverageKpi;
}

export interface WeeklyReport {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  kpis: WeeklyKpis;
  aiSummary?: string;
  aiError?: string;
  aiModel?: string;
  generatedAt: Date;
  sentToWhatsapp?: boolean;
  whatsappError?: string;
}

// Catalog Audit

export interface SoldProductAudit {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface RecipeIssueAudit {
  productId: string;
  name: string;
  issues: string[];
}

export interface IncompleteInsumoAudit {
  productId: string;
  name: string;
  missing: ('barcode' | 'foto' | 'costo' | 'contenido')[];
}

export interface LegacyServiceAudit {
  productId: string;
  name: string;
}

export interface CatalogAudit {
  coveragePct: number;
  soldWithoutRecipe: SoldProductAudit[];
  recipesWithIssues: RecipeIssueAudit[];
  insumosIncomplete: IncompleteInsumoAudit[];
  legacyBaseServices: LegacyServiceAudit[];
}

// AI Plan for Shopping Lists

export interface AiPlanItem {
  productId: string;
  productName: string;
  qty: number;
  unit: InventoryBaseUnit;
  lastCost: number;
}

export interface AiPlanGroup {
  placeId: string | null;
  placeName: string;
  items: AiPlanItem[];
  estimatedTotal: number;
  savingsVsWorst: number;
}
