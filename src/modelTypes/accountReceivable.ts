import { InvoiceStatusEnum } from '@/shared';

export interface AccountReceivable {
  id: string;
  customerId: string;
  customerName: string;
  orderId?: string | null;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  status: InvoiceStatusEnum;
  description?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
  // Campos para unificacion de cuentas
  isMerged?: boolean;
  mergedIntoId?: string | null;
  isConsolidated?: boolean;
  mergedAccountIds?: string[];
  mergedOrderIds?: string[];
  lastNotificationAt?: Date | string | null;
  lastNotificationChannel?: string | null;
  // Enriquecidos por el backend en el listado (findAll):
  waiterName?: string | null; // mesonero(s) de la(s) orden(es)
  customerPhone?: string | null; // telefono del cliente (si tiene)
  /** N° de accion del club del cliente ("00590"). Es como se identifica a un socio. */
  customerMemberAction?: string | null;
  // Auditoria del cobro (la escribe el backend desde el JWT)
  settlementSource?: 'CASH' | 'PAYROLL' | 'MANUAL';
  settlementPayrollId?: string;
  settledByUserId?: string;
  settledByEmail?: string;
  settledAt?: Date | string | null;
}
