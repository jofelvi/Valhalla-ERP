import { OrderStatusEnum, PaymentStatusEnum } from '@odin6/types';

/**
 * Guardas de dinero del PATCH de una orden (modelo PREPAGO del evento).
 *
 * Son funciones puras: el servicio decide cuándo aplicarlas y lanza la excepción.
 * La validación vive en el servidor porque hay APKs viejas en campo que no traen
 * los arreglos de la app: "un fix solo en el APK no protege".
 */

/** Tolerancia de redondeo en dólares (centavos). */
export const TOLERANCIA_COBRO = 0.01;

export const MENSAJE_AGREGAR_A_COBRADA =
  'Este pedido ya está cobrado: para agregar productos crea un pedido nuevo.';

/** Suma en USD de los pagos pendientes (`amount` ya viene en dólares). */
export function sumaPagosPendientes(
  pagos: ReadonlyArray<Record<string, unknown>>,
): number {
  const suma = pagos.reduce((acc, p) => {
    const monto = Number(p.amount);
    return acc + (Number.isFinite(monto) ? monto : 0);
  }, 0);
  return +suma.toFixed(2);
}

/** Cuánto falta para cubrir el total (0 si ya lo cubre). */
export function faltaParaCubrir(
  pagos: ReadonlyArray<Record<string, unknown>>,
  total: number,
): number {
  return Math.max(0, +(total - sumaPagosPendientes(pagos)).toFixed(2));
}

export function pagosCubrenTotal(
  pagos: ReadonlyArray<Record<string, unknown>>,
  total: number,
): boolean {
  return faltaParaCubrir(pagos, total) <= TOLERANCIA_COBRO;
}

/** ¿La orden ya está cobrada (o en verificación de cobro)? */
export function ordenEstaCobrada(
  paymentStatus: unknown,
  status: unknown,
): boolean {
  return (
    paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION ||
    paymentStatus === PaymentStatusEnum.PAID ||
    status === OrderStatusEnum.PAID
  );
}

/** Estados de un documento Payment que ya no cuentan como dinero cobrado. */
const ESTADOS_PAGO_ANULADO = new Set([
  'anulado',
  'anulada',
  'reembolsado',
  'reembolsada',
  'reversado',
  'reversada',
  'cancelado',
  'cancelada',
  'cancelled',
  'canceled',
  'refunded',
  'voided',
]);

/** ¿Este documento Payment sigue siendo dinero cobrado? */
export function pagoVigente(pago: { status?: unknown }): boolean {
  return !ESTADOS_PAGO_ANULADO.has(String(pago.status ?? '').toLowerCase());
}

/**
 * Valida la forma de `pendingPayments` (M1): cada `amount` debe ser un número
 * finito mayor que cero. Sin esto, [{amount:100},{amount:-90}] suma 10 y "cubre"
 * una cuenta de 10 aunque el cliente pagó 100 y se devolvió 90 por fuera.
 * Devuelve el mensaje de error o null si es válido. Un valor que no es lista
 * (null, ausente) no se valida aquí: lo decide el llamador.
 */
export function errorEnPagosPendientes(pagos: unknown): string | null {
  if (!Array.isArray(pagos)) return null;
  for (const pago of pagos) {
    const bruto = (pago as { amount?: unknown } | null)?.amount;
    const monto =
      typeof bruto === 'number'
        ? bruto
        : typeof bruto === 'string' && bruto.trim() !== ''
          ? Number(bruto)
          : NaN;
    if (!Number.isFinite(monto) || monto <= 0) {
      return 'Cada pago debe tener un monto en dólares mayor que cero.';
    }
  }
  return null;
}

/** Piso de precio de una línea del catálogo (por unidad). */
export interface PisoDeLinea {
  nombre: string;
  /** Precio mínimo por unidad: products.price, o price / unidades del pack. */
  piso: number;
  /** Producto multi-estación (combo): sus partes llegan con unitPrice 0. */
  combo: boolean;
}

/**
 * Busca la primera línea cuyo unitPrice está por debajo del piso de su producto
 * (C2). Devuelve el nombre de esa línea o null.
 *
 * - Una línea que ya existe en la base con el mismo producto y el mismo unitPrice
 *   no se revisa: un precio de catálogo que subió no debe romper una entrega que
 *   reenvía los mismos items. Solo cuenta lo que el PATCH cambia.
 * - Un combo (stationParts) puede traer partes a 0 siempre que la misma petición
 *   traiga al menos una parte con precio: no se regala un combo entero.
 * - Un producto sin piso conocido (no está en el catálogo) no se bloquea aquí.
 */
export function primerPrecioBajo(
  items: ReadonlyArray<Record<string, unknown>>,
  pisos: ReadonlyMap<string, PisoDeLinea>,
  base: ReadonlyArray<Record<string, unknown>>,
): string | null {
  const pendientesDeBase = base.map((b) => ({
    productId: String(b.productId ?? ''),
    unitPrice: Number(b.unitPrice),
  }));
  const conPrecio = new Set(
    items
      .filter((it) => Number(it.unitPrice) > 0)
      .map((it) => String(it.productId ?? '')),
  );
  for (const it of items) {
    const id = String(it.productId ?? '');
    const piso = pisos.get(id);
    if (!piso) continue;
    const unitario = Number(it.unitPrice);
    if (!Number.isFinite(unitario)) return piso.nombre;
    const enBase = pendientesDeBase.findIndex(
      (b) =>
        b.productId === id &&
        Math.abs(b.unitPrice - unitario) <= TOLERANCIA_COBRO,
    );
    if (enBase !== -1) {
      pendientesDeBase.splice(enBase, 1);
      continue;
    }
    if (piso.combo && unitario === 0 && conPrecio.has(id)) continue;
    if (unitario + TOLERANCIA_COBRO < piso.piso) return piso.nombre;
  }
  return null;
}

/** Huella de lo que una cortesía o un descuento aporta a una línea. */
function huellaDeRebaja(it: Record<string, unknown>): string | null {
  const cortesia = it.noCharge === true;
  const descuento = Number(it.discountAmount) || 0;
  if (!cortesia && descuento <= 0) return null;
  return `${cortesia ? 1 : 0}|${descuento.toFixed(2)}`;
}

/**
 * Cortesías y descuentos (C2, rebaja por PATCH genérico). Solo se cambian con su
 * acción propia y PIN admin (/no-charge, /discount). Compara, por producto, las
 * líneas que llevan cortesía o descuento antes y después del PATCH: si el PATCH
 * introduce una, la quita o cambia su monto, devuelve el nombre del producto.
 * Las líneas sin rebaja no cuentan, así que agregar una línea normal del mismo
 * producto no dispara nada.
 */
export function cambioDeRebaja(
  items: ReadonlyArray<Record<string, unknown>>,
  base: ReadonlyArray<Record<string, unknown>>,
): string | null {
  const porProducto = (lista: ReadonlyArray<Record<string, unknown>>) => {
    const mapa = new Map<string, string[]>();
    for (const it of lista) {
      const huella = huellaDeRebaja(it);
      if (huella === null) continue;
      const id = String(it.productId ?? '');
      mapa.set(id, [...(mapa.get(id) ?? []), huella].sort());
    }
    return mapa;
  };
  const antes = porProducto(base);
  const despues = porProducto(items);
  const ids = new Set([...antes.keys(), ...despues.keys()]);
  for (const id of ids) {
    const a = (antes.get(id) ?? []).join(';');
    const d = (despues.get(id) ?? []).join(';');
    if (a !== d) {
      const linea = items.find((it) => String(it.productId ?? '') === id);
      return String(linea?.name ?? linea?.productName ?? id);
    }
  }
  return null;
}
