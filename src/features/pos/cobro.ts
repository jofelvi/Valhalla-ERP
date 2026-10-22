// Utilidades PURAS para cálculos de cobro
// SIN React, SIN hooks, SIN fetch — solo números y objetos
// CRITICO: Estos cálculos manejan dinero. NO cambies las fórmulas.

import { bsToUsd, PaymentMethodEnum } from '@odin6/types';

/**
 * Calcula el total pagado en USD equivalente
 * Usa aritmética en Bs para evitar errores de punto flotante al dividir
 *
 * `cardAmountInBs`: el punto de venta vive en cardPayments, NO en
 * paymentAmounts. Hasta el 18/09 esta funcion no lo recibia (sus hermanas
 * si): un cobro solo con punto contaba $0, el boton quedaba en 'Ingrese un
 * monto', y en un cobro mixto la orden podia quedar PARCIAL estando cubierta.
 */
export function calculateTotalPaid(
  paymentAmounts: Record<PaymentMethodEnum, string>,
  bcvRate: number,
  cardAmountInBs: number = 0,
): number {
  if (bcvRate <= 0) {
    const cashUsd = parseFloat(paymentAmounts[PaymentMethodEnum.CASH_USD]) || 0;
    const transfer =
      parseFloat(paymentAmounts[PaymentMethodEnum.TRANSFER]) || 0;
    const pagoMovil =
      parseFloat(paymentAmounts[PaymentMethodEnum.PAGO_MOVIL]) || 0;
    const pagoMovilManual =
      parseFloat(paymentAmounts[PaymentMethodEnum.PAGO_MOVIL_MANUAL]) || 0;
    return (
      Math.round((cashUsd + transfer + pagoMovil + pagoMovilManual) * 100) / 100
    );
  }
  // Convertir el total pagado en Bs a USD de una sola vez
  return bsToUsd(
    calculateTotalPaidInBs(paymentAmounts, bcvRate, cardAmountInBs),
    bcvRate,
  );
}

/**
 * Calcula el total pagado en Bs directamente (sin convertir a USD)
 * Evita la pérdida de precisión al dividir Bs / tasa BCV
 */
export function calculateTotalPaidInBs(
  paymentAmounts: Record<PaymentMethodEnum, string>,
  bcvRate: number,
  cardAmountInBs: number = 0,
): number {
  const cashBs = parseFloat(paymentAmounts[PaymentMethodEnum.CASH_BS]) || 0;
  const cashUsd = parseFloat(paymentAmounts[PaymentMethodEnum.CASH_USD]) || 0;
  const transfer = parseFloat(paymentAmounts[PaymentMethodEnum.TRANSFER]) || 0;
  const pagoMovil =
    parseFloat(paymentAmounts[PaymentMethodEnum.PAGO_MOVIL]) || 0;
  const pagoMovilManual =
    parseFloat(paymentAmounts[PaymentMethodEnum.PAGO_MOVIL_MANUAL]) || 0;
  // cashBs y cardBs ya están en Bs; el resto (USD) se convierten a Bs
  return (
    cashBs +
    cardAmountInBs +
    (cashUsd + transfer + pagoMovil + pagoMovilManual) * bcvRate
  );
}

/**
 * Verifica si el pago cubre el total restante (descontando pagos previos)
 * Compara en Bs para evitar el error de redondeo al convertir Bs→USD→Bs
 */
export function isPaymentComplete(
  paymentAmounts: Record<PaymentMethodEnum, string>,
  bcvRate: number,
  remainingToPay: number,
  cardAmountInBs: number = 0,
): boolean {
  if (bcvRate <= 0) {
    return calculateTotalPaid(paymentAmounts, bcvRate) >= remainingToPay;
  }
  const totalPaidInBs = calculateTotalPaidInBs(
    paymentAmounts,
    bcvRate,
    cardAmountInBs,
  );
  const totalDueInBs = remainingToPay * bcvRate;
  // Tolerancia de 2 Bs para errores de redondeo en doble conversión Bs→USD→Bs
  return totalPaidInBs >= totalDueInBs - 2;
}

/**
 * Calcula el total de seleccionadas (cuentas por cobrar)
 */
export function calculateSelectedReceivablesTotal(
  selectedReceivables: Set<string>,
  customerReceivables: Array<{
    id: string;
    amount: number;
    paidAmount: number;
  }>,
): number {
  return customerReceivables
    .filter((r) => selectedReceivables.has(r.id))
    .reduce((sum, r) => sum + (r.amount - r.paidAmount), 0);
}

/**
 * Suma todos los montos de tarjetas (para múltiples tarjetas)
 */
export function getTotalCardAmount(
  cardPayments: Array<{ amount: string; reference: string }>,
): number {
  return cardPayments.reduce(
    (sum, entry) => sum + (parseFloat(entry.amount) || 0),
    0,
  );
}

/**
 * Calcula el vuelto en Bs
 */
export function calculateChangeBs(
  totalPaidInBs: number,
  remainingToPay: number,
  bcvRate: number,
): number {
  return totalPaidInBs - remainingToPay * bcvRate;
}

/**
 * Calcula el vuelto en USD
 */
export function calculateChangeUsd(changeBs: number, bcvRate: number): number {
  return bcvRate > 0 ? changeBs / bcvRate : changeBs;
}

/**
 * Valida que el pago no supere el techo (auditoria 19/08/2026)
 * Retorna la diferencia si hay exceso, 0 si es válido
 */
export function getPaymentExcess(
  totalPaid: number,
  remainingToPay: number,
): number {
  const tolerancia = Math.max(1, remainingToPay * 0.02);
  const exceso = totalPaid - remainingToPay;
  return exceso > tolerancia ? exceso : 0;
}

/**
 * Tolerancia ÚNICA (en Bs) para el redondeo de la doble conversión Bs→USD→Bs.
 * Dentro de ±TOLERANCIA_BS el pago se considera exacto: ni falta ni hay vuelto.
 * Antes esta pantalla usaba 0.01 para decidir el vuelto y 2 para "falta", así
 * que el mismo cobro podía mostrar vuelto y estar "completo" al mismo tiempo.
 * Es el mismo valor que usa isPaymentComplete.
 */
export const TOLERANCIA_BS = 2;

/** ¿El sobrepago en Bs supera la tolerancia y por tanto hay vuelto que dar? */
export function hayVuelto(changeBs: number): boolean {
  return changeBs > TOLERANCIA_BS;
}

/** ¿Falta dinero en Bs por encima de la tolerancia? Devuelve 0 si está cubierto. */
export function faltaPorPagarBs(
  remainingInBs: number,
  totalPaidInBs: number,
): number {
  const diff = remainingInBs - totalPaidInBs;
  return diff > TOLERANCIA_BS ? diff : 0;
}

/**
 * Monto por defecto que se autocompleta al elegir un método de pago, ya
 * descontando lo que el cajero lleva ingresado en ESTA sesión.
 * Base = remainingToPay (que ya resta pagos previos y crédito de socio); NO
 * totalWithTip. Bug medido el 07/09: con pagos previos o crédito de socio se
 * autocompletaba de más y luego el techo anti-cobro-doble rechazaba el cobro.
 */
export function montoRestantePorPagar(args: {
  remainingToPay: number;
  totalSesionUsd: number;
  totalSesionBs: number;
  bcvRate: number;
  enBolivares: boolean;
}): number {
  const {
    remainingToPay,
    totalSesionUsd,
    totalSesionBs,
    bcvRate,
    enBolivares,
  } = args;
  if (enBolivares) {
    return bcvRate > 0 ? remainingToPay * bcvRate - totalSesionBs : 0;
  }
  return remainingToPay - totalSesionUsd;
}

/**
 * Verifica si el total pagado acumulado cubre de verdad el total debido
 * (orden + propina + cuentas por cobrar seleccionadas), aplicando una
 * tolerancia de seguridad en USD (default $0.50).
 */
export function isReallyFullyPaid(
  allTimePaid: number,
  requiredTotal: number,
  toleranceUsd: number = 0.5,
): boolean {
  return allTimePaid >= requiredTotal - toleranceUsd;
}
