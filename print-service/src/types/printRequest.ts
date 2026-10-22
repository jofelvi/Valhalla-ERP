export interface PrintItem {
  quantity: number;
  name: string;
  unitPrice: number;
  total: number;
}

export type ComandaStation = 'KITCHEN' | 'BAR' | 'PIZZA';

export interface ComandaTanda {
  quantity: number;
  time: string;
}

export interface ComandaItem {
  quantity: number;
  name: string;
  notes?: string;
  station?: ComandaStation | null;
  /** Hora en que se pidio (HH:MM). */
  time?: string;
  /** Cuando el mismo producto se pidio en varios momentos. */
  tandas?: ComandaTanda[];
  customizations?: {
    removedIngredients?: string[];
  };
}

export interface ComandaRequest {
  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  waiter?: string;
  orderType: string;
  items: ComandaItem[];
  comment?: string;
  /** Token de la ficha. Si viene, el QR de entrega va en la misma comanda. */
  qrData?: string;
  cajaSummary?: boolean;
  isCopy?: boolean;
}

export interface PrintPayment {
  method: string;
  methodLabel: string;
  amount: number;
}

/**
 * Modo del impuesto. 'added': se suma al total (va antes del TOTAL).
 * 'included': ya viene dentro del precio; la línea se imprime como desglose
 * después del TOTAL y no cambia la suma.
 */
export type TaxMode = 'added' | 'included';

/**
 * Datos de Pago Móvil para el cliente. Si no se mandan, el ticket no imprime
 * el bloque: el servicio no tiene datos bancarios propios.
 */
export interface PagoMovilDatos {
  banco?: string;
  telefono?: string;
  documento?: string;
}

export interface PrintRequest {
  businessName: string;
  businessSubtitle?: string;
  address?: string;
  phone?: string;
  rif?: string;

  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  orderType?: string;

  items: PrintItem[];

  subtotal: number;
  /** Monto del servicio. Sin serviceLabel no se imprime la línea. */
  serviceCharge?: number;
  /** Etiqueta del servicio, p. ej. "Servicio (10%)" o "Servicio incluido". */
  serviceLabel?: string;
  // Descuentos con PIN admin, ya restados del total que se cobra.
  discount?: number;
  tip?: number;
  tax: number;
  /** Etiqueta del impuesto, p. ej. "IVA (16%)". Sin ella no se imprime la línea. */
  taxLabel?: string;
  taxMode?: TaxMode;
  total: number;
  currency?: string;
  bcvRate?: number;
  totalBs?: number;

  payments: PrintPayment[];

  qrData?: string;
  pagoMovil?: PagoMovilDatos;

  customerName?: string;
  customerRif?: string;

  footerMessage?: string;
  footerBrand?: string;
}

export interface RondaRequest {
  /** Nombre del negocio para el encabezado del ticket. Opcional. */
  businessName?: string;
  orderNumber: string;
  tableName?: string;
  productName: string;
  rondaNum: number; // número de ronda (1, 2, 3…)
  unitsThisRound: number; // cervezas en esta ronda (ej: 4)
  totalDelivered: number; // acumulado (ej: 8)
  totalUnits: number; // total del pack (ej: 12)
  bartenderName?: string;
  time: string; // "HH:MM"
}

export interface PrecuentaRequest {
  businessName?: string;
  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  waiter?: string;
  items: PrintItem[];
  subtotal: number;
  serviceCharge?: number;
  serviceLabel?: string;
  // Descuentos con PIN admin, ya restados del total que se cobra.
  discount?: number;
  total: number;
  currency?: string;
  bcvRate?: number;
  totalBs?: number;
}

export interface FichaVariant {
  name: string;
  pendingQty: number;
}

export interface FichaItem {
  productName: string;
  pendingQty: number;
  // Tobos mixtos: desglose por variante (Light/Pilsen/Azul).
  variants?: FichaVariant[];
}

export interface FichaRequest {
  /** Nombre del negocio para el encabezado de la ficha. Opcional. */
  businessName?: string;
  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  waiter?: string;
  qrData: string; // el token AR1.<orderId>.<nonce>.<sig>
  items: FichaItem[]; // saldo pendiente por item de barra
  totalPending: number;
  // A que impresora de estacion va la ficha (con su QR). El QR NUNCA sale por
  // caja. Si no viene, default = BARRA (la ficha de barra es lo comun).
  station?: ComandaStation;
}
