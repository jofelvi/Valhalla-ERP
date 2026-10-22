export enum UserRoleEnum {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  KITCHEN = 'kitchen',
  BAR = 'bar',
  PIZZA = 'pizza',
  CUSTOMER = 'customer',
}

export enum CurrencyEnum {
  USD = 'USD',
  EUR = 'EUR',
  VES = 'VES',
  CLP = 'CLP',
  COP = 'COP',
}

// Backward compatibility alias
export const VE = CurrencyEnum.VES;

export enum DocumentTypeEnum {
  RECEIPT = 'RECEIPT',
  INVOICE = 'INVOICE',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
}

export enum SupplierPaymentTermEnum {
  IMMEDIATE = 'IMMEDIATE',
  NET_15 = 'NET_15',
  NET_30 = 'NET_30',
  NET_60 = 'NET_60',
  NET_90 = 'NET_90',
  ON_DELIVERY = 'ON_DELIVERY',
}

/**
 * Naturaleza del producto: decide QUE sale del almacen al venderlo.
 *
 *  BASE (Insumo)      se compra y se descuenta a si mismo (ketchup, cerveza, lata)
 *  MIXED (Preparado)  lleva receta: salen sus ingredientes con su merma, nunca el
 *  SERVICE (Servicio) no toca inventario a proposito (descorche, alquiler, animador)
 *
 * Regla: si al venderlo algo sale de la nevera o del deposito, NO es servicio.
 * El valor de MIXED es 'COMPUESTO' por los datos historicos; no se renombra.
 */
export enum ProductTypeEnum {
  BASE = 'BASE',
  MIXED = 'COMPUESTO',
  SERVICE = 'SERVICIO',
}

/** Como se llama cada naturaleza en pantalla (una sola fuente). */
export const PRODUCT_TYPE_LABEL: Record<ProductTypeEnum, string> = {
  [ProductTypeEnum.BASE]: 'Insumo',
  [ProductTypeEnum.MIXED]: 'Preparado',
  [ProductTypeEnum.SERVICE]: 'Servicio',
};

export enum ProductStationEnum {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  PIZZA = 'PIZZA',
}

export enum OrderStatusEnum {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CREDIT = 'CREDIT',
  CANCELLED = 'CANCELLED',
  PAID = 'PAID',
}

export enum PaymentMethodEnum {
  CASH_BS = 'CASH_BS',
  CASH_USD = 'CASH_USD',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  PAGO_MOVIL = 'PAGO_MOVIL',
  PAGO_MOVIL_MANUAL = 'PAGO_MOVIL_MANUAL',
  MIXED = 'MIXED',
  PENDING = 'PENDING',
  // Consumo de un trabajador descontado de su nomina semanal. No entra dinero
  // a caja, pero deja el registro para que la cuenta no quede saldada sin rastro.
  PAYROLL_DEDUCTION = 'PAYROLL_DEDUCTION',
}

export enum PaymentStatusEnum {
  PENDING = 'pending',
  PENDING_VERIFICATION = 'pending_verification',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum AttendanceStatusEnum {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EARLY_DEPARTURE = 'early_departure',
  HOLIDAY = 'holiday',
  SICK_LEAVE = 'sick_leave',
  VACATION = 'vacation',
  MEDICALREST = 'medicalRest', // Mantener por compatibilidad
}

export enum PurchaseOrderStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  RECEIVED = 'received',
  CANCELED = 'canceled',
  PARTIALLY_RECEIVED = 'partially_received',
}

export enum ProductPresentationEnum {
  UNIT = 'Unidad',
  BOX = 'Caja',
  PACK = 'Paquete',
  BAG = 'Bolsa',
  BOTTLE = 'Botella',
  CAN = 'Lata',
  CONTAINER = 'Envase',
  JAR = 'Frasco',
  DOZEN = 'Docena',
  HALF_DOZEN = 'Media Docena',
  KILOGRAM = 'Kilogramo',
  GRAM = 'Gramo',
  LITER = 'Litro',
  MILLILITER = 'Mililitro',
  GALLON = 'Galón',
  // Agrupaciones comerciales
  BULK = 'Bulto',
  ROLL = 'Rollo',
  PLATE = 'Plato',
}

export enum IdentificationType {
  V = 'V', // Venezolano
  E = 'E', // Extranjero
  J = 'J', // Jurídico
  G = 'G', // Gubernamental
  A = 'A', // Número de Acción
}

export enum InvoiceStatusEnum {
  PENDING = 'pending',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum OrderTypeEnum {
  DineIn = 'dine-in',
  Takeaway = 'takeaway',
  Zone = 'zone',
}

export enum ZoneSectorEnum {
  PISCINA = 'piscina',
  TENIS = 'tenis',
  FUTBOL = 'futbol',
  BEISBOL = 'beisbol',
  SALON_PRINCIPAL = 'salon_principal',
  CANCHAS = 'canchas',
}

export enum PayrollStatusEnum {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum SubscriptionPlanEnum {
  FREE = 'free',
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom',
}

export enum PaymentTypeEnum {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  PAYMOBIL = 'paymobil',
  MIXED = 'mixed',
}

export enum TableStatusEnum {
  PREPARING = 'PREPARING',
  ISAVAILABLE = 'ISAVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  CLEANING = 'CLEANING',
}

export enum DateFilterEnum {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_WEEK = 'last_week',
  LAST_TWO_WEEKS = 'last_two_weeks',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom',
}

export enum BudgetStatusEnum {
  DRAFT = 'draft',
  SENT = 'sent',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}
