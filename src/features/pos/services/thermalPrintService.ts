import { Order } from '@/modelTypes/order';
import { OrderItem } from '@/modelTypes/orderItem';
import { Payment } from '@/modelTypes/payment';
import { PaymentMethodEnum } from '@/shared';
import { api } from '@/services/api/apiClient';
import {
  NEGOCIO_DEFAULT,
  TARIFAS_DEFAULT,
  type NegocioConfig,
  type TarifasConfig,
} from '@odin6/types';
import {
  etiquetaImpuesto,
  etiquetaServicio,
} from '@/features/pos/utils/etiquetasDeCobro';
import {
  payloadPagoMovil,
  titularPagoMovil,
} from '@/features/pos/utils/pagoMovil';

const PRINT_SERVICE_URL = 'http://127.0.0.1:6441';
const PRINT_TIMEOUT = 8000;

/**
 * Datos del negocio que salen en el ticket. Los pasa la pantalla desde la configuración
 * (`useDatosDeImpresion`). Sin ellos, el ticket sale con los valores neutros.
 */
export interface DatosDeImpresion {
  nombre: string;
  negocio: NegocioConfig;
  tarifas: TarifasConfig;
}

const DATOS_NEUTROS: DatosDeImpresion = {
  nombre: 'Punto de venta',
  negocio: NEGOCIO_DEFAULT,
  tarifas: TARIFAS_DEFAULT,
};

type PrintJobType = 'receipt' | 'comanda' | 'precuenta';

/** Enqueues a print job via NestJS API */
async function enqueuePrintJob(
  type: PrintJobType,
  payload: Record<string, unknown>,
): Promise<void> {
  await api.post('/api/print-queue', {
    type,
    payload,
  });
}

/** Attempts local HTTP print service, falls back to NestJS API queue if unavailable */
async function printWithFallback(
  endpoint: string,
  type: PrintJobType,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; error?: string; via?: 'local' | 'queue' }> {
  // Intentar HTTP local primero
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRINT_TIMEOUT);

    const response = await fetch(`${PRINT_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { success: true, via: 'local' };
    }

    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    // Si el servicio respondió pero con error, no intentar API queue
    return {
      success: false,
      error: errorData.error || `HTTP ${response.status}`,
    };
  } catch {
    // HTTP local no disponible → encolar en NestJS API
    try {
      await enqueuePrintJob(type, payload);
      return { success: true, via: 'queue' };
    } catch (queueError) {
      const message =
        queueError instanceof Error ? queueError.message : 'Error desconocido';
      return {
        success: false,
        error: `Impresión local no disponible y error al encolar: ${message}`,
      };
    }
  }
}

interface PrintRequest {
  businessName: string;
  businessSubtitle?: string;
  address: string;
  phone: string;
  rif?: string;
  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  orderType?: string;
  items: {
    quantity: number;
    name: string;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  // Descuentos autorizados con PIN admin, ya restados del total.
  discount?: number;
  serviceCharge?: number;
  /** Etiqueta del servicio según el modo ("Servicio (10%)"). */
  serviceLabel?: string;
  tip?: number;
  tax: number;
  taxLabel?: string;
  total: number;
  currency?: string;
  bcvRate?: number;
  totalBs?: number;
  payments: {
    method: string;
    methodLabel: string;
    amount: number;
  }[];
  qrData?: string;
  customerName?: string;
  customerRif?: string;
  footerMessage?: string;
  footerBrand?: string;
}

const paymentMethodLabels: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
  [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
  [PaymentMethodEnum.CARD]: 'Tarjeta Debito/Credito',
  [PaymentMethodEnum.TRANSFER]: 'Transferencia Bancaria',
  [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Movil',
  [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Movil Manual',
  [PaymentMethodEnum.MIXED]: 'Pago Mixto',
  [PaymentMethodEnum.PENDING]: 'Pago Pendiente',
  [PaymentMethodEnum.PAYROLL_DEDUCTION]: 'Deducción nómina',
};

/**
 * Disponibilidad del servicio de impresion. Intenta:
 * 1. Print service local (127.0.0.1:6441) — imprime directo si corremos en
 *    la misma PC que tiene la impresora.
 * 2. Fallback: consulta GET /api/print-queue/service-status del backend. Si
 *    hay al menos un print-service conectado al gateway, podemos encolar y
 *    ese servicio consumira el job via WebSocket/polling.
 * Retorna true si CUALQUIERA de los dos esta disponible.
 */
export async function checkPrintService(): Promise<boolean> {
  // 1. Intento local
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${PRINT_SERVICE_URL}/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) return true;
  } catch {
    // cae al fallback
  }

  // 2. Fallback: print service remoto conectado al backend via WS
  return (await isRemotePrintServiceConnected()) === true;
}

/**
 * Si hay un print-service conectado al servidor (el de la PC de caja, que
 * saca lo que se encola). `null` si no se pudo preguntar.
 */
export async function isRemotePrintServiceConnected(): Promise<boolean | null> {
  try {
    const remote = await api.get<{ connected: boolean }>(
      '/api/print-queue/service-status',
    );
    return remote?.connected === true;
  } catch {
    return null;
  }
}

export function buildPrintPayload(
  order: Order,
  payments: Payment[],
  options?: {
    bcvRate?: number;
    tipAmount?: number;
    customerName?: string;
    customerRif?: string;
    datos?: DatosDeImpresion;
  },
): PrintRequest {
  const now = new Date();
  const bcvRate = options?.bcvRate || 0;
  const tipAmount = options?.tipAmount || order.tipAmount || 0;
  const totalWithTip = order.total + tipAmount;
  const totalBs = bcvRate > 0 ? totalWithTip * bcvRate : 0;
  const { nombre, negocio, tarifas } = options?.datos ?? DATOS_NEUTROS;
  const pm = negocio.mobilePayment;

  return {
    businessName: nombre,
    businessSubtitle: negocio.tagline || undefined,
    address: negocio.address,
    phone: negocio.phone,
    rif: negocio.taxId || undefined,

    orderNumber: order.id.slice(-8).toUpperCase(),
    date: now.toLocaleDateString('es-VE'),
    time: now.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    table: order.tableName || order.tableId || undefined,
    orderType:
      order.orderType === 'dine-in'
        ? 'En mesa'
        : order.orderType === 'takeaway'
          ? 'Para llevar'
          : undefined,

    items: order.items.map((item) => ({
      quantity: item.quantity,
      name: item.name,
      unitPrice: item.unitPrice,
      total: item.total,
    })),

    subtotal: order.subtotal,
    discount:
      (order.discountAmount ?? 0) > 0 ? order.discountAmount : undefined,
    serviceCharge: order.serviceCharge > 0 ? order.serviceCharge : undefined,
    serviceLabel:
      order.serviceCharge > 0
        ? (etiquetaServicio(tarifas) ?? undefined)
        : undefined,
    tip: tipAmount > 0 ? tipAmount : undefined,
    tax: order.tax,
    taxLabel: etiquetaImpuesto(tarifas) ?? undefined,
    total: totalWithTip,
    currency: tarifas.baseCurrency,
    bcvRate: bcvRate > 0 ? bcvRate : undefined,
    totalBs: totalBs > 0 ? totalBs : undefined,

    payments: payments.map((p) => ({
      method: p.method,
      methodLabel: paymentMethodLabels[p.method] || p.method,
      amount: p.amount,
    })),

    qrData: pm ? payloadPagoMovil(pm, titularPagoMovil(negocio)) : undefined,
    customerName: options?.customerName ?? order.customerName ?? undefined,
    customerRif: options?.customerRif ?? undefined,
    footerMessage: negocio.receiptFooter,
    footerBrand: `${nombre} POS`,
  };
}

interface ComandaRequest {
  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  waiter?: string;
  orderType: string;
  items: {
    quantity: number;
    name: string;
    notes?: string;
    station?: 'KITCHEN' | 'BAR' | 'PIZZA' | null;
  }[];
  comment?: string;
  cajaSummary?: boolean;
  isCopy?: boolean;
}

interface PrintComandaOptions {
  tableId?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  cajaSummary?: boolean;
  isCopy?: boolean;
}

// Hora en que se PIDIO el item (addedAt; fallback: ahora). Va en las notas del
// ticket para que cocina/barra distinga un pedido nuevo de una reimpresion.
const withOrderedTime = (
  notes: string | null | undefined,
  addedAt: string | null | undefined,
): string => {
  const d = addedAt ? new Date(addedAt) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const label = `pedido ${safe.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
  return notes ? `${notes} · ${label}` : label;
};

export async function printComanda(
  order: Order,
  newItems: OrderItem[],
  options: PrintComandaOptions = {},
): Promise<{ success: boolean; error?: string; via?: 'local' | 'queue' }> {
  const { tableId, tableName, waiterName, cajaSummary, isCopy } = options;
  const now = new Date();

  let displayOrderType = 'En mesa';
  if (order.orderType === 'takeaway') {
    displayOrderType = 'PARA LLEVAR';
  } else if (order.sector) {
    // El código de zona se muestra tal cual, con la primera letra en mayúscula.
    const zoneName = order.sector.replace(/_/g, ' ');
    displayOrderType = `Zona: ${zoneName.charAt(0).toUpperCase()}${zoneName.slice(1)}`;
  } else if (!tableId && !order.tableId) {
    displayOrderType = 'PARA LLEVAR';
  }

  const payload: ComandaRequest = {
    orderNumber: order.id.slice(-8).toUpperCase(),
    date: now.toLocaleDateString('es-VE'),
    time: now.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    table: tableName ?? order.tableName ?? (tableId ? tableId : undefined),
    waiter: waiterName ?? undefined,
    orderType: displayOrderType,
    items: newItems.flatMap((item) => {
      const qty = isCopy ? item.quantity : item.quantity - (item.sentQty ?? 0);
      const built = {
        name: item.name,
        notes: withOrderedTime(item.notes, item.addedAt),
        station: item.station ?? undefined,
        customizations: item.customizations
          ? { removedIngredients: item.customizations.removedIngredients }
          : undefined,
      };
      // Ítem con comentario propio y NO pack: se imprime de a 1 unidad por
      // línea para que el comentario de cada una quede claro en la comanda.
      const hasComment = !!(item.notes && item.notes.trim());
      const isPack = !!(item.presentationQty && item.presentationQty > 0);
      if (hasComment && !isPack && qty > 1) {
        return Array.from({ length: qty }, () => ({ quantity: 1, ...built }));
      }
      return [{ quantity: qty, ...built }];
    }),
    comment: order.notes ?? undefined,
    cajaSummary: cajaSummary ?? false,
    isCopy: isCopy ?? false,
  };

  return printWithFallback(
    '/print-comanda',
    'comanda',
    payload as unknown as Record<string, unknown>,
  );
}

interface PrecuentaOptions {
  tableName?: string | null;
  waiterName?: string | null;
  bcvRate?: number;
  datos?: DatosDeImpresion;
}

export async function printPrecuenta(
  order: Order,
  options: PrecuentaOptions = {},
): Promise<{ success: boolean; error?: string; via?: 'local' | 'queue' }> {
  const now = new Date();
  const bcvRate = options.bcvRate || 0;
  const totalBs = bcvRate > 0 ? order.total * bcvRate : 0;
  const { nombre, tarifas } = options.datos ?? DATOS_NEUTROS;
  const payload = {
    businessName: nombre,
    orderNumber: order.id.slice(-8).toUpperCase(),
    date: now.toLocaleDateString('es-VE'),
    time: now.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    table: options.tableName ?? order.tableName ?? order.tableId ?? undefined,
    waiter: options.waiterName ?? undefined,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      name: item.name,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    subtotal: order.subtotal,
    serviceCharge: order.serviceCharge || 0,
    serviceLabel: etiquetaServicio(tarifas) ?? undefined,
    total: order.total,
    currency: tarifas.baseCurrency,
    bcvRate: bcvRate > 0 ? bcvRate : undefined,
    totalBs: totalBs > 0 ? totalBs : undefined,
  };

  return printWithFallback(
    '/print-precuenta',
    'precuenta',
    payload as unknown as Record<string, unknown>,
  );
}

export async function printThermalReceipt(
  order: Order,
  payments: Payment[],
  options?: {
    bcvRate?: number;
    tipAmount?: number;
    customerName?: string;
    customerRif?: string;
    datos?: DatosDeImpresion;
  },
): Promise<{ success: boolean; error?: string; via?: 'local' | 'queue' }> {
  const payload = buildPrintPayload(order, payments, options);
  return printWithFallback(
    '/print',
    'receipt',
    payload as unknown as Record<string, unknown>,
  );
}
