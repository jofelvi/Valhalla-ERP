import { CANCELAR } from '../draft';
import type { StepHandler } from '../draft';

export const paymentStep: StepHandler = {
  async prompt() {
    return {
      text: '¿Cómo se pagó?',
      buttons: [[{ label: '💵 Contado', data: 'pay:PAID' }, { label: '📅 Crédito', data: 'pay:CREDIT' }], [CANCELAR]],
    };
  },
  async handle(input, draft) {
    if (input.kind === 'callback' && input.data === 'pay:PAID') return { draft: { ...draft, paymentStatus: 'PAID' }, next: 'FUNDS' };
    if (input.kind === 'callback' && input.data === 'pay:CREDIT') return { draft: { ...draft, paymentStatus: 'CREDIT', fundsSource: null }, next: 'SUMMARY' };
    return { draft, next: 'STAY', reply: { text: 'Toca Contado o Crédito.' } };
  },
};
