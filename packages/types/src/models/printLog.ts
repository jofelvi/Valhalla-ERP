import { PrintAttemptStatus } from './orderItem';

/**
 * Audit trail permanente de cada intento de impresion.
 *
 * Se guarda en la coleccion `printLogs` de Firestore (no se limpia nunca).
 * Sirve como prueba irrefutable de que una impresion:
 * - Fue solicitada (requestAt + requestHash)
 * - Recibio respuesta del print service (responseAt + serviceResponse)
 * - Fue exitosa, fallo, o quedo encolada
 *
 * El `requestHash` es un SHA256 del payload original — si cambia indica tampering.
 */
export interface PrintLog {
  id: string;
  attemptId: string; // UUID unico del intento (correlaciona con PrintAttempt en OrderItem)

  // Referencia a la orden
  orderId: string;
  orderNumber: string; // ultimos 8 chars en mayuscula

  // Tipo de impresion
  type: 'comanda' | 'precuenta' | 'receipt' | 'reprint';

  // Items que se intentaron imprimir
  items: PrintLogItem[];
  itemsCount: number; // para queries

  // Contexto
  waiterId?: string | null;
  waiterName?: string | null;
  tableId?: string | null;
  tableName?: string | null;
  sector?: string | null;
  userId: string; // quien inicio el intento (cajero/mesonero)

  // Resultado
  status: PrintAttemptStatus;
  httpStatus?: number | null;
  errorMessage?: string | null;
  via?: 'local' | 'queue' | null;

  // Respuesta completa del print service (para debugging)
  serviceResponse?: Record<string, unknown> | null;

  // Integridad
  requestHash: string; // SHA256 del payload enviado (hex)

  // Timing
  requestAt: Date; // cuando se inicio el fetch
  responseAt?: Date | null; // cuando llego la respuesta (null si timeout)
  durationMs?: number | null;

  // Metadata
  createdAt: Date;
}

export interface PrintLogItem {
  productId: string;
  name: string;
  qty: number; // cantidad que se envio (no la total del item)
  station: 'KITCHEN' | 'BAR' | 'PIZZA' | 'CAJA' | null;
  notes?: string | null;
}
