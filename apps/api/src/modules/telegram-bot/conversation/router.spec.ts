import { avanzar, arrancar, resumenDe } from './router';
import { draftVacio, ExpenseDraft, StepDeps } from './draft';

const deps = (): StepDeps => ({
  listSuppliers: jest.fn().mockResolvedValue([{ id: 'v', name: 'Viveluso' }]),
  createSupplier: jest.fn(),
  listCategories: jest
    .fn()
    .mockResolvedValue(['Bebidas', 'Gas y servicios', 'Transporte']),
  bcvRate: jest.fn().mockResolvedValue({ rate: 36.5, source: 'dolarapi.com' }),
  matchLines: jest.fn().mockResolvedValue([]),
  searchProducts: jest.fn().mockResolvedValue([]),
  learnSearchAlias: jest.fn().mockResolvedValue(undefined),
  listPurchaseTypes: jest
    .fn()
    .mockResolvedValue([{ key: 'VEGETALES', label: '🥬 Vegetales' }]),
  listFrequentProducts: jest.fn().mockResolvedValue([]),
  lastPurchase: jest.fn().mockResolvedValue(null),
  possibleDuplicate: jest.fn().mockResolvedValue(null),
  productUnits: jest.fn().mockResolvedValue({}),
  listActiveEmployees: jest
    .fn()
    .mockResolvedValue([
      { id: 'e1', name: 'Carlos Andrade', position: 'Bartender' },
    ]),
});

const header = {
  total: 1500,
  currency: 'BS' as const,
  date: null,
  rif: null,
  vendor: null,
  amounts: [],
  totalCandidates: [],
  esPago: false,
  concepto: null,
};

async function correr(
  pasos: Array<
    { kind: 'text'; text: string } | { kind: 'callback'; data: string }
  >,
  dp = deps(),
) {
  let avance = await arrancar(draftVacio('https://x/f.jpg', '', header), dp);
  for (const p of pasos) {
    if (avance.kind !== 'continuar') break;
    avance = await avanzar({ step: avance.step, draft: avance.draft }, p, dp);
  }
  return avance;
}

describe('router — gasto general de contado con fondos propios', () => {
  it('un transporte va KIND→CATEGORY→AMOUNT→DESCRIPTION→FUNDS→SUMMARY: sin proveedor ni credito', async () => {
    const a = await correr([
      { kind: 'callback', data: 'kind:GENERAL' },
      { kind: 'callback', data: 'cat:2' }, // Transporte
      { kind: 'callback', data: 'amt:ok' },
      { kind: 'text', text: 'Taxi del hielo' },
      { kind: 'callback', data: 'funds:PROPIOS' },
    ]);
    expect(a.kind).toBe('continuar');
    if (a.kind !== 'continuar') return;
    expect(a.step).toBe('SUMMARY');
    expect(a.replies.at(-1)?.text).toContain('Taxi del hielo');
    expect(a.replies.at(-1)?.text).toContain('Bs 1.500,00');
    expect(a.replies.at(-1)?.text).toContain('Propios');

    const fin = await avanzar(
      { step: a.step, draft: a.draft },
      { kind: 'callback', data: 'sum:ok' },
      deps(),
    );
    expect(fin.kind).toBe('listo');
    if (fin.kind !== 'listo') return;
    expect(fin.draft).toEqual(
      expect.objectContaining({
        kind: 'GENERAL',
        category: 'Transporte',
        description: 'Taxi del hielo',
        currency: 'BS',
        amount: 1500,
        exchangeRate: 36.5,
        paymentStatus: 'PAID',
        fundsSource: 'PROPIOS',
      }),
    );
  });
});

describe('router — credito salta FUNDS', () => {
  it('CREDIT va directo a SUMMARY sin origen de fondos', async () => {
    const a = await correr([
      { kind: 'callback', data: 'kind:GENERAL' },
      { kind: 'callback', data: 'cat:1' },
      { kind: 'callback', data: 'amt:ok' },
      { kind: 'text', text: '-' }, // "-" = sin descripcion
      { kind: 'callback', data: 'sup:v' },
      { kind: 'callback', data: 'pay:CREDIT' },
    ]);
    expect(a.kind).toBe('continuar');
    if (a.kind !== 'continuar') return;
    expect(a.step).toBe('SUMMARY');
    expect(a.draft.fundsSource).toBeNull();
    expect(a.draft.description).toBeNull();
    expect(a.replies.at(-1)?.text).toContain('CRÉDITO');
  });
});

describe('router — categoria nueva y cancelar', () => {
  it('"otra" + texto crea la categoria', async () => {
    const a = await correr([
      { kind: 'callback', data: 'kind:GENERAL' },
      { kind: 'callback', data: 'cat:otra' },
      { kind: 'text', text: 'Ferretería' },
    ]);
    if (a.kind !== 'continuar') throw new Error('esperaba continuar');
    expect(a.draft.category).toBe('Ferretería');
    expect(a.step).toBe('AMOUNT');
  });

  it('cancel en cualquier paso termina la conversacion', async () => {
    const a = await correr([
      { kind: 'callback', data: 'kind:GENERAL' },
      { kind: 'callback', data: 'cancel' },
    ]);
    expect(a.kind).toBe('cancelado');
  });

  it('sum:edit vuelve a KIND conservando lo leido', async () => {
    const a = await correr([
      { kind: 'callback', data: 'kind:GENERAL' },
      { kind: 'callback', data: 'cat:0' },
      { kind: 'callback', data: 'amt:ok' },
      { kind: 'text', text: '-' },
      { kind: 'callback', data: 'sup:ninguno' },
      { kind: 'callback', data: 'pay:PAID' },
      { kind: 'callback', data: 'funds:EMPRESA' },
      { kind: 'callback', data: 'sum:edit' },
    ]);
    if (a.kind !== 'continuar') throw new Error('esperaba continuar');
    expect(a.step).toBe('KIND');
    expect(a.draft.amount).toBe(1500);
  });
});

describe('resumenDe', () => {
  it('muestra insumos con sus renglones', () => {
    const d: ExpenseDraft = {
      ...draftVacio('u', '', header),
      kind: 'INSUMOS',
      supplierName: 'Viveluso',
      currency: 'USD',
      amount: 100,
      exchangeRate: 36.5,
      category: 'Bebidas',
      paymentStatus: 'PAID',
      fundsSource: 'EMPRESA',
      lines: [
        {
          invoiceText: '',
          productId: 'H',
          productName: 'Harina PAN',
          quantity: 20,
          unit: 'und',
          unitCost: 5,
          unitsPerPack: null,
          confirmed: true,
        },
      ],
    };
    const t = resumenDe(d);
    expect(t).toContain('Viveluso');
    expect(t).toContain('Harina PAN');
    expect(t).toContain('$ 100,00');
    expect(t).toContain('Bs 3.650,00');
  });

  it('sin tasa muestra el monto en su moneda, sin convertir a cero', () => {
    const d: ExpenseDraft = {
      ...draftVacio('u', '', header),
      kind: 'GENERAL',
      currency: 'USD',
      amount: 100,
      exchangeRate: null,
      category: 'Bebidas',
      paymentStatus: 'PAID',
      fundsSource: 'EMPRESA',
    };
    const t = resumenDe(d);
    expect(t).toContain('$ 100,00');
    expect(t).toContain('sin tasa');
    expect(t).not.toContain('Bs 0,00');
  });
});

describe('volver atras en la conversacion', () => {
  const datos = (a: {
    kind: string;
    replies?: Array<{ buttons?: Array<Array<{ data: string }>> }>;
  }) =>
    (a.replies ?? []).flatMap((r) =>
      (r.buttons ?? []).flat().map((b) => b.data),
    );

  it('cada pregunta ofrece la salida hacia atras, menos la primera', async () => {
    const dp = deps();
    const inicio = await arrancar(draftVacio('u', '', header), dp);
    expect(datos(inicio)).not.toContain('back');

    const enCategoria = await avanzar(
      {
        step: inicio.kind === 'continuar' ? inicio.step : 'KIND',
        draft:
          inicio.kind === 'continuar'
            ? inicio.draft
            : draftVacio('u', '', header),
      },
      { kind: 'callback', data: 'kind:GENERAL' },
      dp,
    );
    expect(datos(enCategoria)).toContain('back');
  });

  it('atras devuelve al paso anterior y vuelve a preguntar', async () => {
    const dp = deps();
    const d = { ...draftVacio('u', '', header), kind: 'GENERAL' as const };
    const atras = await avanzar(
      { step: 'AMOUNT', draft: d },
      { kind: 'callback', data: 'back' },
      dp,
    );
    expect(atras.kind).toBe('continuar');
    if (atras.kind !== 'continuar') return;
    expect(atras.step).toBe('CATEGORY');
    expect(atras.replies[0].text).toMatch(/categoría/i);
  });

  it('en un gasto general, atras desde el pago vuelve a quien se le pago', async () => {
    const d = {
      ...draftVacio('u', '', header),
      kind: 'GENERAL' as const,
      category: 'Mantenimiento y reparaciones',
      supplierName: 'Refrigeracion Perez',
    };
    const r = await avanzar(
      { step: 'PAYMENT', draft: d },
      { kind: 'callback', data: 'back' },
      deps(),
    );
    if (r.kind !== 'continuar') throw new Error('debia continuar');
    expect(r.step).toBe('SUPPLIER');
    expect(r.replies[0].text).toMatch(/a quién se le pagó/i);
  });

  it('atras en el primer paso no rompe nada: repite la pregunta', async () => {
    const d = draftVacio('u', '', header);
    const r = await avanzar(
      { step: 'KIND', draft: d },
      { kind: 'callback', data: 'back' },
      deps(),
    );
    expect(r.kind).toBe('continuar');
    if (r.kind !== 'continuar') return;
    expect(r.step).toBe('KIND');
  });

  it('al retroceder se apaga la busqueda a medias del paso de renglones', async () => {
    const d = {
      ...draftVacio('u', '', header),
      kind: 'INSUMOS' as const,
      searchingLine: 1,
      lastSearch: 'tomate',
    };
    const r = await avanzar(
      { step: 'LINES', draft: d },
      { kind: 'callback', data: 'back' },
      deps(),
    );
    if (r.kind !== 'continuar') throw new Error('debia continuar');
    expect(r.draft.searchingLine).toBeNull();
    expect(r.draft.lastSearch).toBeNull();
    expect(r.step).toBe('AMOUNT');
  });
});
