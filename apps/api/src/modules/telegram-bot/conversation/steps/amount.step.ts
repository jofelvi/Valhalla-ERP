import { CANCELAR, parseMonto, StepHandler, Step, ExpenseDraft } from '../draft';
import type { Boton } from '../draft';
import type { MontoCandidato } from '../../../ocr/invoice-header-parser';
import type { ExpenseCurrency } from '../../../expenses/schemas/expense.schema';
import { fmtMoney } from '../../../expenses/money';

// En insumos siguen los renglones de la factura; en un gasto general la
// categoria ya se pregunto al principio, asi que sigue la descripcion.
const siguiente = (d: ExpenseDraft): Step => (d.kind === 'INSUMOS' ? 'LINES' : 'DESCRIPTION');

/** Botones de dos en dos: en el telefono, uno por fila obliga a hacer scroll. */
const filasDeDos = (bs: Boton[]): Boton[][] =>
  bs.reduce<Boton[][]>((filas, b, i) => (i % 2 ? (filas[filas.length - 1].push(b), filas) : [...filas, [b]]), []);

/**
 * Los otros montos que la factura ofrece, sin el que ya se propuso.
 *
 * Una factura seria trae varios —total, subtotal, IVA, "deuda actual", el
 * mismo importe en Bs y en $— y el parser no puede saber cual se pago. "el
 * usuario sabe cual es" (dueño, 17/09/2026), asi que se ponen en botones.
 */
const otrosMontos = (d: ExpenseDraft): MontoCandidato[] =>
  (d.amountOptions ?? [])
    // Un borrador anterior a 1.7.1 guardaba numeros sueltos, sin moneda.
    .map((m) => (typeof m === 'number' ? { monto: m, moneda: null } : m))
    .filter((m) => !d.amount || Math.abs(m.monto - d.amount) > 0.005 || (m.moneda && m.moneda !== d.currency))
    .slice(0, 4);

export const amountStep: StepHandler = {
  async prompt(draft) {
    const otros = otrosMontos(draft);
    const texto =
      draft.amount && draft.currency
        ? otros.length
          ? `Leí ${fmtMoney(draft.amount, draft.currency)} — ¿es ese el total?\nLa factura trae más de un monto; si es otro, tócalo.`
          : `Leí ${fmtMoney(draft.amount, draft.currency)} — ¿es el total correcto?\nSi no, escribe el monto.`
        : draft.amount
          ? `Leí ${String(draft.amount)} pero no sé la moneda. Elige la moneda y confirma, o escribe el monto.`
          : 'No pude leer el total. Escribe el monto (ej: 18450 o 245,50).';
    return {
      text: texto,
      buttons: [
        // El boton dice la moneda: al confirmar el monto se confirma tambien
        // en que moneda esta, y eso no se veia ("le di un si y no me pregunto
        // lo de bs o usd", dueño 17/09/2026).
        [{ label: draft.amount ? `✅ Sí, son ${draft.currency === 'USD' ? 'dólares' : 'bolívares'}` : '✅ Sí', data: 'amt:ok' }],
        // Un boton por cada otro monto de la factura, en filas de dos.
        // Cada monto con SU moneda: la nota de Coca-Cola trae "$54,49" y
        // "Bs 6.368,68" en la misma hoja, y el IVA en Bs no puede aparecer
        // como si fueran dolares.
        ...filasDeDos(otros.map((m, i) => ({ label: fmtMoney(m.monto, m.moneda ?? draft.currency ?? 'BS'), data: `amt:${i}` }))),
        [
          { label: 'Es en Bs', data: 'cur:BS' },
          { label: 'Es en $', data: 'cur:USD' },
        ],
        [CANCELAR],
      ],
    };
  },

  async handle(input, draft, deps) {
    // Tocar uno de los montos de la factura: se adopta y se confirma solo.
    if (input.kind === 'callback' && /^amt:\d+$/.test(input.data)) {
      const elegido = otrosMontos(draft)[Number(input.data.slice(4))];
      if (elegido === undefined) {
        return { draft, next: 'STAY', reply: { text: 'Ese monto ya no está en la lista. Tócalo de nuevo o escríbelo.' } };
      }
      draft = { ...draft, amount: elegido.monto, currency: elegido.moneda ?? draft.currency };
      input = { kind: 'callback', data: 'amt:ok' };
    }
    if (draft.awaitingManualRate) {
      if (input.kind !== 'text') {
        return { draft, next: 'STAY', reply: { text: 'Escribe la tasa BCV (ej: 36,5).' } };
      }
      const rate = parseMonto(input.text);
      if (!rate) return { draft, next: 'STAY', reply: { text: 'No entendí la tasa. Ejemplo: 36,5' } };
      const d = { ...draft, exchangeRate: rate, awaitingManualRate: false };
      return { draft: d, next: siguiente(d) };
    }

    if (input.kind === 'callback' && (input.data === 'cur:BS' || input.data === 'cur:USD')) {
      const currency: ExpenseCurrency = input.data === 'cur:BS' ? 'BS' : 'USD';
      const d = { ...draft, currency };
      return {
        draft: d,
        next: 'STAY',
        reply: d.amount
          ? { text: `Queda en ${fmtMoney(d.amount, currency)}. ¿Confirmas?`, buttons: [[{ label: '✅ Sí', data: 'amt:ok' }], [CANCELAR]] }
          : { text: `Moneda: ${currency === 'BS' ? 'Bs' : '$'}. Ahora escribe el monto.` },
      };
    }

    let d = draft;
    if (input.kind === 'text') {
      const n = parseMonto(input.text);
      if (!n) return { draft, next: 'STAY', reply: { text: 'No entendí el monto. Ejemplos: 18450 · 18.450,00 · 245,50' } };
      d = { ...draft, amount: n };
    } else if (input.data !== 'amt:ok') {
      return { draft, next: 'STAY', reply: { text: 'Toca ✅ o escribe el monto.' } };
    }

    if (!d.amount) return { draft: d, next: 'STAY', reply: { text: 'Falta el monto. Escríbelo.' } };
    if (!d.currency) {
      return {
        draft: d,
        next: 'STAY',
        reply: {
          text: '¿En qué moneda?',
          buttons: [
            [
              { label: 'Bs', data: 'cur:BS' },
              { label: '$', data: 'cur:USD' },
            ],
          ],
        },
      };
    }
    if (d.exchangeRate) return { draft: d, next: siguiente(d) };

    const { rate, source } = await deps.bcvRate();
    if (source === 'fallback') {
      // El BCV no se pudo leer: la tasa de respaldo puede estar muy lejos de
      // la real y descuadra el gasto en Bs. Mejor pedirla a mano que
      // adoptarla en silencio.
      return {
        draft: { ...d, awaitingManualRate: true },
        next: 'STAY',
        reply: { text: `⚠️ No pude leer la tasa BCV (respaldo ${String(rate).replace('.', ',')}). Escribe la tasa real (ej: 36,5)` },
      };
    }
    return { draft: { ...d, exchangeRate: rate }, next: siguiente(d) };
  },
};
