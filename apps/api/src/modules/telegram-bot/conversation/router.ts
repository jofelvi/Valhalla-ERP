import type { ExpenseDraft, Reply, Step, StepDeps, StepHandler, StepInput } from './draft';
import { kindStep } from './steps/kind.step';
import { supplierStep } from './steps/supplier.step';
import { typeStep } from './steps/type.step';
import { amountStep } from './steps/amount.step';
import { linesStep } from './steps/lines.step';
import { categoryStep } from './steps/category.step';
import { descriptionStep } from './steps/description.step';
import { paymentStep } from './steps/payment.step';
import { fundsStep } from './steps/funds.step';
import { summaryStep, resumenDe } from './steps/summary.step';
import { conAtras, limpiarEnCurso, pasoAnterior } from './atras';

export { resumenDe };

export const STEPS: Record<Step, StepHandler> = {
  KIND: kindStep,
  SUPPLIER: supplierStep,
  TYPE: typeStep,
  AMOUNT: amountStep,
  LINES: linesStep,
  CATEGORY: categoryStep,
  DESCRIPTION: descriptionStep,
  PAYMENT: paymentStep,
  FUNDS: fundsStep,
  SUMMARY: summaryStep,
};

export type Avance =
  | { kind: 'continuar'; step: Step; draft: ExpenseDraft; replies: Reply[] }
  | { kind: 'listo'; draft: ExpenseDraft }
  | { kind: 'cancelado' };

export async function arrancar(draft: ExpenseDraft, deps: StepDeps): Promise<Avance> {
  const reply = await STEPS.KIND.prompt(draft, deps);
  return { kind: 'continuar', step: 'KIND', draft, replies: [reply] };
}

/** Todo lo que sale de un paso lleva su salida hacia atras. */
const conSalida = (replies: Reply[], step: Step, draft: ExpenseDraft): Reply[] =>
  replies.map((r) => conAtras(r, step, draft));

/**
 * Un turno de conversacion: el paso actual procesa la entrada y dice a donde
 * ir. Si cambia de paso, el siguiente se presenta enseguida (un solo mensaje
 * de ida y vuelta por pregunta).
 */
export async function avanzar(
  session: { step: Step; draft: ExpenseDraft },
  input: StepInput,
  deps: StepDeps,
): Promise<Avance> {
  if (input.kind === 'callback' && input.data === 'cancel') return { kind: 'cancelado' };

  // Atras es de la conversacion, no de un paso: cualquiera puede desandar.
  if (input.kind === 'callback' && input.data === 'back') {
    const previo = pasoAnterior(session.step, session.draft);
    if (previo) {
      const draft = limpiarEnCurso(session.draft);
      const prompt = await STEPS[previo].prompt(draft, deps);
      return { kind: 'continuar', step: previo, draft, replies: conSalida([prompt], previo, draft) };
    }
    // Ya esta en el primero: se repite la pregunta en vez de no hacer nada.
    const prompt = await STEPS[session.step].prompt(session.draft, deps);
    return { kind: 'continuar', step: session.step, draft: session.draft, replies: [prompt] };
  }

  const handler = STEPS[session.step];
  const r = await handler.handle(input, session.draft, deps);
  const replies: Reply[] = r.reply ? [r.reply] : [];

  if (r.next === 'CANCEL') return { kind: 'cancelado' };
  if (r.next === 'DONE') return { kind: 'listo', draft: r.draft };
  if (r.next === 'STAY') {
    if (!replies.length) replies.push(await handler.prompt(r.draft, deps));
    return {
      kind: 'continuar',
      step: session.step,
      draft: r.draft,
      replies: conSalida(replies, session.step, r.draft),
    };
  }
  const prompt = await STEPS[r.next].prompt(r.draft, deps);
  return {
    kind: 'continuar',
    step: r.next,
    draft: r.draft,
    // El aviso que deja el paso viejo se manda tal cual; el atras corresponde
    // a la pregunta NUEVA, que es donde el socio esta parado.
    replies: [...replies, ...conSalida([prompt], r.next, r.draft)],
  };
}
