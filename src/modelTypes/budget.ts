import { BudgetStatusEnum } from '@/shared/types/enumShared';

export interface BudgetItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type DiscountType = 'fixed' | 'percentage';

export interface Budget {
  id: string;
  budgetNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  // Datos fiscales (opcional, se reusan al generar factura)
  customerRif?: string;
  customerIdType?: string; // V, E, J, G, P
  customerAddress?: string;
  customerType?: string; // contribuyente_ordinario | contribuyente_formal | no_contribuyente
  eventName: string;
  eventDate?: Date;
  eventGuests?: number;
  items: BudgetItem[];
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discountType: DiscountType;
  discountValue: number;
  discount: number;
  total: number;
  notes?: string;
  status: BudgetStatusEnum;
  validUntil?: Date;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  invoiceId?: string; // Si ya se genero la factura fiscal desde este presupuesto
  abonoAmount?: number;
  abonoMethod?: string;
  abonoReference?: string;
  abonoDate?: Date | string;
  accountReceivableId?: string;
}

export interface CalendarEvent {
  id: string;
  budgetNumber: string;
  customerName: string;
  eventName: string;
  eventDate: string | Date;
  total: number;
  abonoAmount?: number;
}

export interface AcceptBudgetPayload {
  abonoAmount: number;
  abonoMethod: string;
  abonoReference?: string;
}
