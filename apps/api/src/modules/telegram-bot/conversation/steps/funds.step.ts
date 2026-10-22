import { CANCELAR } from '../draft';
import type { StepHandler } from '../draft';

export const fundsStep: StepHandler = {
  async prompt() {
    return {
      text: '¿Con qué fondos se pagó?',
      buttons: [
        [
          { label: '🏢 Negocio', data: 'funds:EMPRESA' },
          { label: '👤 Propios', data: 'funds:PROPIOS' },
        ],
        [CANCELAR],
      ],
    };
  },
  async handle(input, draft) {
    if (input.kind === 'callback' && input.data === 'funds:EMPRESA')
      return { draft: { ...draft, fundsSource: 'EMPRESA' }, next: 'SUMMARY' };
    if (input.kind === 'callback' && input.data === 'funds:PROPIOS')
      return { draft: { ...draft, fundsSource: 'PROPIOS' }, next: 'SUMMARY' };
    return { draft, next: 'STAY', reply: { text: 'Toca Negocio o Propios.' } };
  },
};
