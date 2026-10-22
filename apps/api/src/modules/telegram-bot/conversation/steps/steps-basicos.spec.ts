import { draftVacio, parseMonto, StepDeps } from '../draft';
import { kindStep } from './kind.step';
import { supplierStep } from './supplier.step';
import { amountStep } from './amount.step';
import { summaryStep } from './summary.step';

const header = {
  total: 18450,
  currency: 'BS' as const,
  date: null,
  rif: 'J-90000004-0',
  vendor: 'DISTRIBUIDORA VIVELUSO',
  amounts: [],
  totalCandidates: [],
  esPago: false,
  concepto: null,
};

function deps(over: Partial<StepDeps> = {}): StepDeps {
  return {
    listSuppliers: jest.fn().mockResolvedValue([
      { id: 'v', name: 'Viveluso', taxId: 'J-90000004-0' },
      { id: 'p', name: 'Polar' },
    ]),
    createSupplier: jest
      .fn()
      .mockImplementation(async (name: string) => ({ id: 'nuevo', name })),
    listCategories: jest.fn().mockResolvedValue(['Bebidas', 'Transporte']),
    bcvRate: jest
      .fn()
      .mockResolvedValue({ rate: 36.5, source: 'dolarapi.com' }),
    matchLines: jest.fn().mockResolvedValue([
      {
        text: 'HARINA PAN 1KGX20 20 850,00',
        qty: 20,
        unitCost: 850,
        unitsPerPack: 20,
        invoiceUnit: 'CAJA',
        matchedProductId: 'H',
        matchedProductName: 'Harina PAN',
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
    listActiveEmployees: jest
      .fn()
      .mockResolvedValue([
        { id: 'e1', name: 'Carlos Andrade', position: 'Bartender' },
      ]),
    ...over,
  };
}

describe('parseMonto', () => {
  it('entiende los formatos que escribe la gente', () => {
    expect(parseMonto('18.450,00')).toBe(18450);
    expect(parseMonto('18450')).toBe(18450);
    expect(parseMonto('245.5')).toBe(245.5);
    expect(parseMonto('Bs 1.200')).toBe(1200);
    expect(parseMonto('$ 45,90')).toBe(45.9);
    expect(parseMonto('hola')).toBeNull();
    expect(parseMonto('0')).toBeNull();
  });
});

describe('kindStep', () => {
  it('pregunta con dos botones', async () => {
    const r = await kindStep.prompt(draftVacio('u', '', header), deps());
    expect(r.buttons?.flat().map((b) => b.data)).toEqual([
      'kind:INSUMOS',
      'kind:GENERAL',
      'cancel',
    ]);
  });

  it('INSUMOS arranca por el proveedor; un gasto general arranca por la categoria', async () => {
    // "el proveedor deberia ser mas abajo opcional" (dueño, 17/09/2026): en un
    // sueldo o un prestamo no hay proveedor, y preguntarlo primero confundia.
    const d = draftVacio('u', '', header);
    expect(
      (
        await kindStep.handle(
          { kind: 'callback', data: 'kind:INSUMOS' },
          d,
          deps(),
        )
      ).next,
    ).toBe('SUPPLIER');
    expect(
      (
        await kindStep.handle(
          { kind: 'callback', data: 'kind:GENERAL' },
          d,
          deps(),
        )
      ).next,
    ).toBe('CATEGORY');
  });

  it('texto libre se queda en el paso', async () => {
    const r = await kindStep.handle(
      { kind: 'text', text: 'insumos' },
      draftVacio('u', '', header),
      deps(),
    );
    expect(r.next).toBe('STAY');
  });
});

describe('supplierStep', () => {
  it('sugiere por RIF primero y ofrece "otro"', async () => {
    const d = { ...draftVacio('u', '', header), kind: 'INSUMOS' as const };
    const r = await supplierStep.prompt(d, deps());
    const datas = r.buttons?.flat().map((b) => b.data) ?? [];
    expect(datas[0]).toBe('sup:v');
    expect(datas).toContain('sup:otro');
  });

  it('elegir un proveedor de insumos carga los renglones y va a TYPE (que se compro)', async () => {
    const dp = deps();
    // prompt() deja las opciones mostradas en el draft; handle() resuelve `sup:<id>` contra ellas.
    const d = {
      ...draftVacio('u', 'texto ocr', header),
      kind: 'INSUMOS' as const,
    };
    await supplierStep.prompt(d, dp);
    expect(d.supplierOptions.map((o) => o.id)).toEqual(['v', 'p']);
    const r = await supplierStep.handle(
      { kind: 'callback', data: 'sup:v' },
      d,
      dp,
    );
    expect(r.next).toBe('TYPE');
    expect(r.draft.supplierId).toBe('v');
    expect(r.draft.supplierName).toBe('Viveluso');
    expect(dp.matchLines).toHaveBeenCalledWith('v', 'texto ocr');
    expect(r.draft.lines[0]).toEqual(
      expect.objectContaining({
        productId: 'H',
        quantity: 20,
        unitCost: 850,
        confirmed: false,
      }),
    );
  });

  it('un gasto general sin a quien pagarle salta el credito: directo a los fondos', async () => {
    const d = { ...draftVacio('u', '', header), kind: 'GENERAL' as const };
    const r = await supplierStep.handle(
      { kind: 'callback', data: 'sup:ninguno' },
      d,
      deps(),
    );
    expect(r.next).toBe('FUNDS');
    expect(r.draft.paymentStatus).toBe('PAID');
    expect(r.draft.supplierId).toBeNull();
  });

  it('"otro" + texto crea el proveedor', async () => {
    const dp = deps();
    const d = { ...draftVacio('u', '', header), kind: 'INSUMOS' as const };
    const r1 = await supplierStep.handle(
      { kind: 'callback', data: 'sup:otro' },
      d,
      dp,
    );
    expect(r1.next).toBe('STAY');
    expect(r1.reply?.text).toMatch(/escribe/i);
    const r2 = await supplierStep.handle(
      { kind: 'text', text: 'Ferreteria El Tornillo' },
      r1.draft,
      dp,
    );
    // Antes de darlo de alta, pregunta: asi entro "C:/Program Files/Git/cancelar".
    expect(dp.createSupplier).not.toHaveBeenCalled();
    expect(r2.next).toBe('STAY');
    expect(r2.reply?.text).toMatch(/¿Lo creo\?/);
    const r3 = await supplierStep.handle(
      { kind: 'callback', data: 'sup:crear' },
      r2.draft,
      dp,
    );
    expect(dp.createSupplier).toHaveBeenCalledWith('Ferreteria El Tornillo');
    expect(r3.draft.supplierId).toBe('nuevo');
    expect(r3.next).toBe('TYPE');
  });
});

describe('amountStep', () => {
  it('propone lo que leyo el OCR con su moneda', async () => {
    const r = await amountStep.prompt(draftVacio('u', '', header), deps());
    expect(r.text).toContain('Bs 18.450,00');
    expect(r.buttons?.flat().map((b) => b.data)).toEqual(
      expect.arrayContaining(['amt:ok', 'cur:USD']),
    );
  });

  it('confirmar fija la tasa y va a LINES si es insumos', async () => {
    const d = { ...draftVacio('u', '', header), kind: 'INSUMOS' as const };
    const r = await amountStep.handle(
      { kind: 'callback', data: 'amt:ok' },
      d,
      deps(),
    );
    expect(r.draft.exchangeRate).toBe(36.5);
    expect(r.next).toBe('LINES');
  });

  it('un gasto general va a DESCRIPTION: la categoria ya se pregunto al principio', async () => {
    const d = { ...draftVacio('u', '', header), kind: 'GENERAL' as const };
    expect(
      (await amountStep.handle({ kind: 'callback', data: 'amt:ok' }, d, deps()))
        .next,
    ).toBe('DESCRIPTION');
  });

  it('escribir un monto lo reemplaza; cambiar moneda se queda para confirmar', async () => {
    const d = { ...draftVacio('u', '', header), kind: 'GENERAL' as const };
    const r1 = await amountStep.handle(
      { kind: 'callback', data: 'cur:USD' },
      d,
      deps(),
    );
    expect(r1.next).toBe('STAY');
    expect(r1.draft.currency).toBe('USD');
    const r2 = await amountStep.handle(
      { kind: 'text', text: '245,50' },
      r1.draft,
      deps(),
    );
    expect(r2.draft.amount).toBe(245.5);
    expect(r2.next).toBe('DESCRIPTION');
  });

  it('sin moneda conocida pide elegirla antes de confirmar', async () => {
    const d = {
      ...draftVacio('u', '', { ...header, currency: null }),
      kind: 'GENERAL' as const,
    };
    const r = await amountStep.handle(
      { kind: 'callback', data: 'amt:ok' },
      d,
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.reply?.text).toMatch(/moneda/i);
  });

  it('tasa BCV de respaldo (fallback): no la adopta en silencio, pide escribirla y se queda en el paso', async () => {
    const dp = deps({
      bcvRate: jest.fn().mockResolvedValue({ rate: 50, source: 'fallback' }),
    });
    const d = { ...draftVacio('u', '', header), kind: 'GENERAL' as const };
    const r1 = await amountStep.handle(
      { kind: 'callback', data: 'amt:ok' },
      d,
      dp,
    );
    expect(r1.next).toBe('STAY');
    expect(r1.reply?.text).toMatch(/tasa BCV/i);
    expect(r1.draft.exchangeRate).toBeNull();

    // El socio escribe la tasa real: se toma como tasa, no como monto nuevo.
    const r2 = await amountStep.handle(
      { kind: 'text', text: '36,5' },
      r1.draft,
      dp,
    );
    expect(r2.draft.exchangeRate).toBe(36.5);
    expect(r2.draft.amount).toBe(d.amount);
    expect(r2.next).toBe('DESCRIPTION');
  });
});

describe('gasto general vs insumos en el paso del proveedor', () => {
  it('un gasto general con proveedor elegido tampoco pasa por el tipo', async () => {
    const dp = deps();
    const d = { ...draftVacio('u', '', header), kind: 'GENERAL' as const };
    await supplierStep.prompt(d, dp);
    const r = await supplierStep.handle(
      { kind: 'callback', data: 'sup:p' },
      d,
      dp,
    );
    expect(r.next).toBe('PAYMENT');
    expect(dp.matchLines).not.toHaveBeenCalled();
  });
});

describe('botones viejos y vuelta atras en el proveedor', () => {
  it('un boton de un mensaje anterior sigue funcionando aunque ya no este en la lista', async () => {
    // La lista se recorta a 6 y cambia por factura: el id tocado puede no estar
    // en `supplierOptions`, pero si en el catalogo.
    const dp = deps();
    const d = {
      ...draftVacio('u', '', header),
      kind: 'GENERAL' as const,
      supplierOptions: [],
    };
    const r = await supplierStep.handle(
      { kind: 'callback', data: 'sup:p' },
      d,
      dp,
    );
    expect(r.draft.supplierName).toBe('Polar');
    expect(r.next).toBe('PAYMENT');
  });

  it('un proveedor que ya no existe lo dice claro y no deja al socio sin salida', async () => {
    const d = {
      ...draftVacio('u', '', header),
      kind: 'GENERAL' as const,
      supplierOptions: [],
    };
    const r = await supplierStep.handle(
      { kind: 'callback', data: 'sup:borrado' },
      d,
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.reply?.text).toMatch(/ya no está en la lista/i);
  });
});

describe('amountStep — cuando la factura trae varios montos', () => {
  // "es importante que si en la factura ve varios montos pregunte cual es el
  // correcto, el usuario sabe cual es" (dueño, 17/09/2026). El caso vivo es la
  // nota de Polar: "Deuda Actual 7.222,04" debajo de un total de 861,43.
  const conMontos = (...montos: number[]) => ({
    ...draftVacio('u', '', {
      ...header,
      currency: 'USD' as const,
      total: montos[0],
      totalCandidates: montos.map((monto) => ({ monto, moneda: null })),
    }),
    kind: 'INSUMOS' as const,
  });

  it('ofrece los otros montos en botones, sin repetir el que ya propuso', async () => {
    const r = await amountStep.prompt(conMontos(861.43, 7222.04, 0.0), deps());
    const datas = r.buttons?.flat().map((b) => b.data) ?? [];
    expect(datas).toContain('amt:0');
    expect(r.text).toMatch(/m[áa]s de un monto/i);
    const etiquetas = r.buttons?.flat().map((b) => b.label) ?? [];
    expect(etiquetas.join(' ')).toContain('7.222,04');
    expect(etiquetas.filter((l) => l.includes('861,43'))).toHaveLength(0);
  });

  it('tocar otro monto lo adopta y sigue de largo', async () => {
    const d = conMontos(861.43, 7222.04);
    const r = await amountStep.handle(
      { kind: 'callback', data: 'amt:0' },
      d,
      deps(),
    );
    expect(r.draft.amount).toBe(7222.04);
    expect(r.next).toBe('LINES');
  });

  it('con un solo monto no pregunta nada raro', async () => {
    const r = await amountStep.prompt(conMontos(861.43), deps());
    expect(r.text).toMatch(/es el total correcto/i);
    expect(
      (r.buttons?.flat().map((b) => b.data) ?? []).filter((d) =>
        /^amt:\d+$/.test(d),
      ),
    ).toHaveLength(0);
  });

  it('un boton de un mensaje viejo no rompe el paso', async () => {
    const r = await amountStep.handle(
      { kind: 'callback', data: 'amt:3' },
      conMontos(861.43),
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.reply?.text).toMatch(/ya no está en la lista/i);
  });
});

describe('draftVacio — el concepto del Pago Movil', () => {
  it('llega como descripcion del gasto, ya escrita por quien pago', () => {
    const d = draftVacio('u', '', { ...header, concepto: 'panes perro' });
    expect(d.description).toBe('panes perro');
  });

  it('una factura sin concepto deja la descripcion vacia', () => {
    expect(draftVacio('u', '', header).description).toBeNull();
  });
});

describe('amountStep — la nota de Coca-Cola: dolares y bolivares en la misma hoja', () => {
  // "intente registrar el de cocacola pero el monto que me puso no es correcto
  // me puso el menor" (dueño, 17/09/2026). Propuso Bs 6.368,68 —el IVA— por una
  // compra de $54,49.
  const coca = () => ({
    ...draftVacio('u', '', {
      ...header,
      currency: 'USD' as const,
      total: 54.49,
      totalCandidates: [
        { monto: 54.49, moneda: 'USD' as const },
        { monto: 39804.26, moneda: 'BS' as const },
        { monto: 6368.68, moneda: 'BS' as const },
      ],
    }),
    kind: 'INSUMOS' as const,
  });

  it('propone los $54,49 y muestra los otros montos en bolivares, no como dolares', async () => {
    const r = await amountStep.prompt(coca(), deps());
    expect(r.text).toContain('$ 54,49');
    const etiquetas = r.buttons?.flat().map((b) => b.label) ?? [];
    expect(etiquetas).toContain('Bs 39.804,26');
    expect(etiquetas).toContain('Bs 6.368,68');
    expect(etiquetas.join(' ')).not.toContain('$ 6.368,68');
  });

  it('tocar un monto en Bs cambia tambien la moneda del gasto', async () => {
    const d = coca();
    await amountStep.prompt(d, deps());
    const r = await amountStep.handle(
      { kind: 'callback', data: 'amt:0' },
      d,
      deps(),
    );
    expect(r.draft.amount).toBe(39804.26);
    expect(r.draft.currency).toBe('BS');
  });

  it('un borrador de antes (montos como numeros sueltos) no revienta', async () => {
    const d = { ...coca(), amountOptions: [54.49, 7222.04] };
    const r = await amountStep.prompt(d, deps());
    expect(r.buttons?.flat().map((b) => b.label)).toContain('$ 7.222,04');
  });
});

describe('summaryStep — el mismo pago fotografiado dos veces', () => {
  const draft = {
    ...draftVacio('f', 'Operación: 007374924115', header),
    kind: 'GENERAL' as const,
    category: 'Transporte',
    amount: 2118.61,
    currency: 'BS' as const,
    exchangeRate: 36.5,
    paymentStatus: 'PAID' as const,
    fundsSource: 'EMPRESA' as const,
  };

  it('avisa quien y cuando lo cargo antes, sin bloquear el registro', async () => {
    const d = deps({
      possibleDuplicate: jest.fn().mockResolvedValue({
        createdAt: new Date('2026-09-18T03:09:00Z'),
        cuando: '17/09/2026 23:09',
        category: 'Transporte',
        description: 'ridery',
        socio: 'Jonathan',
      }),
    });
    const p = await summaryStep.prompt(draft, d);
    expect(p.text).toContain('parece ya registrado');
    expect(p.text).toContain('Jonathan');
    expect(p.text).toContain('ridery');
    expect(JSON.stringify(p.buttons)).toContain('sum:ok');
  });

  it('sin duplicado, el resumen sale limpio', async () => {
    const p = await summaryStep.prompt(draft, deps());
    expect(p.text).not.toContain('Ojo');
    expect(p.text).toContain('¿Registrar?');
  });
});

describe('parseMonto: la coma es decimal (prueba real Viveluso, 18/09/2026)', () => {
  it.each([
    ['3,015', 3.015],
    ['0,2026', 0.2026],
    ['37,352', 37.352],
    ['9,774', 9.774],
    ['1.427,93', 1427.93],
    ['1.200', 1200],
    ['0.2026', 0.2026],
    ['12.11', 12.11],
    ['1,427.93', 1427.93],
    ['18450', 18450],
  ])('%s -> %d', (texto, n) => {
    expect(parseMonto(texto)).toBe(n);
  });
});
