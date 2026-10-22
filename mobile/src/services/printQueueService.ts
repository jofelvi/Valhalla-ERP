import { api } from './api/apiClient';
import { Order, OrderItem, PaymentMethodEnum } from '../types';
import { fichaService } from './fichaService';
import { packUnitPrice, printQty } from './packPricing';
import { configActual } from '../config/configStore';
import { pctTexto } from '../config/totalesDeOrden';
import { nombreVisible } from '../shared/contrato';

interface PrintPayload {
  businessName: string;
  businessSubtitle?: string;
  address: string;
  phone: string;
  rif: string;
  orderNumber: string;
  date: string;
  time: string;
  table?: string;
  orderType?: string;
  items: { quantity: number; name: string; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  taxLabel?: string;
  total: number;
  currency?: string;
  payments: { method: string; methodLabel: string; amount: number }[];
  qrData?: string;
  footerMessage?: string;
  footerBrand?: string;
}

interface ComandaPayload {
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
    customizations?: {
      removedIngredients?: string[];
    };
  }[];
  comment?: string;
  cajaSummary?: boolean;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  CARD: 'Tarjeta Debito/Credito',
  TRANSFER: 'Transferencia Bancaria',
  PAGO_MOVIL: 'Pago Movil',
  MIXED: 'Pago Mixto',
  PENDING: 'Pago Pendiente',
};

/**
 * Datos del negocio para la cabecera de los tickets. Salen de la configuración (`negocio`,
 * `marca`, `tarifas`, `vocabulario`), nunca de este archivo.
 */
function datosDelNegocio() {
  const { negocio, marca, tarifas, vocabulario } = configActual();
  return {
    negocio,
    nombre: nombreVisible(marca, negocio),
    tarifas,
    vocab: vocabulario,
  };
}

/** Nombre de zona para mostrar: el código del sector con la primera letra en mayúscula. */
const etiquetaZona = (sector: string): string =>
  sector.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function formatNow() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('es-VE'),
    time: now.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

// Hora en que se PIDIO el item (addedAt). Si el item no la trae (se esta
// agregando en este momento), usa la hora actual. Va en las notas del ticket
// para que cocina/barra distinga un pedido nuevo de una reimpresion vieja.
function orderedTimeLabel(addedAt?: string | null): string {
  const d = addedAt ? new Date(addedAt) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return safe.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function withOrderedTime(
  notes: string | null | undefined,
  addedAt?: string | null,
): string {
  const label = `pedido ${orderedTimeLabel(addedAt)}`;
  return notes ? `${notes} · ${label}` : label;
}

export const printQueueService = {
  async enqueuePrintPrecuenta(
    order: Order,
    options?: { bcvRate?: number; waiterName?: string },
  ): Promise<void> {
    const { date, time } = formatNow();
    const { nombre, tarifas } = datosDelNegocio();
    const bcvRate = options?.bcvRate ?? 0;
    const totalBs = bcvRate > 0 ? order.total * bcvRate : 0;

    const payload = {
      businessName: nombre,
      orderNumber: order.id.slice(-8).toUpperCase(),
      date,
      time,
      table: order.tableName ?? undefined,
      waiter: options?.waiterName ?? undefined,
      items: order.items.map((item) => ({
        // Un tobo se guarda como 12 unidades: sin esto el recibo del cliente
        // dice "12x Tobo de Cerveza" a $0.92 cada uno.
        quantity: printQty(item.quantity, item.productId, item.presentationQty),
        name: item.productName,
        unitPrice: packUnitPrice(
          item.unitPrice,
          item.productId,
          item.presentationQty,
        ),
        total: item.totalPrice,
      })),
      subtotal: order.subtotal,
      serviceCharge: order.serviceCharge ?? 0,
      total: order.total,
      currency: tarifas.baseCurrency,
      bcvRate: bcvRate > 0 ? bcvRate : undefined,
      totalBs: totalBs > 0 ? totalBs : undefined,
    };

    await api.post('/api/print-queue', { type: 'precuenta', payload });
  },

  async enqueuePrintReceipt(
    order: Order,
    payments: { method: PaymentMethodEnum; amount: number }[],
  ): Promise<void> {
    const { date, time } = formatNow();
    const { negocio, nombre, tarifas, vocab } = datosDelNegocio();
    const mp = negocio.mobilePayment;

    const payload: PrintPayload = {
      businessName: nombre,
      businessSubtitle: negocio.tagline || undefined,
      address: negocio.address,
      phone: negocio.phone,
      rif: negocio.taxId,
      orderNumber: order.id.slice(-8).toUpperCase(),
      date,
      time,
      table: order.tableName ?? undefined,
      orderType: order.tableId
        ? `En ${vocab.table.toLowerCase()}`
        : order.sector
          ? vocab.zone
          : 'Para llevar',
      items: order.items.map((item) => ({
        // Un tobo se guarda como 12 unidades: sin esto el recibo del cliente
        // dice "12x Tobo de Cerveza" a $0.92 cada uno.
        quantity: printQty(item.quantity, item.productId, item.presentationQty),
        name: item.productName,
        unitPrice: packUnitPrice(
          item.unitPrice,
          item.productId,
          item.presentationQty,
        ),
        total: item.totalPrice,
      })),
      subtotal: order.subtotal,
      tax: order.tax ?? 0,
      taxLabel: `${tarifas.tax.label} (${pctTexto(tarifas.tax.rate)}%)`,
      total: order.total,
      currency: tarifas.baseCurrency,
      payments: payments.map((p) => ({
        method: p.method,
        methodLabel: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
        amount: p.amount,
      })),
      // QR de pago móvil solo si el negocio lo configuró (banco|teléfono|documento|nombre).
      qrData: mp
        ? `${mp.bank}|${mp.phone}|${mp.documentId}|${nombre}`
        : undefined,
      footerMessage: negocio.receiptFooter,
      footerBrand: nombre,
    };

    await api.post('/api/print-queue', { type: 'receipt', payload });
  },

  async enqueuePrintComanda(
    order: {
      id: string;
      tableId?: string | null;
      tableName?: string | null;
      sector?: string | null;
      orderType?: string | null;
      notes?: string | null;
    },
    items: OrderItem[],
    options?: {
      waiterName?: string | null;
      cajaSummary?: boolean;
    },
  ): Promise<void> {
    const { date, time } = formatNow();
    const itemsToSend = items.filter((item) => item.quantity > 0);

    if (itemsToSend.length === 0) return;

    const { vocab } = datosDelNegocio();
    let displayType = order.tableId
      ? `En ${vocab.table.toLowerCase()}`
      : 'Para llevar';
    if (order.orderType === 'takeaway') {
      displayType = 'PARA LLEVAR';
    }
    if (order.sector) {
      const zoneName = etiquetaZona(order.sector);
      displayType =
        order.orderType === 'takeaway'
          ? `PARA LLEVAR - ${vocab.zone}: ${zoneName}`
          : `${vocab.zone}: ${zoneName}`;
    }

    const payload: ComandaPayload = {
      orderNumber: order.id.slice(-8).toUpperCase(),
      date,
      time,
      table: order.tableName ?? undefined,
      waiter: options?.waiterName ?? undefined,
      orderType: displayType,
      items: itemsToSend.flatMap((item) => {
        // printQty solo agrupa los productos-pack (Tobo/Caja) por packs; las
        // cervezas sueltas (producto individual) se imprimen por unidad.
        const qty = printQty(
          item.quantity,
          item.productId,
          item.presentationQty,
        );
        const built = {
          name: item.productName,
          notes: withOrderedTime(
            item.notes,
            (item as OrderItem & { addedAt?: string }).addedAt,
          ),
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
      cajaSummary: options?.cajaSummary ?? false,
    };

    await api.post('/api/print-queue', { type: 'comanda', payload });
  },
};

// ── Rondas de tobos / pack products ──

export interface RondaRequest {
  orderNumber: string;
  tableName?: string;
  productName: string;
  rondaNum: number; // número de ronda completada (1, 2, 3…)
  unitsThisRound: number; // unidades servidas en esta ronda (ej: 4)
  totalDelivered: number; // total acumulado incluyendo esta ronda (ej: 8)
  totalUnits: number; // total del pack (ej: 12)
  bartenderName?: string;
  time: string; // hora de entrega "HH:MM"
}

export async function enqueuePrintRonda(data: RondaRequest): Promise<void> {
  await api.post('/api/print-queue', {
    type: 'ronda',
    station: 'BAR',
    tableName: data.tableName,
    orderNumber: data.orderNumber,
    payload: data,
  });
}

// ── Ficha de barra (QR + saldo) ──

// Encola la impresion de la ficha de barra. Obtiene el token + saldo del
// backend (el secreto vive alli) y arma el payload para el print-service.
// Fire-and-forget en el caller: un fallo de impresion no debe bloquear la comanda.
export async function enqueuePrintFicha(
  orderId: string,
  opts?: { waiterName?: string | null },
): Promise<void> {
  const ficha = await fichaService.getByOrderId(orderId);
  if (!ficha.items.length) return; // sin items de barra, no hay ficha

  const now = new Date();
  const payload = {
    orderNumber: ficha.orderNumber,
    date: now.toLocaleDateString('es-VE'),
    time: now.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    table: ficha.tableName ?? ficha.sector ?? undefined,
    waiter: opts?.waiterName ?? undefined,
    qrData: ficha.fichaToken,
    items: ficha.items.map((it) => ({
      productName: it.productName,
      pendingQty: it.pendingQty,
      // Tobos mixtos: desglose por variante para el recibo de saldo.
      variants: (it.composition ?? []).map((v) => ({
        name: v.variantName,
        pendingQty: v.pendingQty,
      })),
    })),
    totalPending: ficha.items.reduce((s, it) => s + it.pendingQty, 0),
  };

  await api.post('/api/print-queue', { type: 'ficha', payload });
}
