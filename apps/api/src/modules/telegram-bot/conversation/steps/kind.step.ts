import { CANCELAR, StepHandler } from '../draft';

export const kindStep: StepHandler = {
  async prompt() {
    return {
      // "Gasto", no "compra": un préstamo o un sueldo no se compran.
      text: '¿Qué es este gasto?',
      buttons: [
        [
          { label: '🥫 Insumos (inventario)', data: 'kind:INSUMOS' },
          { label: '🧾 Gasto general', data: 'kind:GENERAL' },
        ],
        [CANCELAR],
      ],
    };
  },
  async handle(input, draft) {
    if (input.kind === 'callback' && input.data === 'kind:INSUMOS')
      return { draft: { ...draft, kind: 'INSUMOS' }, next: 'SUPPLIER' };
    if (input.kind === 'callback' && input.data === 'kind:GENERAL')
      // Un gasto general arranca por QUE tipo de gasto es: el proveedor casi
      // nunca aplica (un Pago Movil del banco no tiene "donde se compro") y se
      // pregunta mas abajo, opcional.
      return { draft: { ...draft, kind: 'GENERAL' }, next: 'CATEGORY' };
    return { draft, next: 'STAY', reply: { text: 'Toca uno de los botones 👆' } };
  },
};
