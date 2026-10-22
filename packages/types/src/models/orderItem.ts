export interface OrderItem {
  _id?: string; // _id de Mongo para acciones por item
  productId: string;
  name: string; // Duplicado para historial
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  customizations?: ProductCustomization | null;
  sentQty?: number; // Cantidad "marcada" como enviada a cocina (puede mentir si fallo impresion)
  printedQty?: number; // Cantidad CONFIRMADA impresa (audit trail irrefutable)
  printedAt?: string; // ISO timestamp de la ultima impresion exitosa
  deliveredQty?: number; // Cantidad físicamente entregada en mesa
  cancelledAt?: string | null; // ISO timestamp de cuando se anuló el item
  station?: 'KITCHEN' | 'BAR' | 'PIZZA' | null; // Estación de preparación
  addedAt?: string; // ISO timestamp de cuando se agrego el item
  addedBy?: string; // userId de quien agrego el item
  quantityLog?: { qty: number; at: string }[]; // Historial de cambios de cantidad
  printAttempts?: PrintAttempt[]; // Historial de intentos de impresion
  presentationQty?: number; // Unidades por pack (tobo/caja)
  // ───────── Cortesia ─────────
  noCharge?: boolean;
  noChargeReason?: string;
  noChargeResponsible?: 'COCINA' | 'BARRA' | 'MESONERO' | 'CASA';
  // ───────── Descuento parcial ─────────
  discountType?: 'PCT' | 'AMOUNT';
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
  // ───────── Compatibilidad legacy ─────────
  productName?: string; // Alias de 'name'
  totalPrice?: number; // Alias de 'total'
}

export type PrintAttemptStatus =
  | 'success' // Impresion confirmada OK
  | 'skipped' // Modo estacion no aplica (no es error)
  | 'queued' // Encolado en Firestore por servicio local caido
  | 'service_down' // Fetch al print service fallo (ECONNREFUSED, timeout)
  | 'http_500' // Print service respondio con error
  | 'printer_offline' // Impresora fisica desconectada
  | 'printer_paper_out' // Sin papel
  | 'printer_error' // Otro error fisico
  | 'network_error' // Otro error de red
  | 'exception'; // Exception inesperada

export interface PrintAttempt {
  at: string; // ISO timestamp
  qty: number; // cantidad que se intento imprimir
  station: 'KITCHEN' | 'BAR' | 'PIZZA' | 'CAJA';
  status: PrintAttemptStatus;
  errorMessage?: string | null;
  printerName?: string | null;
  attemptId: string; // UUID para correlacionar con printLogs
  userId?: string | null; // quien disparo el intento
  via?: 'local' | 'queue' | null; // por donde fue la impresion
}

export interface ProductCustomization {
  removedIngredients: string[]; // IDs de ingredientes removidos
  addedExtras: AddedExtra[]; // Adicionales agregados
  customizationPrice: number; // Precio adicional por personalizaciones
}

export interface AddedExtra {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}
