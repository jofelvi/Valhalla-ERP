import { CANCELAR } from '../draft';
import type { ExpenseDraft, StepHandler } from '../draft';
import { convertir, fmtMoney } from '../../../expenses/money';
import { escapeHtml } from '../../../expenses/expenses-report.helper';

export function resumenDe(d: ExpenseDraft): string {
  const cur = d.currency ?? 'BS';
  const amount = d.amount ?? 0;
  const rate = d.exchangeRate ?? 0;
  // Sin tasa aun no hay con que convertir: se muestra el monto tal cual, en su moneda.
  const montoLinea = (() => {
    if (!rate) return `💰 ${fmtMoney(amount, cur)} (sin tasa)`;
    const { amountBs, amountUsd } = convertir(amount, cur, rate);
    return `💰 ${fmtMoney(amountBs, 'BS')} · ${fmtMoney(amountUsd, 'USD')} (tasa ${String(rate).replace('.', ',')})`;
  })();
  const lineas = [
    `<b>Resumen</b>`,
    d.kind === 'INSUMOS'
      ? `🥫 Insumos · ${escapeHtml(d.supplierName ?? '')}`
      : `🧾 ${escapeHtml(d.category ?? '')}${d.supplierName ? ` · ${escapeHtml(d.supplierName)}` : ''}`,
    d.kind === 'INSUMOS' ? `Categoría: ${escapeHtml(d.category ?? '')}` : null,
    // En un gasto de personal lo que importa es a quien se le dio, no una
    // descripcion: asi el resumen dice de quien es la deuda antes de confirmar.
    d.employeeName
      ? `👤 ${escapeHtml(d.employeeName)}`
      : d.description
        ? escapeHtml(d.description)
        : null,
    ...(d.kind === 'INSUMOS'
      ? d.lines.map(
          (l) =>
            `   • ${escapeHtml(l.productName ?? '?')} ${String(l.quantity ?? '?').replace('.', ',')} ${l.unit === 'unidad-compra' ? 'caja/bulto' : (l.unit ?? '')} × ${fmtMoney(l.unitCost ?? 0, cur)}`,
        )
      : []),
    montoLinea,
    d.paymentStatus === 'CREDIT'
      ? '📅 <b>CRÉDITO</b> (queda por pagar)'
      : `💵 Contado · Fondos: ${d.fundsSource === 'PROPIOS' ? 'Propios' : 'Negocio'}`,
  ];
  return lineas.filter((l): l is string => Boolean(l)).join('\n');
}

export const summaryStep: StepHandler = {
  async prompt(draft, deps) {
    // El mismo Pago Movil fotografiado dos veces se registraba dos veces sin
    // que nadie lo notara (Ridery de Bs 2.118,61, 17/09/2026). Se avisa; no se
    // bloquea, por si de verdad es otro pago.
    const previo = await deps.possibleDuplicate(draft);
    const aviso = previo
      ? `⚠️ <b>Ojo: este pago parece ya registrado.</b>\nEl ${escapeHtml(previo.cuando)} ${escapeHtml(previo.socio)} cargó uno con el mismo número de operación: ${escapeHtml(previo.category)}${previo.description ? ` · ${escapeHtml(previo.description)}` : ''}.\nSi es el mismo, toca Cancelar.\n\n`
      : '';
    return {
      text: `${aviso}${resumenDe(draft)}\n\n¿Registrar?`,
      buttons: [
        [
          { label: '✅ Confirmar', data: 'sum:ok' },
          { label: '✏️ Corregir', data: 'sum:edit' },
        ],
        [CANCELAR],
      ],
    };
  },
  async handle(input, draft) {
    if (input.kind === 'callback' && input.data === 'sum:ok')
      return { draft, next: 'DONE' };
    if (input.kind === 'callback' && input.data === 'sum:edit')
      return { draft, next: 'KIND' };
    // Tras un rechazo del inventario lo que hay que corregir es un renglon.
    // Volver a KIND pasaba otra vez por el proveedor, que relee la factura y
    // borraba todas las correcciones hechas a mano.
    if (input.kind === 'callback' && input.data === 'sum:lineas') {
      return {
        draft: { ...draft, editingLine: null, searchingLine: null },
        next: draft.kind === 'INSUMOS' ? 'LINES' : 'KIND',
      };
    }
    return {
      draft,
      next: 'STAY',
      reply: { text: 'Toca Confirmar, Corregir o Cancelar.' },
    };
  },
};
