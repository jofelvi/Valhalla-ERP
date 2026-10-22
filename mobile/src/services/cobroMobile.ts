import { bsToUsd, usdToBs, seIngresaEnBolivares, pareceOtraMoneda } from './money.ts';

export interface PaymentEntryLike {
  method: string;
  amount: string | number;
  confirmed?: boolean;
}

/**
 * Suma el total pagado en USD de las entradas de pago.
 * Si un método es en Bs y bcvRate > 0, usa bsToUsd(amt, bcvRate).
 * Si bcvRate <= 0, los montos en Bs NO se suman (evita envenenar USD con Bs).
 */
export function totalPagadoUsd(
  entries: PaymentEntryLike[],
  bcvRate: number,
  onlyConfirmed: boolean = false,
): number {
  let total = 0;
  for (const entry of entries) {
    if (onlyConfirmed && entry.confirmed === false) continue;
    const amt =
      typeof entry.amount === 'number'
        ? entry.amount
        : parseFloat(entry.amount) || 0;
    if (amt <= 0) continue;

    if (seIngresaEnBolivares(entry.method)) {
      if (bcvRate > 0) {
        total += bsToUsd(amt, bcvRate);
      }
      // Con bcvRate <= 0, NO sumar: evita sumar miles de Bs a un campo en USD
    } else {
      total += amt;
    }
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/**
 * Suma el total pagado en Bolívares de las entradas de pago.
 * Si un método es en USD y bcvRate > 0, lo convierte a Bs con usdToBs.
 * Si bcvRate <= 0, los métodos en USD no se pueden convertir a Bs.
 */
export function totalPagadoBs(
  entries: PaymentEntryLike[],
  bcvRate: number,
  onlyConfirmed: boolean = false,
): number {
  let total = 0;
  for (const entry of entries) {
    if (onlyConfirmed && entry.confirmed === false) continue;
    const amt =
      typeof entry.amount === 'number'
        ? entry.amount
        : parseFloat(entry.amount) || 0;
    if (amt <= 0) continue;

    if (seIngresaEnBolivares(entry.method)) {
      total += amt;
    } else if (bcvRate > 0) {
      total += usdToBs(amt, bcvRate);
    }
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/**
 * Determina si el pago cubre el total requerido de la orden.
 * Compara en Bolívares con una tolerancia de borde cuando hay tasa BCV.
 * Sin tasa BCV válida (> 0), retorna false.
 */
export function pagoCompleto(
  entries: PaymentEntryLike[],
  bcvRate: number,
  totalUsd: number,
  onlyConfirmed: boolean = false,
): boolean {
  if (bcvRate <= 0 || totalUsd <= 0) return false;
  const paidBs = totalPagadoBs(entries, bcvRate, onlyConfirmed);
  const dueBs = totalUsd * bcvRate;
  return paidBs >= dueBs - 0.5;
}

/**
 * Verifica si alguno de los montos ingresados parece otra moneda
 * (ej. montos en Bs ingresados en un campo en USD).
 */
export function validarTechoMoneda(
  amountUsd: number,
  orderTotal?: number,
): { error: boolean; mensaje?: string } {
  if (pareceOtraMoneda(amountUsd, orderTotal)) {
    return {
      error: true,
      mensaje: `El monto de $${amountUsd.toFixed(2)} parece estar en bolívares (supera ampliamente el total de la orden).`,
    };
  }
  return { error: false };
}
