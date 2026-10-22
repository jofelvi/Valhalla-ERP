// Modelos compartidos con el proyecto web
import {
  CurrencyEnum,
  ProductTypeEnum,
  ProductStationEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
  TableStatusEnum,
  InvoiceStatusEnum,
  OrderTypeEnum,
  UserRoleEnum,
  AttendanceStatusEnum,
  ZoneSectorEnum,
  ChatStatusEnum,
  CustomerRequestType,
  CustomerRequestStatus,
} from './enums.ts';

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt?: Date | null;
  imageUrl?: string | null;
  isForSale: boolean;
  parentId?: string; // Si está, es subcategoría
}

export interface Ingredient {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: CurrencyEnum;
  type: ProductTypeEnum;
  categoryId: string;
  subcategoryId?: string; // Subcategoría del insumo (solo si type === BASE)
  supplierIds?: (string | undefined)[] | null;
  createdAt?: Date | null;
  isActive: boolean;
  isForSale: boolean;
  cost?: number;
  category?: string;
  sku?: string | null;
  barcode?: string | null;
  // Codigos adicionales: EAN real + etiquetas propias (ej: "TOBO-LATA-12").
  // El scanner de barra matchea contra barcode O barcodes.
  barcodes?: string[] | null;
  stock: number;
  minStock?: number | null;
  presentation?: string | null;
  presentationQuantity?: number | null;
  updatedAt?: Date | null;
  imageUrl?: string | null;
  ingredients?: Ingredient[] | null;
  nivel?: number | null;
  station?: ProductStationEnum | null;
  // Combos multi-estación: al pedir, se expande en una línea por parte.
  stationParts?: { label: string; station: string }[] | null;
  // Tiempo de preparacion y quien lo prepara: el servidor los usa para
  // costear el minuto con el sueldo real (laborCost va aparte de cost).
  prepTimeMinutes?: number | null;
  preparedByEmployeeId?: string | null;
  preparedByName?: string | null;
  laborCost?: number | null;
}

export interface OrderItem {
  /** Id de la linea dentro de la orden. Lo necesita todo el flujo de estacion. */
  _id?: string;
  productId: string;
  productName: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  total?: number;
  notes?: string | null;
  customizations?: ProductCustomization | null;
  deliveredQty?: number;
  inventoryConsumedQty?: number;
  sentQty?: number; // Cantidad "marcada" como enviada (puede mentir)
  printedQty?: number; // Cantidad CONFIRMADA impresa
  printedAt?: string; // ISO timestamp de ultima impresion exitosa
  station?: 'KITCHEN' | 'BAR' | 'PIZZA' | null;
  addedAt?: string;
  addedBy?: string;
  /** Anulado por el mesonero con PIN: no debe aparecer como pendiente. */
  cancelledAt?: string | null;
  printAttempts?: PrintAttempt[];
  // Pack products (tobos, cajas): unidades totales del pack.
  // Si > 0, el item representa N unidades individuales entregadas en rondas.
  presentationQty?: number;
}

export type PrintAttemptStatus =
  | 'success'
  | 'skipped'
  | 'queued'
  | 'service_down'
  | 'http_500'
  | 'printer_offline'
  | 'printer_paper_out'
  | 'printer_error'
  | 'network_error'
  | 'exception';

export interface PrintAttempt {
  at: string;
  qty: number;
  station: 'KITCHEN' | 'BAR' | 'CAJA';
  status: PrintAttemptStatus;
  errorMessage?: string | null;
  printerName?: string | null;
  attemptId: string;
  userId?: string | null;
  via?: 'local' | 'queue' | null;
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
}

export interface TransferRequest {
  status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  fromWaiterId: string;
  fromWaiterName?: string;
  toWaiterId: string;
  toWaiterName?: string;
  fromPct: number;
  toPct: number;
  requestedAt: string | Date;
  resolvedAt?: string | Date;
}

export interface WaiterShare {
  waiterId: string;
  waiterName?: string;
  pct: number;
  comisionPagada: boolean;
}

export interface CreditRequest {
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string | Date;
  note?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string | Date;
  rejectionReason?: string;
}

export interface AdditionalNote {
  text: string;
  createdAt: Date | string;
  authorId?: string;
  authorName?: string;
  system?: boolean;
}

export interface Order {
  id: string;
  orderNumber?: string | null; // Numero legible: "A001-08-04-2026"
  customerId: string;
  customerName?: string;
  userId?: string;
  orderType?: OrderTypeEnum;
  items: OrderItem[];
  status: OrderStatusEnum;
  paymentStatus: PaymentStatusEnum;
  paymentMethod?: PaymentMethodEnum;
  subtotal: number;
  tax?: number;
  serviceCharge?: number;
  /** Tarifas con las que se calculó la orden (el servidor las guarda). Ver `tarifasDeOrden`. */
  tasaServicio?: number | null;
  modoServicio?: string | null;
  tasaIva?: number | null;
  ivaIncluido?: boolean | null;
  tipAmount?: number;
  total: number;
  tableId?: string | null;
  tableName?: string | null;
  notes?: string | null;
  additionalNotes?: AdditionalNote[] | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  deletedReason?: string | null;
  paymentReference?: string | null;
  bcvRate?: number;
  paymentAmountBs?: number | null;
  paymentProofUrls?: string[] | null;
  pagoMovilPhone?: string | null;
  pagoMovilCedula?: string | null;
  pagoMovilBanco?: string | null;
  pendingPayments?: PendingPaymentEntry[] | null;
  // Rechazo de pago por el cajero
  paymentRejected?: boolean;
  paymentRejectionReason?: string | null;
  paymentRejectedAt?: Date | null;
  paymentRejectedBy?: string | null;
  waiterId?: string | null;
  waiterName?: string | null;
  customerAlias?: string | null;
  sector?: ZoneSectorEnum | null;
  customerLocation?: GpsCoordinates | null;
  creditRequest?: CreditRequest | null;
  transferRequest?: TransferRequest | null;
  waiterShares?: WaiterShare[] | null;
  // Mesa Conectada: vinculo cliente<->orden por QR y solicitudes al mesonero
  linkNonce?: string | null;
  customerRequests?: CustomerRequest[] | null;
  billRequested?: boolean;
  billRequestedAt?: Date | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

export interface CustomerRequest {
  id: string;
  type: CustomerRequestType;
  productId?: string | null;
  productName?: string | null;
  quantity?: number | null;
  note?: string | null;
  status: CustomerRequestStatus;
  createdByCustomerId: string;
  createdAt: Date | null;
  resolvedByUserId?: string | null;
  resolvedAt?: Date | null;
  rejectReason?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  memberNumber?: string | null;
  role?: UserRoleEnum;
  createdAt: Date | null;
  updatedAt?: Date | null;
  isActive: boolean;

  // Identificación
  identificationId?: string | null;
  identificationType?: string | null;
  associateNumber?: string | null;
  cedula?: string | null;
  /** Numero de accion del club, con padding a 5 digitos ("00590"). */
  memberAction?: string | null;
  /** Socio dado de alta a mano que no figura en el padron del club:
   *  marcado para revision, no se le da credito. */
  isUnverifiedMember?: boolean;

  // Perfil
  profession?: string | null;
  incomeRange?: string | null;

  // Conocimiento de marca
  knowsBusiness?: string | null;
  howFoundUs?: string | null;

  // Preferencias de consumo
  spendingCategories?: string[] | null;
  visitFrequency?: string | null;
  consumePreferences?: string[] | null;

  // Crédito y membresía
  creditLimit?: number | null;
  isMember?: boolean | null;
  profileComplete?: boolean | null;
  linkedUserId?: string | null;
}

// Tobos mixtos: una variante (Light/Pilsen/Azul) dentro de la composición.
export interface CartItemComposition {
  variantProductId: string;
  variantName: string;
  qty: number;
}

// Tipos para el carrito local
export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  customizations?: ProductCustomization | null;
  // Pack products (tobos, cajas): unidades por pack. Cuando es > 0 la
  // cantidad visible en el carrito es "packs" pero en la orden se expande
  // a quantity * presentationQty unidades individuales.
  presentationQty?: number;
  // Tobos mixtos: desglose por variante. Suma = presentationQty. Cuando está
  // presente, la línea NO se fusiona con otras (cada tobo tiene su mezcla).
  composition?: CartItemComposition[];
}

export interface ProductCustomization {
  removedIngredients?: string[];
  addedExtras?: AddedExtra[];
  customizationPrice?: number;
}

export interface AddedExtra {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  total: number;
}

// Modelo de mesa (compartido con POS web)
export interface Table {
  id: string;
  name: string;
  capacity: number;
  status: TableStatusEnum;
  orderId?: string | null;
  claimedBy?: string | null;
  claimedByName?: string | null;
  claimedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Modelo de factura (compartido con POS web)
export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId?: string | null;
  customerName?: string | null;
  userId?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatusEnum;
  paymentMethod?: PaymentMethodEnum;
  notes?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

// Modelo de pago (compartido con POS web)
export interface Payment {
  id: string;
  invoiceId: string;
  orderId: string;
  userId?: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  reference?: string | null;
  notes?: string | null;
  createdAt: Date | null;
}

// GPS
export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

// Asistencia (compatible con web POS)
export interface Attendance {
  id: string;
  employeeId: string;
  userId?: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  totalHours: number;
  overtimeHours: number;
  hoursWorked?: number;
  status: AttendanceStatusEnum;
  notes?: string;
  photoUrl?: string;
  checkOutPhotoUrl?: string;
  location?: {
    checkIn?: GpsCoordinates | null;
    checkOut?: GpsCoordinates | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Chat
export interface ChatMessage {
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'waiter';
  text: string;
  location?: GpsCoordinates;
  timestamp: Date;
}

export interface Chat {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  waiterId: string;
  waiterName: string;
  messages: ChatMessage[];
  status: ChatStatusEnum;
  createdAt: Date;
}

// Kitchen Inventory (Stock Management)
export interface KitchenStockItem {
  productId: string;
  productName: string;
  unit: string;
  initial?: number;
  pulled?: number;
  consumed?: number;
  remaining?: number;
  quantity?: number;
}

export interface KitchenMidPull extends KitchenStockItem {
  at: string;
  by: string;
}

export interface KitchenWasteItem {
  productId: string;
  productName: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface KitchenSession {
  id: string;
  openedAt: string;
  openedBy: string;
  closedAt?: string;
  status: 'open' | 'closed';
  initialStock: KitchenStockItem[];
  midPulls: KitchenMidPull[];
  physicalCount?: KitchenStockItem[];
  waste?: KitchenWasteItem[];
}

export interface KitchenLiveStockItem extends KitchenStockItem {
  initial: number;
  pulled: number;
  consumed: number;
  remaining: number;
}

export interface KitchenLiveStock {
  session: KitchenSession | null;
  stock: KitchenLiveStockItem[];
}
