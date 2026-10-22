import { draftVacio, ExpenseDraft, StepDeps, UltimaCompra } from '../draft';
import { linesStep, parseLineInput, parseQtyInput, lineasListas, costoQueCierraElTotal } from './lines.step';

const ULTIMA: UltimaCompra = {
  date: new Date('2026-09-12T12:00:00Z'),
  placeName: 'Viveluso',
  quantity: 1,
  unit: 'unidad-compra',
  unitCostUsd: 20,
  unitCostBs: 21402,
  exchangeRate: 1070.1,
};

const deps = (): StepDeps => ({
  listSuppliers: jest.fn(),
  createSupplier: jest.fn(),
  listCategories: jest.fn(),
  bcvRate: jest.fn(),
  matchLines: jest.fn(),
  learnSearchAlias: jest.fn().mockResolvedValue(undefined),
  listPurchaseTypes: jest.fn().mockResolvedValue([{ key: 'VEGETALES', label: '🥬 Vegetales' }]),
  listFrequentProducts: jest.fn().mockResolvedValue([
    { id: 'T', name: 'Tomate' },
    { id: 'L', name: 'Lechuga Romana' },
  ]),
  lastPurchase: jest.fn().mockResolvedValue(null),
  possibleDuplicate: jest.fn().mockResolvedValue(null),
  productUnits: jest.fn().mockResolvedValue({}),
  listActiveEmployees: jest.fn().mockResolvedValue([{ id: 'e1', name: 'Carlos Andrade', position: 'Bartender' }]),
  // Contrato: `id:<productId>` resuelve uno exacto (lo usa el boton ln:pick); otra cosa busca por nombre.
  searchProducts: jest.fn().mockImplementation(async (q: string) =>
    q.startsWith('id:')
      ? [{ id: q.slice(3), name: 'Harina PAN' }]
      : [
          { id: 'H2', name: 'Harina de trigo' },
          { id: 'H3', name: 'Harina PAN' },
        ],
  ),
});

function conLineas(): ExpenseDraft {
  return {
    ...draftVacio('u', '', null),
    kind: 'INSUMOS',
    currency: 'BS',
    amount: 17000,
    supplierId: 'v',
    supplierName: 'Viveluso',
    lines: [
      {
        invoiceText: 'HARINA PAN 1KGX20 20 850,00',
        productId: 'H',
        productName: 'Harina PAN',
        quantity: 20,
        unit: 'und',
        unitCost: 850,
        unitsPerPack: 20,
        confirmed: false,
      },
      {
        invoiceText: 'ACEITE 1L 5 290,00',
        productId: null,
        productName: null,
        quantity: 5,
        unit: 'und',
        unitCost: 290,
        unitsPerPack: null,
        confirmed: false,
      },
    ],
  };
}

describe('parseLineInput', () => {
  it('lee cantidad, unidad y costo en varios formatos', () => {
    expect(parseLineInput('20 und 850')).toEqual({ quantity: 20, unit: 'und', unitCost: 850 });
    expect(parseLineInput('2,5 kg 1.200,00')).toEqual({ quantity: 2.5, unit: 'kg', unitCost: 1200 });
    expect(parseLineInput('3 caja 15.5')).toEqual({ quantity: 3, unit: 'unidad-compra', unitCost: 15.5 });
    expect(parseLineInput('20 850')).toEqual({ quantity: 20, unit: 'und', unitCost: 850 });
    expect(parseLineInput('hola')).toBeNull();
    expect(parseLineInput('20 litros 5')).toBeNull();
  });
});

describe('linesStep', () => {
  it('lista los renglones con su estado y botones por renglon', async () => {
    const r = await linesStep.prompt(conLineas(), deps());
    expect(r.text).toContain('1) ▫️ <b>Harina PAN</b>');
    // Lo que dice la factura y la cuenta completa, para ver que cuadra.
    expect(r.text).toContain('📄 HARINA PAN 1KGX20 20 850,00');
    expect(r.text).toContain('20 unidades × Bs 850,00 c/u = <b>Bs 17.000,00</b>');
    expect(r.text).toContain('2) ❓ <i>(sin producto: toca 🔎)</i>');
    expect(r.buttons?.flat().map((b) => b.data)).toEqual(
      expect.arrayContaining(['ln:ok:0', 'ln:buscar:0', 'ln:del:0', 'ln:ok:1', 'ln:add', 'ln:listo']),
    );
  });

  it('confirmar un renglon completo lo marca; uno sin producto no se puede confirmar', async () => {
    const r1 = await linesStep.handle({ kind: 'callback', data: 'ln:ok:0' }, conLineas(), deps());
    expect(r1.draft.lines[0].confirmed).toBe(true);
    expect(r1.next).toBe('STAY');
    const r2 = await linesStep.handle({ kind: 'callback', data: 'ln:ok:1' }, conLineas(), deps());
    expect(r2.draft.lines[1].confirmed).toBe(false);
    expect(r2.reply?.text).toMatch(/producto/i);
  });

  it('buscar producto: texto -> opciones -> pick asigna y pide cantidad si falta', async () => {
    const dp = deps();
    const r1 = await linesStep.handle({ kind: 'callback', data: 'ln:buscar:1' }, conLineas(), dp);
    expect(r1.draft.searchingLine).toBe(1);
    const r2 = await linesStep.handle({ kind: 'text', text: 'harina' }, r1.draft, dp);
    expect(dp.searchProducts).toHaveBeenCalledWith('harina');
    expect(r2.reply?.buttons?.flat().map((b) => b.data)).toContain('ln:pick:1:H3');
    const r3 = await linesStep.handle({ kind: 'callback', data: 'ln:pick:1:H3' }, r2.draft, dp);
    expect(r3.draft.lines[1]).toEqual(expect.objectContaining({ productId: 'H3', productName: 'Harina PAN', confirmed: true }));
    expect(r3.draft.searchingLine).toBeNull();
  });

  it('editar cantidad/unidad/costo por texto', async () => {
    const r1 = await linesStep.handle({ kind: 'callback', data: 'ln:edit:0' }, conLineas(), deps());
    expect(r1.draft.editingLine).toBe(0);
    const r2 = await linesStep.handle({ kind: 'text', text: '1 caja 17000' }, r1.draft, deps());
    expect(r2.draft.lines[0]).toEqual(expect.objectContaining({ quantity: 1, unit: 'unidad-compra', unitCost: 17000, confirmed: true }));
    expect(r2.draft.editingLine).toBeNull();
  });

  it('quitar y agregar renglones', async () => {
    const r1 = await linesStep.handle({ kind: 'callback', data: 'ln:del:1' }, conLineas(), deps());
    expect(r1.draft.lines).toHaveLength(1);
    const r2 = await linesStep.handle({ kind: 'callback', data: 'ln:add' }, r1.draft, deps());
    expect(r2.draft.lines).toHaveLength(2);
    expect(r2.draft.searchingLine).toBe(1);
  });

  it('"listo" exige al menos un renglon confirmado y ninguno a medias', async () => {
    const sinConfirmar = await linesStep.handle({ kind: 'callback', data: 'ln:listo' }, conLineas(), deps());
    expect(sinConfirmar.next).toBe('STAY');
    const d = conLineas();
    d.lines = [{ ...d.lines[0], confirmed: true }];
    expect(lineasListas(d)).toBe(true);
    const ok = await linesStep.handle({ kind: 'callback', data: 'ln:listo' }, d, deps());
    expect(ok.next).toBe('CATEGORY');
  });

  it('avisa si la suma de renglones se aleja del total de la factura', async () => {
    const d = conLineas();
    d.lines = [{ ...d.lines[0], confirmed: true }]; // 20 x 850 = 17000 == amount
    const igual = await linesStep.handle({ kind: 'callback', data: 'ln:listo' }, d, deps());
    expect(igual.reply?.text ?? '').not.toMatch(/difiere/);
    d.amount = 30000;
    const distinto = await linesStep.handle({ kind: 'callback', data: 'ln:listo' }, d, deps());
    expect(distinto.reply?.text).toMatch(/difiere/);
    expect(distinto.next).toBe('CATEGORY');
  });
});

// 10/09/2026: el socio escribio "Tomates cesta", el bot dijo "no encontre ese
// producto" (Tomate SI existia) y no ofrecio ninguna salida: quedo trabado.
// Decision del dueño (11/09): el bot NO crea productos — duplicaria "Luchuga"
// junto a "Lechuga Romana". Lo que falta lo crea un admin en la web.
describe('linesStep — el producto no aparece', () => {
  const buscando = (): ExpenseDraft => ({ ...conLineas(), searchingLine: 1 });

  const datos = (r: { reply?: { buttons?: Array<Array<{ data: string }>> } }) =>
    (r.reply?.buttons ?? []).flat().map((b) => b.data);

  it('si no hay nada, lo dice, manda a crearlo en la web y deja volver', async () => {
    const r = await linesStep.handle(
      { kind: 'text', text: 'Cilantro fresco' },
      buscando(),
      { ...deps(), searchProducts: jest.fn().mockResolvedValue([]) },
    );
    expect(r.reply?.text).toContain('Cilantro fresco');
    expect(r.reply?.text).toMatch(/web/i);
    expect(datos(r)).toContain('ln:volver');
    expect(datos(r).some((d) => d.startsWith('ln:crear'))).toBe(false);
  });

  it('las opciones de una busqueda tambien dejan volver sin elegir', async () => {
    const r = await linesStep.handle({ kind: 'text', text: 'harina' }, buscando(), deps());
    expect(datos(r)).toEqual(expect.arrayContaining(['ln:pick:1:H2', 'ln:volver']));
  });

  it('volver sale de la busqueda y muestra los renglones para quitar o seguir', async () => {
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:volver' }, buscando(), deps());
    expect(r.draft.searchingLine).toBeNull();
    expect(r.draft.lastSearch).toBeNull();
    expect(datos(r)).toContain('ln:del:1');
  });

  it('al elegir un producto aprende lo escrito para la proxima vez', async () => {
    const d = deps();
    const r1 = await linesStep.handle({ kind: 'text', text: 'hna pan' }, buscando(), d);
    await linesStep.handle({ kind: 'callback', data: 'ln:pick:1:H3' }, r1.draft, d);
    expect(d.learnSearchAlias).toHaveBeenCalledWith('hna pan', 'H3');
  });

  it('un renglon que ya venia emparejado por la factura no aprende nada al elegir', async () => {
    const d = deps();
    await linesStep.handle({ kind: 'callback', data: 'ln:pick:1:H3' }, conLineas(), d);
    expect(d.learnSearchAlias).not.toHaveBeenCalled();
  });

  it('si aprender falla, la eleccion igual queda guardada', async () => {
    const d = { ...deps(), learnSearchAlias: jest.fn().mockRejectedValue(new Error('mongo caido')) };
    const r1 = await linesStep.handle({ kind: 'text', text: 'hna pan' }, buscando(), d);
    const r2 = await linesStep.handle({ kind: 'callback', data: 'ln:pick:1:H3' }, r1.draft, d);
    expect(r2.draft.lines[1].productId).toBe('H3');
  });
});

describe('lo de siempre (lista por tipo de compra)', () => {
  const vegetales = (): ExpenseDraft => ({
    ...draftVacio('u', '', null),
    kind: 'INSUMOS',
    currency: 'BS',
    exchangeRate: 1100,
    amount: 50000,
    purchaseType: 'VEGETALES',
  });
  const datos = (r: { reply?: { buttons?: Array<Array<{ data: string }>> } }) =>
    (r.reply?.buttons ?? []).flat().map((b) => b.data);

  it('sin renglones y con tipo, ofrece la lista en vez de dejar al socio escribiendo', async () => {
    const r = await linesStep.prompt(vegetales(), deps());
    expect((r.buttons ?? []).flat().map((b) => b.data)).toContain('ln:frec');
  });

  it('la lista sale como botones y no repite lo que ya esta en la factura', async () => {
    const d: ExpenseDraft = {
      ...vegetales(),
      lines: [
        {
          invoiceText: '',
          productId: 'T',
          productName: 'Tomate',
          quantity: 1,
          unit: 'unidad-compra',
          unitCost: 21400,
          unitsPerPack: null,
          confirmed: true,
        },
      ],
    };
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:frec' }, d, deps());
    expect(datos(r)).toContain('ln:fpick:L');
    expect(datos(r)).not.toContain('ln:fpick:T');
  });

  it('tocar un producto de la lista crea el renglon y pide cantidad y costo', async () => {
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:fpick:T' }, vegetales(), deps());
    expect(r.draft.lines).toHaveLength(1);
    expect(r.draft.lines[0]).toEqual(expect.objectContaining({ productId: 'T', productName: 'Tomate', confirmed: false }));
    expect(r.draft.editingLine).toBe(0);
    expect(r.reply?.text).toMatch(/cantidad/i);
  });

  it('sin lista configurada lo dice y no deja al socio esperando', async () => {
    const dp = { ...deps(), listFrequentProducts: jest.fn().mockResolvedValue([]) };
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:frec' }, vegetales(), dp);
    expect(r.reply?.text).toMatch(/lo de siempre/i);
    expect(r.next).toBe('STAY');
  });

  it('un tipo sin lista no muestra el boton', async () => {
    const r = await linesStep.prompt({ ...vegetales(), purchaseType: null }, deps());
    expect((r.buttons ?? []).flat().map((b) => b.data)).not.toContain('ln:frec');
  });
});

describe('precio de la compra anterior', () => {
  const conUltima = () => ({ ...deps(), lastPurchase: jest.fn().mockResolvedValue(ULTIMA) });
  const draftBs = (): ExpenseDraft => ({
    ...draftVacio('u', '', null),
    kind: 'INSUMOS',
    currency: 'BS',
    exchangeRate: 1100,
    amount: 50000,
    purchaseType: 'VEGETALES',
  });

  it('al pedir cantidad muestra lo pagado la vez pasada, en dolares y en los Bs de ESE dia', async () => {
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:fpick:T' }, draftBs(), conUltima());
    expect(r.reply?.text).toContain('$ 20,00');
    expect(r.reply?.text).toContain('Bs 21.402,00');
    expect(r.reply?.text).toContain('Bs 1.070,10');
    expect(r.reply?.text).toContain('12/09');
    expect(r.reply?.text).toContain('Viveluso');
  });

  it('ofrece repetir ese costo convertido a la tasa de HOY, no a la vieja', async () => {
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:fpick:T' }, draftBs(), conUltima());
    const boton = (r.reply?.buttons ?? []).flat().find((b) => b.data.startsWith('ln:mismo'));
    // 20 USD × 1.100 (tasa de hoy) = 22.000 Bs, no los 21.402 de la vez pasada.
    expect(boton?.label).toContain('Bs 22.000,00');
  });

  it('tocar "mismo costo" lo deja puesto y con la cantidad sola alcanza', async () => {
    const dp = conUltima();
    const r1 = await linesStep.handle({ kind: 'callback', data: 'ln:fpick:T' }, draftBs(), dp);
    const r2 = await linesStep.handle({ kind: 'callback', data: 'ln:mismo:0' }, r1.draft, dp);
    expect(r2.draft.lines[0].unitCost).toBe(22000);
    expect(r2.draft.editingLine).toBe(0);
    const r3 = await linesStep.handle({ kind: 'text', text: '2 cestas' }, r2.draft, dp);
    expect(r3.draft.lines[0]).toEqual(
      expect.objectContaining({ quantity: 2, unit: 'unidad-compra', unitCost: 22000, confirmed: true }),
    );
  });

  it('un producto que nunca se compro no ofrece el boton y pide todo', async () => {
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:fpick:T' }, draftBs(), deps());
    expect((r.reply?.buttons ?? []).flat().some((b) => b.data.startsWith('ln:mismo'))).toBe(false);
    expect(r.reply?.text).not.toMatch(/Última compra/);
  });
});

describe('parseQtyInput', () => {
  it('acepta la cantidad sola o con unidad', () => {
    expect(parseQtyInput('3')).toEqual({ quantity: 3 });
    expect(parseQtyInput('2 kg')).toEqual({ quantity: 2, unit: 'kg' });
    expect(parseQtyInput('1 cesta')).toEqual({ quantity: 1, unit: 'unidad-compra' });
    expect(parseQtyInput('2 paq')).toEqual({ quantity: 2, unit: 'unidad-compra' });
    expect(parseQtyInput('2,5 kilos')).toEqual({ quantity: 2.5, unit: 'kg' });
    expect(parseQtyInput('3 lunas')).toBeNull();
    expect(parseQtyInput('hola')).toBeNull();
  });
});

describe('lo que trae cada caja se ve en el renglon', () => {
  it('5 cajas de 36 se muestran como 180 unidades', async () => {
    const d: ExpenseDraft = {
      ...draftVacio('u', '', null),
      kind: 'INSUMOS',
      currency: 'USD',
      amount: 115.05,
      lines: [
        {
          invoiceText: 'SOLERA LIGHT RET 222Mlx36UN 5 C 23.01 115.07',
          productId: 'S',
          productName: 'Solera Light',
          quantity: 5,
          unit: 'unidad-compra',
          unitCost: 23.01,
          unitsPerPack: 36,
          confirmed: false,
        },
      ],
    };
    const r = await linesStep.prompt(d, deps());
    expect(r.text).toContain('5 cajas (180 und) × $ 23,01 la caja = <b>$ 115,05</b>');
  });

  it('un renglon suelto no inventa multiplicaciones', async () => {
    const r = await linesStep.prompt(conLineas(), deps());
    expect(r.text).not.toContain(' und)');
  });
});

describe('nota sin precios por renglon (Coca-Cola, 17/09/2026)', () => {
  // La nota trae codigo, producto y cantidad; el dinero es un solo total.
  const linea = (invoiceText: string, productId: string, productName: string, quantity: number | null) => ({
    invoiceText, productId, productName, quantity, unit: 'und' as const, unitCost: null, unitsPerPack: 6, confirmed: false,
  });
  const nota = (): ExpenseDraft => ({
    ...draftVacio('u', '', null),
    kind: 'INSUMOS',
    currency: 'USD',
    amount: 54.49,
    supplierId: 'c',
    supplierName: 'Coca-Cola',
    lines: [
      linea('101. COCA-COLA 3500C', 'C350', 'Coca-Cola 350cc', 1),
      linea('223 COCA-COLA ORIG PET 1LTX6 5', 'C1L', 'Coca-Cola 1L', 5),
      linea('224 COCA COLA PET1,5LT SUN 3', 'C15', 'Coca-Cola 1,5L', 3),
    ],
  });

  it('con la cantidad ya leida, un numero suelto es el costo', async () => {
    const d0 = { ...nota(), editingLine: 1 };
    const r = await linesStep.handle({ kind: 'text', text: '6,20' }, d0, deps());
    expect(r.draft.lines[1]).toMatchObject({ quantity: 5, unitCost: 6.2, confirmed: true });
  });

  it('el ultimo renglon sin costo ofrece lo que falta para cerrar el total', async () => {
    const d = nota();
    d.lines[0].unitCost = 11.5;
    d.lines[1].unitCost = 6.2;
    // 54,49 - 11,50 - 31,00 = 11,99 entre 3 = 4,00 c/u
    expect(costoQueCierraElTotal(d, 2)).toBe(4);
    const p = await linesStep.handle({ kind: 'callback', data: 'ln:edit:2' }, d, deps());
    expect(JSON.stringify(p.reply?.buttons)).toContain('ln:resto:2');
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:resto:2' }, d, deps());
    expect(r.draft.lines[2]).toMatchObject({ unitCost: 4, confirmed: true });
  });

  it('no ofrece el cierre mientras falte mas de un costo', () => {
    expect(costoQueCierraElTotal(nota(), 2)).toBeNull();
  });

  it('pide solo el precio cuando la nota ya dijo la cantidad', async () => {
    const p = await linesStep.handle({ kind: 'callback', data: 'ln:edit:1' }, nota(), deps());
    expect(p.reply?.text).toContain('no el precio');
  });
});

describe('lo de siempre sin lista del tipo', () => {
  it('pide los frecuentes con el proveedor, para caer a los productos de su ficha', async () => {
    const d = deps();
    const draft = { ...draftVacio('u', '', null), kind: 'INSUMOS' as const, purchaseType: 'VIVELUSO', supplierId: '70CUU', supplierName: 'VIVELUSO' };
    await linesStep.handle({ kind: 'callback', data: 'ln:frec' }, draft, d);
    expect(d.listFrequentProducts).toHaveBeenCalledWith('VIVELUSO', '70CUU');
  });
});

describe('la unidad del inventario se valida al confirmar el renglon', () => {
  it('15 und de papas en un producto por kilo no se confirma: se pide corregir', async () => {
    const d = { ...deps(), productUnits: jest.fn().mockResolvedValue({ PH: { presentation: 'Kilogramo', presentationQuantity: 1, base: 'GR' } }) };
    const draft: ExpenseDraft = {
      ...draftVacio('u', '', null), kind: 'INSUMOS', currency: 'USD', amount: 88.5,
      lines: [{ invoiceText: 'P0046 PAPA FRITA PERRO 1Kg', productId: 'PH', productName: 'Papas en Hilo', quantity: 15, unit: 'und', unitCost: 5.9, unitsPerPack: null, confirmed: false }],
    };
    const r = await linesStep.handle({ kind: 'callback', data: 'ln:ok:0' }, draft, d);
    expect(r.draft.lines[0].confirmed).toBe(false);
    expect(r.reply?.text).toContain('se lleva en kg');
    // Y en la lista se ve cuanto entra al stock.
    const ok = { ...draft, lines: [{ ...draft.lines[0], unit: 'kg' as const }] };
    expect((await linesStep.prompt(ok, d)).text).toContain('→ inventario: 15 kg');
  });
});
