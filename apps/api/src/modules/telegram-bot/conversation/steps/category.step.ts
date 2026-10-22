import { CANCELAR } from '../draft';
import type { Boton, ExpenseDraft, Step, StepHandler } from '../draft';

/**
 * En un gasto general la categoria es la PRIMERA pregunta y el monto viene
 * despues; en insumos la categoria llega al final, ya con los renglones
 * cargados, y lo que sigue es la descripcion.
 */
const siguiente = (d: ExpenseDraft): Step => (d.kind === 'INSUMOS' ? 'DESCRIPTION' : 'AMOUNT');

export const categoryStep: StepHandler = {
  async prompt(draft, deps) {
    const todas = await deps.listCategories(draft.kind);
    draft.categoryOptions = todas;
    const filas: Boton[][] = [];
    for (let i = 0; i < todas.length; i += 2) {
      filas.push(todas.slice(i, i + 2).map((c, k) => ({ label: c, data: `cat:${i + k}` })));
    }
    filas.push([{ label: '✏️ Otra categoría', data: 'cat:otra' }], [CANCELAR]);
    return { text: '¿Categoría del gasto?', buttons: filas };
  },
  async handle(input, draft) {
    if (input.kind === 'callback') {
      if (input.data === 'cat:otra') return { draft: { ...draft, editingLine: -1 }, next: 'STAY', reply: { text: 'Escribe la categoría nueva:' } };
      const i = Number(input.data.replace('cat:', ''));
      const c = draft.categoryOptions[i];
      if (!c) return { draft, next: 'STAY', reply: { text: 'Toca una categoría o "Otra".' } };
      return { draft: { ...draft, category: c }, next: siguiente(draft) };
    }
    if (draft.editingLine === -1) {
      const c = input.text.trim();
      if (c.length < 3) return { draft, next: 'STAY', reply: { text: 'Muy corta. Escríbela de nuevo:' } };
      return { draft: { ...draft, category: c, editingLine: null }, next: siguiente(draft) };
    }
    // Texto directo tambien vale como categoria nueva: menos toques.
    const c = input.text.trim();
    if (c.length >= 3) return { draft: { ...draft, category: c, editingLine: null }, next: siguiente(draft) };
    return { draft, next: 'STAY', reply: { text: 'Toca una categoría o escribe una nueva.' } };
  },
};
