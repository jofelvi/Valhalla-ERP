import {
  OrderStatusEnum,
  OrderTypeEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '../enums/enumShared';
import { OrderItem } from './orderItem';
import type { NominaConfig } from '../config/nomina';
import type { ServiceMode, TarifasConfig } from '../config/tarifas';

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

// Item eliminado/reducido de la orden despues de comandarse (soft-delete visible)
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

export interface UltimaEntrega {
  porId: string | null; // userId de quien marcó la entrega
  por: string | null; // nombre, si el token lo traía
  rol: string | null;
  estacion: string | null; // BAR, KITCHEN, PIZZA…
  en: Date | string;
}

export interface Order {
  id: string;
  orderNumber?: string | null; // Numero legible: "A001-08-04-2026"
  tableId?: string | null; // Null para ordenes para llevar o de zona
  waiterId?: string | null; // Mesonero asignado (ordenes de zona)
  waiterName?: string | null; // Nombre del mesonero al momento de la orden
  customerAlias?: string | null; // Alias del cliente para identificacion rapida
  associateNumber?: string | null; // Numero de asociado/miembro (opcional)
  sector?: string | null; // Sector/zona donde se atiende (piscina, tenis, etc.)
  customerId?: string | null;
  customerName?: string | null; // Nombre con el que se tomo el pedido
  userId: string; // Mesero que tomó la orden
  status: OrderStatusEnum;
  items: OrderItem[];
  subtotal: number;
  serviceCharge: number; // 10% del subtotal cuando hay waiterId
  comisionBase?: number; // Base de comisión del mesonero
  /** Servicio que ya traen los precios (modo `included`). Informativo: no se suma al total. */
  servicioIncluido?: number;
  /** Tarifas con las que se calculó la orden. Cambiar la configuración no las reescribe. */
  tasaServicio?: number;
  modoServicio?: ServiceMode;
  tasaIva?: number;
  ivaIncluido?: boolean;
  /** Configuración completa con la que se calculó (reconstruye el recálculo de la orden). */
  configAplicada?: { tarifas: TarifasConfig; nomina: NominaConfig };
  noChargeAmount?: number; // Suma de items en cortesia
  discountAmount?: number; // Suma de descuentos autorizados con PIN admin
  tax: number;
  total: number;
  tipAmount?: number; // Propina registrada al procesar el pago
  liquidacionId?: string | null; // ID de la liquidacion a la que pertenece
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
  cancelledItems?: CancelledOrderItem[] | null; // Soft-delete visible
  // Rechazo de pago por verificar (cajero rechaza el comprobante)
  paymentRejected?: boolean;
  paymentRejectionReason?: string | null;
  paymentRejectedAt?: Date | null;
  paymentRejectedBy?: string | null; // userId del que rechazo
  // Última entrega marcada (por ítem, estación, ficha o POS web): quién y cuándo.
  // Lo escribe la API al despachar; la zona lo muestra sin pedir los eventos.
  ultimaEntrega?: UltimaEntrega | null;
  tableName?: string | null;
  comisionPagada?: boolean; // Pago de comisión al mesonero
  comisionPagadaAt?: Date | string | null;
  comisionPagoId?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  clientRequestId?: string; // Deduplicación para reintentos por mala red
}
