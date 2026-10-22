import type { Boton } from './conversation/draft';
import type { ExpenseLean } from '../expenses/schemas/expense.schema';
import {
  escapeHtml,
  fechaCorta,
  montoDe,
  etiquetaDe,
} from '../expenses/expenses-report.helper';
import { fmtStock } from '../expenses/money';
import type { BaseUnit } from '../inventory/units';
import type { OperacionConfig } from '@odin6/types';

/** Lo que sigue al comando ("/stock harina pan" -> "harina pan"), sin la mencion al bot. */
export function argumentoDe(texto: string): string {
  return texto.replace(/^\/\w+(?:@\w+)?\s*/, '').trim();
}

// Telegram corta el mensaje en 4096 chars y el teclado en 100 botones: con
// mas de esto en pantalla ctx.reply revienta y el socio solo ve "Algo fallo".
const TOPE_LISTA = 20;

export function textoPorPagar(
  gastos: ExpenseLean[],
  op: OperacionConfig,
  tope: number = TOPE_LISTA,
): { text: string; buttons: Boton[][] } {
  if (!gastos.length)
    return { text: '📅 Nada pendiente por pagar 🎉', buttons: [] };
  const visibles = gastos.slice(0, tope);
  const restantes = gastos.length - visibles.length;
  const lineas = visibles.map(
    (e, i) =>
      `${i + 1}) ${fechaCorta(e.date, op)} ${etiquetaDe(e)} — ${montoDe(e)}`,
  );
  const nota = restantes > 0 ? `\n…y ${restantes} más.` : '';
  return {
    text: `📅 <b>Por pagar</b>\n${lineas.join('\n')}\n\nToca el número para marcarlo pagado.${nota}`,
    buttons: visibles.map((e, i) => [
      { label: `${i + 1} 💵 Pagar`, data: `pay:id:${e._id}` },
    ]),
  };
}

export function textoReembolsos(
  gastos: ExpenseLean[],
  op: OperacionConfig,
  tope: number = TOPE_LISTA,
): { text: string; buttons: Boton[][] } {
  if (!gastos.length)
    return { text: '👤 Nada pendiente de reembolso', buttons: [] };
  const visibles = gastos.slice(0, tope);
  const restantes = gastos.length - visibles.length;
  const porSocio = new Map<string, ExpenseLean[]>();
  for (const e of visibles) {
    const k = e.paidBy ?? e.registeredBy.socio;
    porSocio.set(k, [...(porSocio.get(k) ?? []), e]);
  }
  const lineas: string[] = [];
  const buttons: Boton[][] = [];
  let n = 0;
  for (const [socio, lista] of porSocio) {
    lineas.push(`<b>El negocio le debe a ${escapeHtml(socio)}</b>`);
    for (const e of lista) {
      n += 1;
      lineas.push(
        `${n}) ${fechaCorta(e.date, op)} ${etiquetaDe(e)} — ${montoDe(e)}`,
      );
      buttons.push([{ label: `${n} ✔️ Reembolsado`, data: `reemb:${e._id}` }]);
    }
  }
  const nota = restantes > 0 ? `\n…y ${restantes} más.` : '';
  return {
    text: `👤 <b>Reembolsos pendientes</b>\n${lineas.join('\n')}${nota}`,
    buttons,
  };
}

export function textoStock(
  nombre: string,
  filas: Array<{ almacen: string; qty: number; baseUnit: BaseUnit }>,
): string {
  if (!filas.length)
    return `📦 <b>${escapeHtml(nombre)}</b>: sin stock registrado`;
  return [
    `📦 <b>${escapeHtml(nombre)}</b>`,
    ...filas.map(
      (f) => `• ${escapeHtml(f.almacen)}: ${fmtStock(f.qty, f.baseUnit)}`,
    ),
  ].join('\n');
}
