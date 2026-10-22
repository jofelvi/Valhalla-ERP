import { draftVacio, StepDeps, TipoCompra } from '../draft';
import { typeStep } from './type.step';

const TIPOS: TipoCompra[] = [
  { key: 'VEGETALES', label: '🥬 Vegetales' },
  { key: 'CARNES', label: '🥩 Carnes' },
  { key: 'BEBIDAS', label: '🥤 Bebidas' },
  { key: 'OTROS', label: '📦 Otros' },
];

const deps = (over: Partial<StepDeps> = {}): StepDeps =>
  ({
    listPurchaseTypes: jest.fn().mockResolvedValue(TIPOS),
    listFrequentProducts: jest.fn().mockResolvedValue([]),
    lastPurchase: jest.fn().mockResolvedValue(null),
    ...over,
  }) as unknown as StepDeps;

describe('typeStep', () => {
  it('ofrece los tipos configurados y los deja en el draft', async () => {
    const d = { ...draftVacio('u', '', null), kind: 'INSUMOS' as const };
    const r = await typeStep.prompt(d, deps());
    expect(r.buttons?.flat().map((b) => b.data)).toEqual([
      'tipo:VEGETALES',
      'tipo:CARNES',
      'tipo:BEBIDAS',
      'tipo:OTROS',
      'cancel',
    ]);
    expect(d.typeOptions).toEqual(TIPOS);
  });

  it('elegir un tipo lo guarda y sigue al monto', async () => {
    const d = { ...draftVacio('u', '', null), kind: 'INSUMOS' as const, typeOptions: TIPOS };
    const r = await typeStep.handle({ kind: 'callback', data: 'tipo:VEGETALES' }, d, deps());
    expect(r.draft.purchaseType).toBe('VEGETALES');
    expect(r.next).toBe('AMOUNT');
  });

  it('un tipo que ya no existe en la config no pasa', async () => {
    const d = { ...draftVacio('u', '', null), kind: 'INSUMOS' as const };
    const r = await typeStep.handle({ kind: 'callback', data: 'tipo:FRUTAS' }, d, deps());
    expect(r.next).toBe('STAY');
    expect(r.draft.purchaseType).toBeNull();
  });

  it('texto libre se queda en el paso', async () => {
    const d = { ...draftVacio('u', '', null), kind: 'INSUMOS' as const };
    expect((await typeStep.handle({ kind: 'text', text: 'vegetales' }, d, deps())).next).toBe('STAY');
  });
});
