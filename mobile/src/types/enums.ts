// Enums compartidos con el proyecto web

export enum CurrencyEnum {
  USD = 'USD',
  EUR = 'EUR',
  VES = 'VES',
  CLP = 'CLP',
  COP = 'COP',
}

// Insumo / Preparado / Servicio. Debe coincidir con packages/types y la web.
export enum ProductTypeEnum {
  BASE = 'BASE',
  MIXED = 'COMPUESTO',
  SERVICE = 'SERVICIO',
}

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
  BULK = 'Bulto',
  ROLL = 'Rollo',
  PLATE = 'Plato',
}

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

export enum OrderStatusEnum {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CREDIT = 'CREDIT',
  CANCELLED = 'CANCELLED',
  PAID = 'PAID',
}

export enum CustomerRequestType {
  PRODUCT = 'PRODUCT',
  CALL_WAITER = 'CALL_WAITER',
  MISC = 'MISC',
}

export enum CustomerRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  ACK = 'ACK',
}

export enum PaymentMethodEnum {
  CASH_BS = 'CASH_BS',
  CASH_USD = 'CASH_USD',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  PAGO_MOVIL = 'PAGO_MOVIL',
  MIXED = 'MIXED',
  PENDING = 'PENDING',
}

export enum PaymentStatusEnum {
  PENDING = 'pending',
  PENDING_VERIFICATION = 'pending_verification',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum TableStatusEnum {
  PREPARING = 'PREPARING',
  ISAVAILABLE = 'ISAVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  CLEANING = 'CLEANING',
}

export enum InvoiceStatusEnum {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum OrderTypeEnum {
  DineIn = 'dine-in',
  Takeaway = 'takeaway',
  Zone = 'zone',
}

export enum AttendanceStatusEnum {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EARLY_DEPARTURE = 'early_departure',
  HOLIDAY = 'holiday',
  SICK_LEAVE = 'sick_leave',
  VACATION = 'vacation',
  MEDICALREST = 'medicalRest',
}

export enum ZoneSectorEnum {
  EVENTO = 'evento',
  PISCINA = 'piscina',
  TENIS = 'tenis',
  FUTBOL = 'futbol',
  BEISBOL = 'beisbol',
  SALON_PRINCIPAL = 'salon_principal',
  CANCHAS = 'canchas',
}

export enum ChatStatusEnum {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export enum PaymentTypeEnum {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  PAYMOBIL = 'PAYMOBIL',
  MIXED = 'MIXED',
}
