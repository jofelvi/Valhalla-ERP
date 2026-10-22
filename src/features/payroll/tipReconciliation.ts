import { Order, PendingPaymentEntry } from '@odin6/types';

/**
 * Cotejo de la propina declarada contra lo que realmente se cobró.
 *
 * El mesonero teclea la propina al cerrar la orden, pero el monto que de verdad
 * pasó por el punto está en el comprobante: la diferencia entre lo cobrado y el
 * total de la orden es la propina REAL. Si declaró más que eso, se le estaría
 * pagando por nómina una propina que el cliente nunca dejó.
 *
 * Dos reglas que se aprendieron rompiendo esto contra datos reales:
 *
 * 1. El OCR CONFIRMA el monto tecleado, no lo reemplaza. `extractedAmountsBs`
 *    trae fragmentos sueltos del recibo (un pago de Bs 110.385 llegó a leerse
 *    como `[8]`). Si se toma el monto leído como verdad, órdenes perfectas
 *    aparecen como fraude de $150.
 * 2. Si lo cobrado no cubre el total, el cotejo NO concluye nada: son pagos
 *    mixtos donde parte se pagó en caja y `pendingPayments` solo guarda el
 *    tramo por verificar. Eso es `INCOMPLETE`, no propina inflada.
 */

export type TipCheckStatus =
  | 'MATCH' // la propina declarada = la diferencia real
  | 'NOT_CHARGED' // se cobró JUSTO el total y aun así declaró propina
  | 'OVER_DECLARED' // cobró algo de más, pero declaró más que eso
  | 'UNDER_DECLARED' // se cobró más de lo declarado (propina sin registrar)
  | 'OCR_DISPUTED' // el comprobante dice otro monto: la base está en disputa
  | 'INCOMPLETE' // lo cobrado no cubre el total: falta un tramo del pago
  | 'UNVERIFIABLE'; // efectivo, sin tasa o sin pagos registrados

/** Qué dice el comprobante sobre el monto que tecleó el mesonero. */
export type OcrAmountStatus =
  | 'CONFIRMED' // el OCR leyó el mismo monto que se tecleó
  | 'MISMATCH' // leyó montos y NINGUNO coincide → revisar a mano
  | 'NONE'; // sin OCR o sin montos legibles

/**
 * Con qué respaldo se cuenta para pagar la propina de esta orden.
 * Es la respuesta a "¿por qué le pago esto?".
 */
export type TipEvidence =
  | 'CONFIRMED' // el comprobante confirma el cobro → la propina sale de ahí
  | 'UNCONFIRMED' // hay pago registrado pero el OCR no pudo leer el monto
  | 'DISPUTED' // el comprobante dice otro monto: revisar la foto
  | 'NONE'; // efectivo o sin pagos: no hay contra qué cotejar

export interface TipCheck {
  status: TipCheckStatus;
  ocrAmount: OcrAmountStatus;
  evidence: TipEvidence;
  /** Bs cobrados según los pagos registrados. */
  chargedBs: number;
  /** Total de la orden llevado a Bs con la tasa del día. */
  orderTotalBs: number;
  /** Propina real = (cobrado − total) / tasa. */
  realTipUsd: number;
  declaredTipUsd: number;
  /** declarada − real. Positivo = declaró de más. */
  diffUsd: number;
  /**
   * Lo que corresponde pagarle por esta orden.
   *
   * Regla del dueño (27/07): el excedente cobrado cuenta como propina, se puede
   * declarar a mano, pero NUNCA puede superar lo que prueba el comprobante. Sin
   * monto legible en la foto no hay respaldo y se paga 0, por mucho que se haya
   * tecleado: es el único candado real contra inflar el cobro.
   */
  payableTipUsd: number;
  /** Techo: excedente que la foto respalda. 0 si no se pudo leer. */
  photoBackedTipUsd: number;
  /** Montos leídos que no cuadran con lo tecleado (para revisar la foto). */
  unmatchedOcrAmountsBs: number[];
}

/** Diferencia que se considera redondeo y no descuadre. */
export const TIP_TOLERANCE_USD = 0.1;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** El OCR lee con ruido: se acepta ±Bs 2 o ±0,5% del monto, lo que sea mayor. */
function ocrConfirms(readBs: number, declaredBs: number): boolean {
  const tolerance = Math.max(2, declaredBs * 0.005);
  return Math.abs(readBs - declaredBs) <= tolerance;
}

/**
 * Bs que la FOTO prueba que se cobraron. Por cada pago se toma el monto leído
 * del comprobante: el que confirma lo tecleado, o —si contradice— el que dice
 * el papel. Un tramo sin monto legible aporta 0: no hay prueba de ese dinero.
 *
 * Es el techo de la propina. Sin esto, el excedente se calcula con el monto que
 * teclea el propio mesonero, y ahí no hay control: se revisaron comprobantes
 * reales donde el cliente transfirió una cifra redonda (Bs 10.000 por una
 * cuenta de Bs 8.108) y el vuelto se estaba pagando como propina.
 */
function photoBackedBs(payments: PendingPaymentEntry[]): number {
  let total = 0;
  for (const payment of payments) {
    const read = payment.ocr?.extractedAmountsBs ?? [];
    if (read.length === 0) continue;
    const declared = payment.amountBs ?? 0;
    const confirming = read.find((amount) => ocrConfirms(amount, declared));
    // Sin confirmación se toma el MENOR de los leídos: ante duda, el monto que
    // menos propina genera. Nunca se le paga al mesonero por la duda.
    total += confirming ?? Math.min(...read);
  }
  return round2(total);
}

function ocrStatusOf(payments: PendingPaymentEntry[]): {
  status: OcrAmountStatus;
  unmatched: number[];
} {
  let legible = 0;
  const unmatched: number[] = [];

  for (const payment of payments) {
    const read = payment.ocr?.extractedAmountsBs ?? [];
    if (read.length === 0) continue;
    legible += 1;
    const declared = payment.amountBs ?? 0;
    if (read.some((amount) => ocrConfirms(amount, declared))) continue;
    unmatched.push(...read);
  }

  // MISMATCH exige una CONTRADICCION (el comprobante dice otro monto), no la
  // simple ausencia de lectura: en un pago mixto es normal que una foto sea
  // ilegible, y marcarlo como descuadre llenaba de falsas alarmas el filtro
  // de revision. Sin todos los tramos legibles no se afirma CONFIRMED.
  if (unmatched.length > 0) return { status: 'MISMATCH', unmatched };
  if (legible > 0 && legible === payments.length) {
    return { status: 'CONFIRMED', unmatched: [] };
  }
  return { status: 'NONE', unmatched: [] };
}

/**
 * Coteja una orden. `UNVERIFIABLE` cuando no hay con qué comparar (efectivo en
 * caja, sin tasa del día): ahí la propina se paga a ciegas y en la UI conviene
 * que se vea así en vez de darla por buena.
 */
export function checkOrderTip(order: Order): TipCheck {
  const rate = order.bcvRate ?? 0;
  const declaredTipUsd = round2(order.tipAmount ?? 0);
  const payments = order.pendingPayments ?? [];
  const orderTotalBs = round2((order.total ?? 0) * rate);

  const base: TipCheck = {
    status: 'UNVERIFIABLE',
    ocrAmount: 'NONE',
    evidence: 'NONE',
    chargedBs: 0,
    orderTotalBs,
    realTipUsd: 0,
    declaredTipUsd,
    diffUsd: 0,
    // Sin comprobante no hay respaldo: no se paga. Lo que se haya declarado
    // queda visible en la vista para que el dueno lo apruebe a mano si sabe
    // que la propina fue real (efectivo en la mesa, por ejemplo).
    payableTipUsd: 0,
    photoBackedTipUsd: 0,
    unmatchedOcrAmountsBs: [],
  };

  if (rate <= 0 || payments.length === 0) return base;

  const chargedBs = round2(
    payments.reduce((sum, p) => sum + (p.amountBs ?? 0), 0),
  );
  if (chargedBs <= 0) return base;

  const { status: ocrAmount, unmatched } = ocrStatusOf(payments);
  const realTipUsd = round2((chargedBs - orderTotalBs) / rate);
  const diffUsd = round2(declaredTipUsd - realTipUsd);
  const photoBackedTipUsd = Math.max(
    0,
    round2((photoBackedBs(payments) - orderTotalBs) / rate),
  );

  const evidence: TipEvidence =
    ocrAmount === 'CONFIRMED'
      ? 'CONFIRMED'
      : ocrAmount === 'MISMATCH'
        ? 'DISPUTED'
        : 'UNCONFIRMED';

  // Cobró menos que el total: falta un tramo del pago (mixto con caja).
  // No se puede afirmar nada de la propina con esto.
  if (realTipUsd < -TIP_TOLERANCE_USD) {
    return {
      ...base,
      status: 'INCOMPLETE',
      ocrAmount,
      evidence,
      chargedBs,
      realTipUsd,
      diffUsd,
      photoBackedTipUsd,
      unmatchedOcrAmountsBs: unmatched,
    };
  }

  let status: TipCheckStatus;
  if (Math.abs(diffUsd) <= TIP_TOLERANCE_USD) status = 'MATCH';
  else if (diffUsd > 0) status = 'OVER_DECLARED';
  else status = 'UNDER_DECLARED';

  // Si el comprobante dice OTRO monto, el numero con el que se calculo la
  // diferencia esta en disputa y el veredicto no puede acusar a nadie: un caso
  // real tenia el recibo en Bs 3.000 y lo tecleado en Bs 2.353,84 (el total
  // exacto), y con el monto del recibo la propina declarada cuadraba. Se marca
  // para revisar el comprobante, no como propina inflada.
  if (ocrAmount === 'MISMATCH' && status !== 'MATCH') {
    status = 'OCR_DISPUTED';
  }

  return {
    status,
    ocrAmount,
    evidence,
    chargedBs,
    orderTotalBs,
    realTipUsd,
    declaredTipUsd,
    diffUsd,
    // El candado, en dos capas: la propina no puede pasar del excedente que se
    // cobro, y ese excedente no puede pasar de lo que prueba la foto. Sin foto
    // legible el techo es 0. Se respeta lo declarado si es menor (puede haberse
    // devuelto vuelto), pero nunca se paga por encima de la evidencia.
    payableTipUsd: Math.max(
      0,
      Math.min(declaredTipUsd, realTipUsd, photoBackedTipUsd),
    ),
    photoBackedTipUsd,
    unmatchedOcrAmountsBs: unmatched,
  };
}

export interface TipCheckSummary {
  /** Lo que el mesonero tecleó en total. */
  declaredUsd: number;
  /** Lo que corresponde pagar según el cobro real. El número que importa. */
  payableUsd: number;
  /** Del pagable: respaldado por comprobante confirmado. */
  payableConfirmedUsd: number;
  /** Del pagable: hay pago pero el OCR no leyó el monto. */
  payableUnconfirmedUsd: number;
  /** Del pagable: el comprobante dice otro monto — mirar la foto. */
  payableDisputedUsd: number;
  /** Del pagable: sin comprobante (efectivo), se paga lo declarado a ciegas. */
  payableUnbackedUsd: number;
  overDeclared: number;
  /** Suma de lo declarado de más: lo que se pagaría sin respaldo. */
  overDeclaredUsd: number;
  underDeclared: number;
  incomplete: number;
  /** Órdenes con propina que no se pudieron cotejar. */
  unverifiable: number;
  unverifiableUsd: number;
  ocrMismatch: number;
}

export function summarizeTipChecks(checks: TipCheck[]): TipCheckSummary {
  return checks.reduce<TipCheckSummary>(
    (acc, c) => {
      acc.declaredUsd = round2(acc.declaredUsd + c.declaredTipUsd);
      acc.payableUsd = round2(acc.payableUsd + c.payableTipUsd);
      if (c.evidence === 'CONFIRMED') {
        acc.payableConfirmedUsd = round2(
          acc.payableConfirmedUsd + c.payableTipUsd,
        );
      } else if (c.evidence === 'DISPUTED') {
        acc.payableDisputedUsd = round2(
          acc.payableDisputedUsd + c.payableTipUsd,
        );
      } else if (c.evidence === 'UNCONFIRMED') {
        acc.payableUnconfirmedUsd = round2(
          acc.payableUnconfirmedUsd + c.payableTipUsd,
        );
      } else {
        acc.payableUnbackedUsd = round2(
          acc.payableUnbackedUsd + c.payableTipUsd,
        );
      }
      if (c.ocrAmount === 'MISMATCH') acc.ocrMismatch += 1;
      if (c.status === 'OVER_DECLARED') {
        acc.overDeclared += 1;
        acc.overDeclaredUsd = round2(acc.overDeclaredUsd + c.diffUsd);
      } else if (c.status === 'UNDER_DECLARED') {
        acc.underDeclared += 1;
      } else if (c.status === 'INCOMPLETE') {
        acc.incomplete += 1;
      } else if (c.status === 'UNVERIFIABLE' && c.declaredTipUsd > 0) {
        acc.unverifiable += 1;
        acc.unverifiableUsd = round2(acc.unverifiableUsd + c.declaredTipUsd);
      }
      return acc;
    },
    {
      declaredUsd: 0,
      payableUsd: 0,
      payableConfirmedUsd: 0,
      payableUnconfirmedUsd: 0,
      payableDisputedUsd: 0,
      payableUnbackedUsd: 0,
      overDeclared: 0,
      overDeclaredUsd: 0,
      underDeclared: 0,
      incomplete: 0,
      unverifiable: 0,
      unverifiableUsd: 0,
      ocrMismatch: 0,
    },
  );
}
