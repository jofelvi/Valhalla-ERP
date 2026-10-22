import {
  calcularComision,
  NOMINA_DEFAULT,
  type NominaConfig,
} from '@odin6/types';

/** Jornal por defecto del mesonero (pendiente: debería venir de la configuración de nómina). */
export const DEFAULT_DAILY_RATE = 5;

export function weeklySalary(monthly?: number): number {
  return Math.round(((monthly ?? 0) / 4) * 100) / 100;
}

export function staffDailyRate(monthly?: number): number {
  return Math.round((weeklySalary(monthly) / 7) * 100) / 100;
}

export function isWaiterRole(role?: string): boolean {
  return (role ?? '').toLowerCase() === 'waiter';
}

export interface OrderWithShares {
  serviceCharge?: number;
  /**
   * Base de comisión del mesonero, ya calculada por `computeOrderTotals`: ventas
   * atribuibles (o el servicio de esa venta, según `NominaConfig.commissionBasis`).
   * La comisión es `calcularComision(comisionBase, nomina)`. La propina va aparte
   * (tipAmount).
   */
  comisionBase?: number;
  tipAmount?: number;
  waiterShares?: Array<{ waiterId: string; pct: number }>;
}

/**
 * Fracción (0..1) que le corresponde al mesonero en una orden. Órdenes
 * traspasadas entre mesoneros llevan waiterShares con el % acordado:
 * comisión Y propina se dividen por ese % (decisión del dueño 16/07/2026).
 * Sin shares (caso normal) = 100%. Con shares pero sin share propio = 0
 * (la orden está en la lista por el share del otro; no debe sumar doble).
 */
export function shareFraction(
  order: OrderWithShares,
  waiterUserId?: string,
): number {
  if (!order.waiterShares?.length) return 1;
  if (!waiterUserId) return 1;
  const own = order.waiterShares.find((s) => s.waiterId === waiterUserId);
  return own ? own.pct / 100 : 0;
}

/**
 * Comisión de un mesonero en un conjunto de órdenes. Suma la base (ya repartida
 * por el share del mesonero) y aplica la tasa una sola vez, para redondear al final.
 */
export function weekCommission(
  orders: OrderWithShares[],
  nomina: NominaConfig = NOMINA_DEFAULT,
  waiterUserId?: string,
): number {
  const base = orders.reduce(
    (s, o) => s + (o.comisionBase ?? 0) * shareFraction(o, waiterUserId),
    0,
  );
  return calcularComision(base, nomina);
}

export function weekTips(
  orders: OrderWithShares[],
  waiterUserId?: string,
): number {
  return orders.reduce(
    (s, o) => s + (o.tipAmount ?? 0) * shareFraction(o, waiterUserId),
    0,
  );
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Deuda REAL de un consumo de personal: subtotal × (1 − descuento de empleado),
// SIN el servicio (el servicio es propina del mesonero; el personal no se la
// paga a sí mismo). `base` = subtotal de la(s) orden(es); si no se conoce, cae
// al `amount` del AR (que incluye servicio) como último recurso.
//
// OJO: la cuenta por cobrar se creó con el precio de CLIENTE (subtotal + servicio).
// Por eso saldar un consumo de personal se mide contra ESTA deuda, no contra el
// `amount`: si no, sobraba servicio + descuento como saldo fantasma que ninguna
// nómina cerraba.
export function staffDebt(
  ar: { amount: number },
  base: number | undefined,
  nomina: NominaConfig = NOMINA_DEFAULT,
): number {
  const b = base ?? ar.amount;
  return round2(b * (1 - nomina.employeeDiscountRate));
}

// base = subtotal de la(s) orden(es) SIN el servicio. Si no se conoce,
// se usa el monto del AR como base. Neto sugerido a retener hoy = deuda de
// personal menos lo ya pagado.
export function consumoNet(
  ar: { amount: number; paidAmount?: number },
  base: number | undefined,
  nomina: NominaConfig = NOMINA_DEFAULT,
): number {
  return Math.max(
    0,
    round2(staffDebt(ar, base, nomina) - (ar.paidAmount ?? 0)),
  );
}

/**
 * Cómo queda una cuenta por cobrar cuando se le aplica un descuento de nómina.
 *
 * El abono es lo que REALMENTE se le retuvo al trabajador: si no cubre el
 * saldo, la cuenta queda como pago parcial y sigue viva. Antes se marcaba
 * pagada al 100% aunque se hubiera descontado menos, y la diferencia
 * desaparecía sin quedar registrada como cobrada ni como pendiente.
 *
 * `target` = deuda que se debe saldar. Para un consumo de PERSONAL se pasa la
 * `staffDebt` (subtotal menos descuento de personal): así la cuenta se da por saldada cuando el
 * empleado pagó SU parte, sin arrastrar el saldo fantasma (servicio + descuento
 * que nunca debió cobrarse). Sin `target` se salda contra el `amount` completo
 * (cuentas de cliente o cuentas externas asumidas, que van sin descuento).
 */
export function payrollSettlement(
  ar: { amount: number; paidAmount?: number },
  abono: number,
  target?: number,
): {
  paidAmount: number;
  balance: number;
  isSettled: boolean;
  applied: number;
} {
  const meta = round2(target ?? ar.amount);
  const yaPagado = round2(ar.paidAmount ?? 0);
  const pendiente = Math.max(0, round2(meta - yaPagado));
  // Nunca se aplica más que el saldo ni montos negativos
  const applied = Math.min(
    Math.max(0, round2(Number.isFinite(abono) ? abono : 0)),
    pendiente,
  );
  const paidAmount = round2(yaPagado + applied);
  const balance = Math.max(0, round2(meta - paidAmount));
  return { paidAmount, balance, isSettled: balance <= 0.01, applied };
}

export function rowNet(parts: {
  earnings: number;
  commissions: number;
  tips: number;
  consumos: number;
}): number {
  const net = parts.earnings + parts.commissions + parts.tips - parts.consumos;
  return Math.max(0, Math.round(net * 100) / 100);
}

// Bruto del recibo: lo devengado (días + comisión + propina) más los ajustes de
// ADICIÓN. No resta nada; el neto final lo calcula finalNet.
export function grossPay(parts: {
  earnings: number;
  commissions: number;
  tips: number;
  adjustmentsAdd: number;
}): number {
  return round2(
    parts.earnings + parts.commissions + parts.tips + parts.adjustmentsAdd,
  );
}

// Neto final a pagar: neto (rowNet) + adiciones − deducciones − cuentas
// externas asumidas. Espeja el cálculo inline de WeeklyPayrollRow (no negativo
// no se fuerza aquí: puede quedar negativo si las deducciones superan al neto,
// igual que el inline original).
export function finalNet(parts: {
  net: number;
  adjustmentsAdd: number;
  adjustmentsDed: number;
  externalTotal: number;
  /**
   * Abonos a prestamos del empleado, en USD.
   *
   * Faltaba, y no era un detalle de pantalla. El 21/09/2026 el dueno reporto
   * que a Daniel le abonaba $20 de un prestamo de $100 y no se le
   * descontaba: la pantalla mostraba "Abono prestamo: −$20,00" y abajo
   * "Neto a pagar $67,21", que era exactamente el bruto mas el bono. La
   * linea se dibujaba desde `loanAbonoMap` y el total salia de aca, que no
   * sabia nada de prestamos.
   *
   * Lo caro es lo que pasaba al confirmar: el abono SI se registraba contra
   * el prestamo ($100 → $80) mientras al empleado se le pagaba completo. El
   * negocio perdia los $20 dos veces — no los retenia y los daba por
   * cobrados.
   *
   * Opcional para no romper a quien ya llamaba sin prestamos.
   */
  loansTotal?: number;
}): number {
  return round2(
    parts.net +
      parts.adjustmentsAdd -
      parts.adjustmentsDed -
      parts.externalTotal -
      (parts.loansTotal ?? 0),
  );
}

// nº de días calendario distintos en que hay órdenes (default mesonero)
export function distinctOrderDays(
  orders: Array<{ createdAt?: string | Date }>,
): number {
  const days = new Set<string>();
  for (const o of orders) {
    if (!o.createdAt) continue;
    const d = new Date(o.createdAt);
    if (!isNaN(d.getTime())) days.add(d.toISOString().slice(0, 10));
  }
  return days.size;
}
