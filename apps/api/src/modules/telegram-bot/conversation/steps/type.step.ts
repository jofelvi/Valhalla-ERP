import { CANCELAR, StepHandler } from '../draft';

/**
 * ¿QUE SE COMPRO? Vegetales, carnes, bebidas u otros.
 *
 * No es la categoria contable (esa se pregunta al final): sirve para que el bot
 * ofrezca la lista de lo que SIEMPRE se compra de ese tipo. Una compra de
 * verduras son 20 renglones escritos a mano que el OCR casi nunca lee bien —
 * con los botones se tocan y listo.
 */
export const typeStep: StepHandler = {
  async prompt(draft, deps) {
    const tipos = await deps.listPurchaseTypes();
    draft.typeOptions = tipos;
    const filas = tipos.map((t) => [{ label: t.label, data: `tipo:${t.key}` }]);
    filas.push([CANCELAR]);
    return { text: '¿Qué tipo de compra es?', buttons: filas };
  },

  async handle(input, draft, deps) {
    if (input.kind !== 'callback' || !input.data.startsWith('tipo:')) {
      return { draft, next: 'STAY', reply: { text: 'Toca uno de los botones 👆' } };
    }
    const key = input.data.slice(5);
    // Las opciones pueden venir de una sesion vieja (config editada en Mongo):
    // si no estan en el draft se vuelven a leer antes de rechazar el toque.
    const tipos = draft.typeOptions.length ? draft.typeOptions : await deps.listPurchaseTypes();
    const elegido = tipos.find((t) => t.key === key);
    if (!elegido) return { draft, next: 'STAY', reply: { text: 'No reconocí ese tipo. Toca un botón 👆' } };
    return { draft: { ...draft, purchaseType: elegido.key }, next: 'AMOUNT' };
  },
};
