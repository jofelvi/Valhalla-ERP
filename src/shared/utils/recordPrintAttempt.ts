/**
 * Helper central para registrar un intento de impresion:
 *
 * 1. Construye el PrintAttempt que se guarda en el OrderItem
 * 2. Crea un PrintLog permanente en Firestore (audit trail)
 * 3. Determina si los items deben marcarse como "confirmados impresos"
 *    o quedarse en estado anterior
 *
 * Centralizar esta logica evita bugs donde un handler actualiza un campo
 * y otro no.
 */

import { Order } from '@odin6/types';
import { OrderItem, PrintAttempt, PrintAttemptStatus } from '@odin6/types';
import { PrintLog, PrintLogItem } from '@odin6/types';
import { api } from '@/services/api/apiClient';
import { generateAttemptId, sha256Hex } from './printAudit';
import { getDisplayOrderNumber } from './orderNumber';

export interface RecordPrintAttemptInput {
  // Contexto
  order: Pick<
    Order,
    | 'id'
    | 'orderNumber'
    | 'tableId'
    | 'tableName'
    | 'sector'
    | 'waiterId'
    | 'waiterName'
  > & { id: string };
  type: PrintLog['type'];
  userId: string;

  // Items que se intentaron imprimir (con la qty que se envio, no la total)
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    station: 'KITCHEN' | 'BAR' | 'PIZZA' | 'CAJA' | null;
    notes?: string | null;
  }>;

  // Payload original enviado al print service (para hash de integridad)
  requestPayload: unknown;

  // Timing
  requestAt: Date;
  responseAt?: Date | null;

  // Resultado
  status: PrintAttemptStatus;
  httpStatus?: number | null;
  errorMessage?: string | null;
  via?: 'local' | 'queue' | null;
  serviceResponse?: Record<string, unknown> | null;
  printerName?: string | null;
  /** Avisar por correo aunque el estado no sea de error (ej. encolada sin servicio). */
  alert?: boolean;
}

export interface RecordPrintAttemptResult {
  attemptId: string;
  attempt: PrintAttempt;
  log: PrintLog;
}

/**
 * Registra el intento en Firestore (colección `printLogs`) y devuelve
 * el PrintAttempt + log para que el caller lo adjunte a los OrderItem.
 *
 * Fire-and-forget: nunca lanza — si falla el log, igual retorna el attempt
 * para que el caller no se bloquee.
 */
export async function recordPrintAttempt(
  input: RecordPrintAttemptInput,
): Promise<RecordPrintAttemptResult> {
  const attemptId = generateAttemptId();
  const requestAt = input.requestAt;
  const responseAt = input.responseAt ?? new Date();
  const durationMs = responseAt.getTime() - requestAt.getTime();

  // Hash del request para integridad
  let requestHash = '';
  try {
    requestHash = await sha256Hex(input.requestPayload);
  } catch {
    requestHash = 'hash-error';
  }

  // Determinar la station predominante del intento (para el attempt del item)
  // Si hay mix, usar la del primer item
  const station: 'KITCHEN' | 'BAR' | 'PIZZA' | 'CAJA' =
    (input.items[0]?.station as 'KITCHEN' | 'BAR' | 'PIZZA' | 'CAJA') ??
    'KITCHEN';

  // PrintAttempt que se adjunta a cada item
  const attempt: PrintAttempt = {
    at: requestAt.toISOString(),
    qty: input.items.reduce((sum, i) => sum + i.qty, 0),
    station,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    printerName: input.printerName ?? null,
    attemptId,
    userId: input.userId ?? null,
    via: input.via ?? null,
  };

  const items: PrintLogItem[] = input.items.map((i) => ({
    productId: i.productId,
    name: i.name,
    qty: i.qty,
    station: i.station,
    notes: i.notes ?? null,
  }));

  // PrintLog permanente
  const logData: Omit<PrintLog, 'id'> = {
    attemptId,
    orderId: input.order.id,
    orderNumber: getDisplayOrderNumber(input.order),
    type: input.type,
    items,
    itemsCount: items.length,
    waiterId: input.order.waiterId ?? null,
    waiterName: input.order.waiterName ?? null,
    tableId: input.order.tableId ?? null,
    tableName: input.order.tableName ?? null,
    sector: input.order.sector ?? null,
    userId: input.userId,
    status: input.status,
    httpStatus: input.httpStatus ?? null,
    errorMessage: input.errorMessage ?? null,
    via: input.via ?? null,
    serviceResponse: input.serviceResponse ?? null,
    requestHash,
    requestAt,
    responseAt,
    durationMs,
    createdAt: new Date(),
  };

  // Persistir (fire-and-forget)
  let log: PrintLog;
  try {
    log = await api.post<PrintLog>('/api/print-logs', logData);
  } catch (err) {
    console.error('[recordPrintAttempt] Error al guardar printLog:', err);
    // Si falla el log, igual retornamos datos locales (no bloqueamos al caller)
    log = { id: attemptId, ...logData };
  }

  // Disparar alerta por email si el status es de error real
  // (no para 'success', 'skipped' o 'queued')
  if (isErrorStatus(input.status) || input.alert) {
    void fireAlertEmail({
      attemptId,
      orderId: input.order.id,
      orderNumber: getDisplayOrderNumber(input.order),
      status: input.status,
      errorMessage: input.errorMessage ?? undefined,
      printerName: input.printerName ?? undefined,
      station,
      waiterName: input.order.waiterName ?? undefined,
      tableName: input.order.tableName ?? undefined,
      sector: input.order.sector ?? undefined,
      items: input.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        station: i.station ?? undefined,
      })),
      via: input.via ?? null,
    });
  }

  return { attemptId, attempt, log };
}

function isErrorStatus(status: PrintAttemptStatus): boolean {
  return (
    status === 'service_down' ||
    status === 'network_error' ||
    status === 'http_500' ||
    status === 'printer_offline' ||
    status === 'printer_paper_out' ||
    status === 'printer_error' ||
    status === 'exception'
  );
}

interface AlertEmailPayload {
  attemptId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  errorMessage?: string;
  printerName?: string;
  station?: string;
  waiterName?: string;
  tableName?: string;
  sector?: string;
  items: Array<{ name: string; qty: number; station?: string }>;
  via?: 'local' | 'queue' | null;
}

/**
 * Dispara la alerta por email de manera fire-and-forget.
 * Nunca bloquea ni propaga errores al caller.
 */
async function fireAlertEmail(payload: AlertEmailPayload): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/alerts/print-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('[fireAlertEmail] Endpoint respondio error:', res.status);
    }
  } catch (err) {
    // Fire-and-forget: nunca propagamos
    console.warn(
      '[fireAlertEmail] Error al enviar alerta (no bloqueante):',
      err,
    );
  }
}

/**
 * Aplica un PrintAttempt a una lista de OrderItems:
 *
 * - sentQty sube SOLO si status es 'success' o 'queued' (se va a imprimir)
 * - Si fallo, sentQty no sube → el item queda pendiente y se reintentara
 * - printedQty/printedAt SOLO suben si status es 'success'
 * - Agrega el attempt al array printAttempts (ultimos 20)
 */
export function applyPrintAttemptToItems(
  items: OrderItem[],
  attempt: PrintAttempt,
  newItems: Array<{ productId: string; qty: number }>,
): OrderItem[] {
  const byId = new Map(newItems.map((i) => [i.productId, i.qty]));
  const willBePrinted =
    attempt.status === 'success' || attempt.status === 'queued';

  return items.map((item) => {
    const qtyAttempted = byId.get(item.productId);
    if (qtyAttempted === undefined || qtyAttempted <= 0) {
      return item;
    }

    const prevSent = item.sentQty ?? 0;
    const prevPrinted = item.printedQty ?? 0;
    const newTotalSent = prevSent + qtyAttempted;

    return {
      ...item,
      sentQty: willBePrinted ? Math.min(newTotalSent, item.quantity) : prevSent,
      printedQty:
        attempt.status === 'success'
          ? Math.min(prevPrinted + qtyAttempted, item.quantity)
          : prevPrinted,
      printedAt: attempt.status === 'success' ? attempt.at : item.printedAt,
      printAttempts: [...(item.printAttempts ?? []), attempt].slice(-20),
    };
  });
}
