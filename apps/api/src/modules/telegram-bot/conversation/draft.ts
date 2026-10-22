import type { UnidadDeInventario } from './unidades-inventario';
import type {
  InvoiceHeader,
  MontoCandidato,
} from '../../ocr/invoice-header-parser';
import type { ProveedorRef } from '../../expenses/supplier-suggest';
import type { MatchedLine } from '../../inventory/invoice-parser';
import type { PurchaseUnit } from '../../inventory/dto/create-purchase.dto';
import type {
  ExpenseCurrency,
  ExpenseKind,
  ExpensePaymentStatus,
  FundsSource,
} from '../../expenses/schemas/expense.schema';

export type Step =
  | 'KIND'
  | 'SUPPLIER'
  | 'TYPE'
  | 'AMOUNT'
  | 'LINES'
  | 'CATEGORY'
  | 'DESCRIPTION'
  | 'PAYMENT'
  | 'FUNDS'
  | 'SUMMARY';

export interface DraftLine {
  /** Renglon crudo del OCR; al confirmar, PurchasesService aprende el alias. */
  invoiceText: string;
  productId: string | null;
  productName: string | null;
  quantity: number | null;
  unit: PurchaseUnit | null;
  /** En la moneda del borrador. */
  unitCost: number | null;
  unitsPerPack: number | null;
  confirmed: boolean;
}

/** Un empleado activo, para asignarle un prestamo o un pago de personal. */
export interface EmpleadoRef {
  id: string;
  name: string;
  position: string | null;
}

/** Tipo de compra de insumos: define que lista de frecuentes se ofrece. */
export interface TipoCompra {
  key: string;
  label: string;
}

/** Lo que se pago la vez pasada por este producto, para no comprar a ciegas. */
export interface UltimaCompra {
  date: Date;
  placeName: string | null;
  quantity: number;
  unit: PurchaseUnit;
  /** Siempre en USD: es lo que guarda la compra. */
  unitCostUsd: number;
  /** Lo que se pago en Bs ese dia, si la factura fue en Bs. */
  unitCostBs: number | null;
  /** Tasa del dia de esa compra, si fue en Bs. */
  exchangeRate: number | null;
}

export interface ExpenseDraft {
  kind: ExpenseKind | null;
  supplierId: string | null;
  supplierName: string | null;
  /** Vegetales / Carnes / Bebidas / Otros. Solo en compras de insumos. */
  purchaseType: string | null;
  currency: ExpenseCurrency | null;
  amount: number | null;
  exchangeRate: number | null;
  lines: DraftLine[];
  category: string | null;
  description: string | null;
  /**
   * A quien va el gasto cuando es de personal (un prestamo, un sueldo, un
   * bono). "es un prestamo y porque me pregunta cual es el concepto?? no tiene
   * sentido" (dueño, 17/09/2026): en esas categorias la pregunta no es QUE se
   * compro sino A QUIEN se le dio.
   */
  employeeId: string | null;
  employeeName: string | null;
  paymentStatus: ExpensePaymentStatus | null;
  fundsSource: FundsSource | null;
  invoiceUrl: string;
  ocrText: string;
  ocrHeader: InvoiceHeader | null;
  /** Renglon cuyo "cant unidad costo" se esta escribiendo. */
  editingLine: number | null;
  /** Renglon para el que se esta buscando producto. */
  searchingLine: number | null;
  /**
   * Lo ultimo que el socio escribio para buscar el producto del renglon. Al
   * elegir una opcion se aprende "este texto -> este producto" para la proxima.
   */
  lastSearch: string | null;
  /** Opciones mostradas, para resolver `sup:<id>` / `cat:<i>` sin volver a consultar. */
  supplierOptions: ProveedorRef[];
  categoryOptions: string[];
  /**
   * Los montos que la factura ofrece como total, cada uno con su moneda, en el
   * orden en que se mostraron. El indice del boton (`amt:N`) apunta aqui.
   * Un borrador anterior a 1.7.1 los trae como numeros sueltos.
   */
  amountOptions: Array<MontoCandidato | number>;
  typeOptions: TipoCompra[];
  /**
   * Nombre escrito para un proveedor de insumos que no existe, a la espera de
   * que el socio confirme crearlo. Sin esta confirmacion cualquier texto
   * terminaba como proveedor (asi entro "C:/Program Files/Git/cancelar").
   */
  pendingSupplierName?: string | null;
  /** Empleados mostrados, para resolver `emp:<i>` sin volver a consultar. */
  employeeOptions: EmpleadoRef[];
  /** El BCV vino de respaldo: AMOUNT espera que el proximo texto sea la tasa real, no el monto. */
  awaitingManualRate?: boolean;
  /**
   * Id de la compra de inventario ya creada en un intento anterior de
   * `registrar()` que fallo DESPUES de crearla (ver RegistroParcialError).
   * Si viene seteado, el siguiente intento reusa esa compra en vez de
   * duplicarla.
   */
  purchaseId?: string;
}

export function draftVacio(
  invoiceUrl: string,
  ocrText: string,
  ocrHeader: InvoiceHeader | null,
): ExpenseDraft {
  return {
    kind: null,
    supplierId: null,
    supplierName: null,
    purchaseType: null,
    currency: ocrHeader?.currency ?? null,
    amount: ocrHeader?.total ?? null,
    exchangeRate: null,
    lines: [],
    category: null,
    // El concepto del Pago Movil ("panes perro", "ridery", "gas") ya es la
    // descripcion del gasto, escrita por quien pago: no hay que preguntarla.
    description: ocrHeader?.concepto ?? null,
    employeeId: null,
    employeeName: null,
    paymentStatus: null,
    fundsSource: null,
    invoiceUrl,
    ocrText,
    ocrHeader,
    editingLine: null,
    searchingLine: null,
    lastSearch: null,
    supplierOptions: [],
    categoryOptions: [],
    amountOptions: ocrHeader?.totalCandidates ?? [],
    typeOptions: [],
    employeeOptions: [],
  };
}

export interface Boton {
  label: string;
  data: string;
}
export interface Reply {
  text: string;
  buttons?: Boton[][];
}

export type StepInput =
  | { kind: 'text'; text: string }
  | { kind: 'callback'; data: string };

/** Lo minimo que los pasos necesitan del mundo. Se mockea entero en los specs. */
export interface StepDeps {
  listSuppliers(): Promise<ProveedorRef[]>;
  createSupplier(name: string): Promise<ProveedorRef>;
  /**
   * Categorias que se ofrecen. Dependen del tipo: un gasto general no se
   * clasifica con las categorias del inventario ("Carnes y pollo" no es donde
   * se carga un sueldo).
   */
  listCategories(kind: ExpenseKind | null): Promise<string[]>;
  /** `source === 'fallback'` cuando el BCV no se pudo leer (tasa de respaldo). */
  bcvRate(): Promise<{ rate: number; source: string }>;
  matchLines(placeId: string, ocrText: string): Promise<MatchedLine[]>;
  searchProducts(query: string): Promise<Array<{ id: string; name: string }>>;
  /**
   * Aprende que `texto` (lo que escribio el socio) es `productId`. El bot NO
   * crea productos: aprender como los llama cada quien evita que se pidan
   * duplicados ("Luchuga" junto a "Lechuga Romana").
   */
  learnSearchAlias(texto: string, productId: string): Promise<void>;
  /** Tipos de compra configurados en `configs/bot_compras`. */
  listPurchaseTypes(): Promise<TipoCompra[]>;
  /**
   * Los productos que SIEMPRE se compran de ese tipo, en botones. Salen de la
   * misma config, y solo se muestran los que existen hoy en el catalogo: el
   * bot no crea productos.
   */
  /** Como lleva el inventario cada producto (para mostrar lo que entra al stock). */
  productUnits(ids: string[]): Promise<Record<string, UnidadDeInventario>>;
  /** Los de la lista del tipo; si esta vacia, los asociados al proveedor. */
  listFrequentProducts(
    tipo: string,
    supplierId?: string | null,
  ): Promise<Array<{ id: string; name: string }>>;
  /** Lo que se pago la ultima vez por ese producto (null si nunca se compro). */
  lastPurchase(productId: string): Promise<UltimaCompra | null>;
  /**
   * Los empleados ACTIVOS, para asignarles un prestamo o un pago. Solo
   * activos: prestarle a alguien que ya no trabaja aqui es un error, no una
   * opcion que haya que ofrecer.
   */
  listActiveEmployees(): Promise<EmpleadoRef[]>;
  /**
   * Un gasto ya registrado que parece el mismo pago (mismo numero de
   * operacion). El resumen lo avisa antes de confirmar; no lo bloquea.
   */
  possibleDuplicate(draft: ExpenseDraft): Promise<GastoPrevio | null>;
}

/** Lo minimo para contarle al socio cual gasto parece repetido. */
export interface GastoPrevio {
  createdAt: Date;
  /** Cuándo se cargó, ya formateado en la zona del negocio (lo arma quien consulta). */
  cuando: string;
  category: string;
  description: string | null;
  socio: string;
}

export interface StepResult {
  draft: ExpenseDraft;
  next: Step | 'STAY' | 'DONE' | 'CANCEL';
  reply?: Reply;
}

export interface StepHandler {
  prompt(draft: ExpenseDraft, deps: StepDeps): Promise<Reply>;
  handle(
    input: StepInput,
    draft: ExpenseDraft,
    deps: StepDeps,
  ): Promise<StepResult>;
}

/** "18.450,00" | "18450" | "245.5" | "1,450.00" -> number; null si no es un monto. */
export function parseMonto(text: string): number | null {
  const s = text
    .trim()
    .replace(/^(bs|\$|usd)\.?\s*/i, '')
    .replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  // Aqui la coma es SIEMPRE decimal si es la ultima marca: "3,015 l" son tres
  // litros, no tres mil (prueba real Viveluso, 18/09/2026: "0,2026" por huevo
  // se guardaba como 2026). El punto con tres cifras detras es de miles
  // ("1.200"), como se escribe en Venezuela; con otra cantidad, decimal.
  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');
  let limpio: string;
  if (ultimaComa > ultimoPunto && (s.match(/,/g) ?? []).length === 1)
    limpio = s.replace(/\./g, '').replace(',', '.');
  else if (
    ultimoPunto > ultimaComa &&
    (s.match(/\./g) ?? []).length === 1 &&
    !/\.\d{3}$/.test(s)
  )
    limpio = s.replace(/,/g, '');
  else limpio = s.replace(/[.,]/g, '');
  const n = parseFloat(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const CANCELAR: Boton = { label: '❌ Cancelar', data: 'cancel' };
