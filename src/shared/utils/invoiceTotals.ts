/**
 * Calculo de los totales que se muestran al pie de una factura/cuenta por cobrar.
 *
 * Vive aparte del pdfGenerator para poder reusarse (PDF, WhatsApp, vistas) y
 * testearse sin depender de jsPDF.
 */

export interface InvoiceTotalsInput {
  subtotal?: number | null;
  tax?: number | null;
  tip?: number | null;
  total?: number | null;
  /** Abonos ya registrados sobre esta factura/cuenta. */
  paidAmount?: number | null;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  tip: number;
  /** Recargo por servicio: lo que queda del total tras subtotal + impuestos + propina. */
  serviceCharge: number;
  /** Total facturado (sin descontar abonos). */
  total: number;
  /** Abonado, saneado al rango [0, total]. */
  paid: number;
  /** Saldo pendiente por cobrar. */
  balance: number;
  /** true cuando hay abonos que mostrar (evita filas en cero). */
  hasPayments: boolean;
}

const safeNumber = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = safeNumber(input.subtotal);
  const tax = safeNumber(input.tax);
  const tip = safeNumber(input.tip);
  const total = safeNumber(input.total);

  const serviceCharge = Math.max(0, round2(total - subtotal - tax - tip));
  const paid = Math.min(Math.max(0, safeNumber(input.paidAmount)), total);
  const balance = Math.max(0, round2(total - paid));

  return {
    subtotal,
    tax,
    tip,
    serviceCharge,
    total,
    paid,
    balance,
    hasPayments: paid > 0.01,
  };
}
