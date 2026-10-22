import { Invoice } from '@odin6/types';
import { Order } from '@odin6/types';
import { Customer } from '@odin6/types';
import { User as UserModel } from '@odin6/types';
import { Payment } from '@odin6/types';
import { Product } from '@odin6/types';
import { OrderItem } from '@odin6/types';

export interface EnrichedOrderItem extends OrderItem {
  product?: Product;
}

export interface InvoiceDetailData {
  invoice: Invoice;
  order?: Order | null;
  customer?: Customer | null;
  user?: UserModel | null;
  enrichedItems: EnrichedOrderItem[];
  payments: Payment[];
  totalPaid: number;
}

export interface PaymentMethodSummary {
  method: string;
  amount: number;
  count: number;
}
