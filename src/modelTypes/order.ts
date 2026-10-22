import {
  OrderStatusEnum,
  OrderTypeEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '@/shared';
import { OrderItem } from '@odin6/types';

export type OcrStatus = 'ok' | 'mismatch' | 'fraud_suspect' | 'failed';

export interface OcrPerImage {
  url: string;
  refs: string[];
  amountsBs: number[];
  codes: string[];
  type?: string | null;
  status?: string | null;
  durationMs?: number;
}

export interface PendingPaymentOcr {
  processedAt: Date | string;
  status: OcrStatus;
  imagesProcessed: number;
  extractedRefs: string[];
  extractedShortRefs: string[];
  extractedAmountsBs: number[];
  extractedCodes: string[];
  inputRefs: string[];
  warnings: string[];
  duplicateInOtherOrders: Array<{
    part: string;
    source: string;
    orderId: string;
    amount?: number;
    method?: string;
    reference?: string;
    createdAt?: Date | string;
  }>;
  perImage: OcrPerImage[];
}

export interface PendingPaymentEntry {
  method: PaymentMethodEnum;
  amount: number;
  amountBs: number;
  reference?: string | null;
  pagoMovilPhone?: string | null;
  pagoMovilCedula?: string | null;
  pagoMovilBanco?: string | null;
  proofUrls?: string[] | null;
  ocr?: PendingPaymentOcr | null;
}

// Item eliminado/reducido de la orden despues de comandarse (soft-delete
// visible). Lo escribe SOLO el backend cuando se autoriza con PIN.
export interface CancelledOrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice?: number;
  total?: number;
  station?: string | null;
  reason?: string;
  authorizedById?: string | null;
  authorizedByName?: string | null;
  actorId?: string | null;
  cancelledAt: Date | string;
}

export interface Order {
  id: string;
  orderNumber?: string | null; // Numero legible: "A001-08-04-2026"
  tableId?: string | null; // Null para ordenes para llevar o de zona
  waiterId?: string | null; // Mesonero asignado (ordenes de zona)
  // Nombre del mesonero al momento de la orden. Lo escribe el backend y es el
  // unico enganche para las ordenes viejas cuyo empleado no tiene userId.
  waiterName?: string | null;
  customerAlias?: string | null; // Alias del cliente para identificacion rapida
  associateNumber?: string | null; // Numero de asociado/miembro (opcional)
  sector?: string | null; // Sector/zona donde se atiende (piscina, tenis, etc.)
  customerId?: string | null;
  // Nombre con el que se tomo el pedido. Lo manda el movil desde que se crea
  // la orden; la factura se emitia con "Cliente no especificado" porque nadie
  // lo leia.
  customerName?: string | null;
  userId: string; // Mesero que tomó la orden
  status: OrderStatusEnum;
  items: OrderItem[];
  subtotal: number;
  serviceCharge: number; // 10% del subtotal cuando hay waiterId
  // Base de comision del mesonero: 10% de lo cobrado SIN cortesias ni consumo
  // de socios. La comision se calcula sobre esto, no sobre serviceCharge.
  comisionBase?: number;
  noChargeAmount?: number; // Suma de items en cortesia
  discountAmount?: number; // Suma de descuentos autorizados con PIN admin
  tax: number;
  total: number;
  tipAmount?: number; // Propina registrada al procesar el pago
  paymentMethod?: PaymentMethodEnum | null;
  orderType?: OrderTypeEnum | null;
  paymentStatus: PaymentStatusEnum | null;
  notes?: string | null;
  paymentReference?: string | null;
  bcvRate?: number;
  paymentAmount?: number; // Alias de paymentAmountBs para compatibilidad (monto pagado en Bs)
  paymentAmountBs?: number | null;
  paymentProofUrls?: string[] | null;
  pagoMovilPhone?: string | null;
  pagoMovilCedula?: string | null;
  pagoMovilBanco?: string | null;
  pendingPayments?: PendingPaymentEntry[] | null;
  // Soft-delete visible: items quitados de la orden despues de comandarse.
  // Los escribe SOLO el backend (candado PIN) — el cliente los muestra.
  cancelledItems?: CancelledOrderItem[] | null;
  // Rechazo de pago por verificar (cajero rechaza el comprobante)
  paymentRejected?: boolean;
  paymentRejectionReason?: string | null;
  paymentRejectedAt?: Date | null;
  paymentRejectedBy?: string | null; // userId del que rechazo
  tableName?: string | null;
  // Pago de comision al mesonero
  comisionPagada?: boolean;
  comisionPagadaAt?: Date | string | null;
  comisionPagoId?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  clientRequestId?: string; // Deduplicación: ID estable del cliente para reintentos por mala red
}
