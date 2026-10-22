import {
  PaymentMethodEnum,
  SupplierPaymentTermEnum,
} from '../../../shared/types/enumShared';

export interface SupplierContact {
  name: string;
  position?: string; // Cargo en la empresa
  phone?: string;
  email?: string;
  isDeliveryContact?: boolean; // Si es la persona que entrega
  isPrimaryContact?: boolean; // Si es el contacto principal
}

export interface SupplierPaymentInfo {
  preferredPaymentMethod: PaymentMethodEnum;
  paymentTerms: SupplierPaymentTermEnum; // Términos de pago
  creditLimit?: number; // Límite de crédito
  taxId?: string; // RIF o número de identificación fiscal
  bankAccount?: string; // Cuenta bancaria
  bankName?: string; // Nombre del banco
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null; // Permitir null y undefined (mantener por compatibilidad)
  phone?: string | null;
  email?: string | null; // Permitir null también aquí
  address?: string | null; // Permitir null también aquí
  createdAt: Date;
  isActive: boolean;
  productIds?: string[]; // IDs de productos que provee

  // Nuevos campos
  contacts?: SupplierContact[]; // Lista de contactos
  paymentInfo?: SupplierPaymentInfo; // Información de pago
  website?: string;
  notes?: string; // Notas adicionales
}
