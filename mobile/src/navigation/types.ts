import type { InsumoProduct } from '../services/inventoryService';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  RegisterStep1: undefined;
  RegisterStep2: {
    isMember: boolean;
    associateNumber?: string;
  };
  RegisterStep3: {
    isMember: boolean;
    associateNumber?: string;
    incomeRange?: string;
  };
  RegisterStep4: {
    isMember: boolean;
    associateNumber?: string;
    incomeRange?: string;
  };
  RegisterStep5: {
    isMember: boolean;
    hasCredit: boolean;
  };

  // Main tabs
  MainTabs: undefined;

  // Stack screens
  Products: {
    categoryId: string;
    categoryName: string;
  };
  // Gestión de productos (admin/manager)
  ProductsAdmin: undefined;
  ProductEdit: { productId?: string };
  OrderDetail: {
    orderId: string;
  };
  Chat: {
    orderId: string;
  };
  // Mesa Conectada
  ScanTable: undefined;
  MyTable: {
    orderId: string;
  };
  TableConnect: {
    orderId: string;
  };
  VerifyEmail: undefined;

  // Waiter stack screens
  WaiterTabs: undefined;
  WaiterCreateOrder: {
    tableId?: string;
    tableName?: string;
    sector?: string;
    orderId?: string;
    existingItems?: string;
  };
  WaiterPayment: {
    orderId: string;
    tableId?: string;
    /** Pedido recien creado en este flujo: salir sin cobrar lo descarta. */
    nuevoPedido?: boolean;
  };
  WaiterCommissions: undefined;
  WaiterCommissionDetail: {
    pagoId: string;
  };
  WaiterSaleDetail: {
    orderId: string;
  };

  // Admin stack screens
  AdminTabs: undefined;

  // Cashier stack screens
  CashierTabs: undefined;
  CashierCreateOrder: {
    tableId?: string;
    tableName?: string;
    sector?: string;
  };
  CashierPayment: {
    orderId: string;
    tableId?: string;
    /** Pedido recien creado en este flujo: salir sin cobrar lo descarta. */
    nuevoPedido?: boolean;
  };
  CashierClose: {
    sessionId: string;
  };
  CashierHistory: undefined;

  // Kitchen / Bar / Pizza (pantalla unica sin tabs)
  Kitchen: undefined;
  KitchenInventory: undefined;
  Bar: undefined;
  Pizza: undefined;
  Dispatch: undefined;
  // Cocina/barra/pizza tambien fichan entrada y salida
  StationAttendance: undefined;

  // Inventory screens (Fase 2)
  InventoryHub: undefined;
  // La estacion declara lo que elaboro / propone un insumo nuevo
  StationProduction: undefined;
  StationNewInsumo: undefined;
  InsumoRequestsAdmin: undefined;
  InventoryStock: {
    warehouseId: string;
    warehouseName: string;
  };
  InventoryTransfer: {
    warehouseId: string;
    warehouseName: string;
  };
  InventoryCount: {
    warehouseId: string;
    warehouseName: string;
  };
  InventoryWaste: {
    warehouseId: string;
    warehouseName: string;
  };

  // Purchases screens (Fase 3)
  PurchasesList: undefined;
  RegisterPurchase: {
    ocrItems?: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitCost: number;
      /** Renglon crudo de la factura, para aprender el alias del proveedor. */
      invoiceText?: string;
      /** Unidades por bulto leidas de la descripcion ("222Mlx36UN" -> 36). */
      unitsPerPack?: number;
    }>;
    createdInsumo?: InsumoProduct;
  };
  OcrConfirm: {
    lines?: Array<{
      text: string;
      qty: number;
      unitCost: number;
      matchedProductId?: string;
      matchedProductName?: string;
      score: number;
      unitsPerPack?: number | null;
      source?: 'alias' | 'catalogo' | null;
      invoiceUnit?: 'CAJA' | 'BULTO' | 'UNIDAD' | null;
    }>;
    createdInsumo?: InsumoProduct;
  };
  CreateInsumo: {
    prefillName?: string;
    prefillBarcode?: string;
    origin: 'RegisterPurchase' | 'OcrConfirm';
  };
  ShoppingList: {
    warehouseArea?: 'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA';
  };
  Places: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type WaiterTabParamList = {
  Tables: undefined;
  Zones: undefined;
  WaiterMenu: undefined;
  WaiterOrders: undefined;
  WaiterSales: undefined;
  WaiterAttendance: undefined;
  Profile: undefined;
};

export type CashierTabParamList = {
  CashierOrders: undefined;
  Tables: undefined;
  Zones: undefined;
  CashierAttendance: undefined;
  Profile: undefined;
};

export type AdminTabParamList = {
  AdminPanel: undefined;
  Salon: { initialTab?: 'Mesas' | 'Zonas' | 'Pedidos' };
  CashierOrders: undefined;
  Almacen: { initialTab?: 'Compras' | 'Inventario' | 'Recetas' };
  Profile: undefined;
};
