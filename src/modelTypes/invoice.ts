import { CurrencyEnum, InvoiceStatusEnum, PaymentTypeEnum } from '@/shared';

export interface Invoice {
  id: string;
  invoiceNumber: string; // Número único de factura
  orderId?: string; // 🔗 relación con Order (opcional)
  customerId?: string; // 🔗 relación con Customer (opcional)
  customerName?: string; // Nombre del cliente si no hay customerId
  customerRif?: string; // RIF del cliente

  // Datos fiscales (factura SENIAT)
  customerIdType?: string; // V, E, J, G, P
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerType?: string; // contribuyente_ordinario | contribuyente_formal | no_contribuyente
  controlNumber?: string; // Numero de control fiscal correlativo (separado del invoiceNumber)
  paymentCondition?: string; // contado | credito_15 | credito_30 | credito_60
  issueDate?: Date; // Fecha de emision (separada de createdAt)
  observations?: string;
  discount?: number;
  budgetId?: string; // Linkeo al presupuesto origen

  // Montos y cálculos
  subtotal: number; // Subtotal antes de impuestos
  serviceCharge: number; // Recargo por servicio (10% cuando hay mesonero)
  tax: number; // Monto de impuestos
  total: number; // Total final
  tip?: number; // Propina
  paidAmount?: number; // Abonos ya registrados (cuentas por cobrar con pagos parciales)
  totalAmount: number; // Campo legacy, mantener por compatibilidad

  // Configuración
  paymentType: PaymentTypeEnum;
  currency: CurrencyEnum;
  status: InvoiceStatusEnum;

  // Fechas
  createdAt: Date;
  updatedAt?: Date;
  dueDate?: Date; // Fecha de vencimiento
  paidAt?: Date; // Fecha de pago completo

  // Información adicional
  notes?: string; // Notas adicionales
  items?: InvoiceItem[]; // Items de la factura

  // ── Datos del cobro (cuando proviene de un cobro por verificar del mesonero) ──
  paymentReference?: string; // Referencia principal del pago
  bcvRate?: number; // Tasa BCV usada al cobrar
  paymentAmountBs?: number; // Monto pagado en Bs
  paymentProofUrls?: string[]; // URLs de imágenes del comprobante
  pagoMovilPhone?: string; // Telefono Pago Movil
  pagoMovilCedula?: string; // Cedula Pago Movil
  pagoMovilBanco?: string; // Banco Pago Movil
}

export interface InvoiceItem {
  id?: string;
  productId?: string;
  name?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  // Estado de cobro del item cuando la cuenta tiene abono (reparto FIFO).
  // Solo presente en el PDF de cuentas por cobrar con pago parcial.
  paidStatus?: 'paid' | 'partial' | 'pending';
  paidPortion?: number; // monto del item cubierto por el abono (para "Parcial")
}
