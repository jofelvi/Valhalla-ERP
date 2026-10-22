import { avanzar, arrancar, Avance } from './router';
import {
  draftVacio,
  ExpenseDraft,
  Reply,
  Step,
  StepDeps,
  StepInput,
} from './draft';
import { CATEGORIAS_GENERALES_POR_DEFECTO } from '../compras-config.service';

/**
 * CADA FLUJO, DE LA FOTO AL REGISTRO.
 *
 * "algo similar me pasa con el transporte puedes probar cada 1 de los flujos
 * y ver que sea lo mas coherente posible" (dueño, 17/09/2026). Venia de
 * encontrar, cargando gastos de verdad, que un prestamo preguntaba "¿Donde se
 * compro?" y que un Ridery ofrecia a Viveluso como proveedor.
 *
 * Aqui se recorre la conversacion completa de CADA categoria que ofrece el bot
 * —mas la de insumos— contestando como lo haria el socio, y se exigen tres
 * cosas a todas:
 *   1. no se hace ninguna pregunta que no aplique a ese tipo de gasto;
 *   2. ninguna pregunta se repite;
 *   3. "Atras" desde el resumen desanda EXACTAMENTE el camino recorrido.
 *
 * Si se agrega una categoria a `configs/bot_compras`, entra sola en esta
 * prueba.
 */

const deps = (): StepDeps => ({
  listSuppliers: jest.fn().mockResolvedValue([
    { id: 'v', name: 'Viveluso' },
    { id: 'l', name: 'Pollo Lolimar' },
  ]),
  createSupplier: jest
    .fn()
    .mockImplementation(async (name: string) => ({ id: 'nuevo', name })),
  listCategories: jest
    .fn()
    .mockImplementation(async (kind: string) =>
      kind === 'GENERAL'
        ? CATEGORIAS_GENERALES_POR_DEFECTO
        : ['Vegetales', 'Bebidas'],
    ),
  bcvRate: jest.fn().mockResolvedValue({ rate: 847.44, source: 'bcv' }),
  // Un renglon leido de la factura, para que la compra de insumos tenga que
  // alimentar el inventario (sin productos, con razon, no deja seguir).
  matchLines: jest
    .fn()
    .mockResolvedValue([
      {
        text: 'TOMATE CESTA 20KG 1 680,00',
        qty: 1,
        unitCost: 680,
        unitsPerPack: null,
        invoiceUnit: null,
        matchedProductId: 'T',
        matchedProductName: 'Tomate',
        score: 0.9,
        source: 'catalogo',
      },
    ]),
  searchProducts: jest.fn().mockResolvedValue([]),
  learnSearchAlias: jest.fn().mockResolvedValue(undefined),
  listPurchaseTypes: jest
    .fn()
    .mockResolvedValue([{ key: 'VEGETALES', label: '🥬 Vegetales' }]),
  listFrequentProducts: jest.fn().mockResolvedValue([]),
  lastPurchase: jest.fn().mockResolvedValue(null),
  possibleDuplicate: jest.fn().mockResolvedValue(null),
  productUnits: jest.fn().mockResolvedValue({}),
  listActiveEmployees: jest.fn().mockResolvedValue([
    { id: 'e1', name: 'Emanuel Salomon Perez Flores', position: 'MESONERO' },
    { id: 'e2', name: 'Geraldin', position: 'MESONERA' },
  ]),
});

const header = {
  total: 680,
  currency: 'BS' as const,
  date: null,
  rif: null,
  vendor: null,
  amounts: [],
  totalCandidates: [],
  esPago: false,
  concepto: null,
};

/** Lo que contestaria el socio en cada paso, segun lo que se le ofrece. */
function respuesta(
  step: Step,
  draft: ExpenseDraft,
  ultima: Reply,
  categoria: string,
): StepInput {
  const datas = (ultima.buttons ?? []).flat().map((b) => b.data);
  switch (step) {
    case 'KIND':
      return {
        kind: 'callback',
        data: categoria === '__INSUMOS__' ? 'kind:INSUMOS' : 'kind:GENERAL',
      };
    case 'CATEGORY': {
      const i = draft.categoryOptions.indexOf(
        categoria === '__INSUMOS__' ? 'Vegetales' : categoria,
      );
      return { kind: 'callback', data: `cat:${i}` };
    }
    case 'SUPPLIER':
      return draft.kind === 'INSUMOS'
        ? { kind: 'callback', data: 'sup:v' }
        : { kind: 'text', text: 'Refrigeración Pérez' };
    case 'TYPE':
      return { kind: 'callback', data: 'tipo:VEGETALES' };
    case 'AMOUNT':
      return { kind: 'callback', data: 'amt:ok' };
    case 'LINES':
      // Primero confirma el renglon; con todo confirmado, "Listo".
      return draft.lines.every((l) => l.confirmed)
        ? { kind: 'callback', data: 'ln:listo' }
        : { kind: 'callback', data: 'ln:ok:0' };
    case 'DESCRIPTION':
      return datas.includes('emp:0')
        ? { kind: 'callback', data: 'emp:0' }
        : { kind: 'text', text: 'Lo que fue' };
    case 'PAYMENT':
      return { kind: 'callback', data: 'pay:PAID' };
    case 'FUNDS':
      return { kind: 'callback', data: 'funds:EMPRESA' };
    default:
      throw new Error(`no deberia contestar en ${step}`);
  }
}

interface Recorrido {
  pasos: Step[];
  preguntas: string[];
  botones: string[];
  final: ExpenseDraft;
}

async function recorrer(categoria: string): Promise<Recorrido> {
  const dp = deps();
  let a: Avance = await arrancar(
    draftVacio('u', 'TOMATE CESTA 20KG 1 680,00', header),
    dp,
  );
  const pasos: Step[] = [];
  const preguntas: string[] = [];
  const botones: string[] = [];
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    if (a.kind !== 'continuar') throw new Error(`se corto en ${a.kind}`);
    pasos.push(a.step);
    const ultima = a.replies[a.replies.length - 1];
    preguntas.push(ultima.text.split('\n')[0]);
    botones.push(...(ultima.buttons ?? []).flat().map((b) => b.label));
    if (a.step === 'SUMMARY')
      return { pasos, preguntas, botones, final: a.draft };
    a = await avanzar(
      { step: a.step, draft: a.draft },
      respuesta(a.step, a.draft, ultima, categoria),
      dp,
    );
  }
  throw new Error(
    `${categoria}: no llego al resumen en 20 pasos (${pasos.join('→')})`,
  );
}

/** Aprieta Atras desde el resumen hasta el principio y devuelve por donde paso. */
async function desandar(categoria: string): Promise<Step[]> {
  const r = await recorrer(categoria);
  const dp = deps();
  let session = { step: 'SUMMARY' as Step, draft: r.final };
  const vuelta: Step[] = ['SUMMARY'];
  for (let i = 0; i < 20 && session.step !== 'KIND'; i++) {
    const a = await avanzar(session, { kind: 'callback', data: 'back' }, dp);
    if (a.kind !== 'continuar') throw new Error('atras corto la conversacion');
    vuelta.push(a.step);
    session = { step: a.step, draft: a.draft };
  }
  return vuelta;
}

const GENERALES = [...CATEGORIAS_GENERALES_POR_DEFECTO];

describe('cada categoria de gasto general, de punta a punta', () => {
  it.each(GENERALES)(
    '%s llega al resumen sin repetir preguntas',
    async (cat) => {
      const r = await recorrer(cat);
      expect(r.pasos[r.pasos.length - 1]).toBe('SUMMARY');
      expect(new Set(r.pasos).size).toBe(r.pasos.length);
      expect(r.final.category).toBe(cat);
    },
  );

  it.each(GENERALES)('%s nunca pregunta "¿Dónde se compró?"', async (cat) => {
    // Esa pregunta es de los insumos. En un gasto general, si aplica, es
    // "¿A quién se le pagó?".
    const r = await recorrer(cat);
    expect(r.preguntas.join(' | ')).not.toMatch(/dónde se compró/i);
    expect(r.preguntas.join(' | ')).not.toMatch(/qué se compró/i);
  });

  it.each(GENERALES)(
    '%s nunca ofrece los proveedores de insumos',
    async (cat) => {
      const r = await recorrer(cat);
      expect(r.botones).not.toContain('Viveluso');
      expect(r.botones).not.toContain('Pollo Lolimar');
    },
  );

  it.each(GENERALES)(
    '%s: Atrás desde el resumen desanda exactamente lo recorrido',
    async (cat) => {
      const ida = (await recorrer(cat)).pasos;
      const vuelta = await desandar(cat);
      expect(vuelta).toEqual([...ida].reverse());
    },
  );
});

describe('lo que cada tipo de gasto pregunta, y lo que no', () => {
  it('un prestamo pregunta a quien, y ni proveedor ni credito', async () => {
    const r = await recorrer('Préstamos al personal');
    expect(r.pasos).toEqual([
      'KIND',
      'CATEGORY',
      'AMOUNT',
      'DESCRIPTION',
      'FUNDS',
      'SUMMARY',
    ]);
    expect(r.preguntas).toContain('¿A quién se le prestó?');
    expect(r.final.employeeName).toBe('Emanuel Salomon Perez Flores');
    expect(r.final.paymentStatus).toBe('PAID');
  });

  it('un sueldo pregunta de quien es el pago', async () => {
    const r = await recorrer('Personal (sueldos y bonos)');
    expect(r.preguntas).toContain('¿De quién es este pago?');
    expect(r.pasos).not.toContain('SUPPLIER');
    expect(r.pasos).not.toContain('PAYMENT');
  });

  it.each([
    'Transporte y delivery',
    'Gastos bancarios',
    'Impuestos y permisos',
    'Alquiler',
  ])('%s: sin proveedor ni "¿Contado o crédito?"', async (cat) => {
    const r = await recorrer(cat);
    expect(r.pasos).toEqual([
      'KIND',
      'CATEGORY',
      'AMOUNT',
      'DESCRIPTION',
      'FUNDS',
      'SUMMARY',
    ]);
    expect(r.botones.join(' ')).not.toMatch(/Crédito/);
  });

  it('un transporte pregunta que transporte fue, con un ejemplo de transporte', async () => {
    const r = await recorrer('Transporte y delivery');
    expect(r.preguntas).toContain(
      '¿Qué transporte fue? (ej: Ridery al mercado, delivery del hielo)',
    );
  });

  it.each([
    'Mantenimiento y reparaciones',
    'Servicios (luz, agua, internet)',
    'Publicidad',
    'Otros',
  ])(
    '%s pregunta a quien se le pago, y como hay a quien deberle, ofrece credito',
    async (cat) => {
      const r = await recorrer(cat);
      expect(r.pasos).toEqual([
        'KIND',
        'CATEGORY',
        'AMOUNT',
        'DESCRIPTION',
        'SUPPLIER',
        'PAYMENT',
        'FUNDS',
        'SUMMARY',
      ]);
      expect(r.preguntas.join(' | ')).toMatch(/a quién se le pagó/i);
      expect(r.final.supplierName).toBe('Refrigeración Pérez');
    },
  );

  it('el nombre escrito en un gasto general NO se da de alta como proveedor de insumos', async () => {
    const dp = deps();
    const d = {
      ...draftVacio('u', '', header),
      kind: 'GENERAL' as const,
      category: 'Mantenimiento y reparaciones',
    };
    await avanzar(
      { step: 'SUPPLIER', draft: d },
      { kind: 'text', text: 'Refrigeración Pérez' },
      dp,
    );
    expect(dp.createSupplier).not.toHaveBeenCalled();
  });
});

describe('compra de insumos, de punta a punta', () => {
  it('va proveedor → tipo → monto → renglones → categoria → nota → pago → fondos', async () => {
    const r = await recorrer('__INSUMOS__');
    // LINES se queda mientras se confirman los renglones: se cuenta una vez.
    const sinRepetidos = r.pasos.filter((p, i) => p !== r.pasos[i - 1]);
    expect(sinRepetidos).toEqual([
      'KIND',
      'SUPPLIER',
      'TYPE',
      'AMOUNT',
      'LINES',
      'CATEGORY',
      'DESCRIPTION',
      'PAYMENT',
      'FUNDS',
      'SUMMARY',
    ]);
    expect(r.preguntas).toContain('¿Dónde se compró?');
  });

  it('Atrás desde el resumen desanda exactamente lo recorrido', async () => {
    const ida = (await recorrer('__INSUMOS__')).pasos.filter(
      (p, i, a) => p !== a[i - 1],
    );
    expect(await desandar('__INSUMOS__')).toEqual([...ida].reverse());
  });
});

describe('comprobante de Pago Movil con concepto', () => {
  it('ofrece dejar el concepto en vez de volver a pedirlo', async () => {
    const dp = deps();
    const d = {
      ...draftVacio('u', '', { ...header, concepto: 'ridery' }),
      kind: 'GENERAL' as const,
      category: 'Transporte y delivery',
    };
    const { descriptionStep } = jest.requireActual(
      './steps/description.step',
    ) as typeof import('./steps/description.step');
    const p = await descriptionStep.prompt(d, dp);
    expect(p.text).toMatch(/Leí «ridery»/);
    const r = await descriptionStep.handle(
      { kind: 'callback', data: 'desc:ok' },
      d,
      dp,
    );
    expect(r.draft.description).toBe('ridery');
    expect(r.next).toBe('FUNDS');
  });
});

describe('a credito', () => {
  it('Atrás desde el resumen vuelve al pago, no a unos fondos que nunca se preguntaron', async () => {
    const dp = deps();
    const d: ExpenseDraft = {
      ...draftVacio('u', '', header),
      kind: 'GENERAL',
      category: 'Mantenimiento y reparaciones',
      supplierName: 'Refrigeración Pérez',
      paymentStatus: 'CREDIT',
    };
    const a = await avanzar(
      { step: 'SUMMARY', draft: d },
      { kind: 'callback', data: 'back' },
      dp,
    );
    if (a.kind !== 'continuar') throw new Error('debia continuar');
    expect(a.step).toBe('PAYMENT');
  });
});
