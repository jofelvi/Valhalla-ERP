import { InlineKeyboard } from 'grammy';
import type { Boton } from './conversation/draft';

/** Arma el teclado inline a partir de filas de botones. Sin fila vacia al final. */
export function teclado(buttons?: Boton[][]): InlineKeyboard | undefined {
  if (!buttons?.length) return undefined;
  const kb = new InlineKeyboard();
  buttons.forEach((fila, i) => {
    for (const b of fila) kb.text(b.label, b.data);
    if (i < buttons.length - 1) kb.row();
  });
  return kb;
}
