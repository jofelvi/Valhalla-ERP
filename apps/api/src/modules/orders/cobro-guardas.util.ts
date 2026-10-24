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
