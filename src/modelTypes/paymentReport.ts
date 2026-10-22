import { PaymentMethodEnum } from '@/shared/types/enumShared';

export enum PaymentReportStatusEnum {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface PaymentReport {
  id: string;
  // Referencia a la cuenta por cobrar
  accountReceivableId: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName: string;

  // Datos del pago reportado
  amount: number; // USD
  amountBs?: number | null; // Si el pago fue en bolivares
  method: PaymentMethodEnum;
  reference?: string | null; // Numero de referencia / confirmacion
  phone?: string | null; // Para pago movil (origen)
  cedula?: string | null; // Para pago movil
  banco?: string | null; // Para pago movil / transferencia
  destinationAccount?: string | null; // A que cuenta/telefono del restaurante llego el pago
  paidAt: Date; // Fecha en que el cliente hizo el pago
  notes?: string | null;

  // Comprobante
  proofImageUrl: string; // URL publica de la imagen subida a Firebase Storage

  // Estado de revision
  status: PaymentReportStatusEnum;
  reportedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null; // userId del admin/cajero que reviso
  rejectionReason?: string | null;

  // Datos de contacto del reportante (para seguimiento)
  reporterName?: string | null;
  reporterPhone?: string | null;
}
