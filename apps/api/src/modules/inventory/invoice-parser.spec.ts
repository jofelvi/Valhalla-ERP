import {
  parseInvoiceLines,
  matchLinesToProducts,
  rankProductsByName,
} from './invoice-parser';

describe('InvoiceParser', () => {
  describe('parseInvoiceLines', () => {
    it('extrae lineas con qty y precio (coma decimal venezolana)', () => {
      const raw = `FACTURA 00123
HARINA DE TRIGO SACO 45KG   2   42,44   84,88
QUESO MOZZARELLA KG         5,5 6,80    37,40
TOTAL                                  122,28`;

      const lines = parseInvoiceLines(raw);
      const harina = lines.find((l) => l.text.includes('HARINA'));
      expect(harina).toBeDefined();
      expect(harina?.qty).toBe(2);
      expect(harina?.unitCost).toBe(42.44);

      const queso = lines.find((l) => l.text.includes('MOZZARELLA'));
      expect(queso).toBeDefined();
      expect(queso?.qty).toBe(5.5);
      expect(queso?.unitCost).toBe(6.8);
    });

    it('descarta lineas sin numeros o de totales', () => {
      const raw = `FACTURA 00123
HARINA DE TRIGO SACO 45KG   2   42,44   84,88
QUESO MOZZARELLA KG         5,5 6,80    37,40
TOTAL                                  122,28`;

      const lines = parseInvoiceLines(raw);
      expect(lines.some((l) => l.text.startsWith('TOTAL'))).toBe(false);
      expect(lines.some((l) => l.text.startsWith('FACTURA'))).toBe(false);
    });

    it('maneja números en formato 1.234,56 (miles + coma decimal)', () => {
      const raw = `PRODUCTO XYZ    3   1.234,56   3.703,68`;
      const lines = parseInvoiceLines(raw);
      const line = lines[0];
      expect(line).toBeDefined();
      expect(line?.unitCost).toBe(1234.56);
      expect(line?.qty).toBe(3);
    });

    it('descarta linea que solo contiene numeros', () => {
      const raw = `123 456 789`;
      const lines = parseInvoiceLines(raw);
      expect(lines.length).toBe(0);
    });

    it('devuelve array vacio para texto vacío', () => {
      const raw = '';
      const lines = parseInvoiceLines(raw);
      expect(lines.length).toBe(0);
    });

    it('devuelve array vacio para null o undefined', () => {
      // Pasar null/undefined sin type casting
      expect(parseInvoiceLines(null).length).toBe(0);
      expect(parseInvoiceLines(undefined).length).toBe(0);
    });

    it('descarta lineas SUBTOTAL, IVA, FACTURA, RIF, FECHA', () => {
      const raw = `FACTURA 123
SUBTOTAL 100
IVA 16% 16
FECHA 2026-07-14
RIF J-90000010-0
HARINA 2 42,44 84,88`;

      const lines = parseInvoiceLines(raw);
      expect(lines.some((l) => l.text.startsWith('SUBTOTAL'))).toBe(false);
      expect(lines.some((l) => l.text.startsWith('IVA'))).toBe(false);
      expect(lines.some((l) => l.text.startsWith('FECHA'))).toBe(false);
      expect(lines.some((l) => l.text.startsWith('RIF'))).toBe(false);
      expect(lines.some((l) => l.text.startsWith('FACTURA'))).toBe(false);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('extrae qty del primer numero y unitCost del penultimo numero (dos numeros)', () => {
      const raw = `PRODUCTO   5   25,50`;
      const lines = parseInvoiceLines(raw);
      expect(lines[0]?.qty).toBe(5);
      expect(lines[0]?.unitCost).toBe(25.5);
    });
  });

  describe('matchLinesToProducts', () => {
    it('matching fuzzy por tokens: HARINA DE TRIGO SACO ↔ producto HARINA DE TRIGO', () => {
      const raw = `FACTURA 00123
HARINA DE TRIGO SACO 45KG   2   42,44   84,88
QUESO MOZZARELLA KG         5,5 6,80    37,40
TOTAL                                  122,28`;

      const lines = parseInvoiceLines(raw);
      const products = [
        { id: 'h1', name: 'HARINA DE TRIGO' },
        { id: 'q1', name: 'Queso Mozzarella Mi Vaquita' },
        { id: 'x', name: 'Tomate' },
      ];

      const matched = matchLinesToProducts(lines, products);
      const harinaMatch = matched.find((m) => m.text.includes('HARINA'));
      expect(harinaMatch?.matchedProductId).toBe('h1');
      expect(harinaMatch?.matchedProductName).toBe('HARINA DE TRIGO');

      const quesoMatch = matched.find((m) => m.text.includes('MOZZARELLA'));
      expect(quesoMatch?.matchedProductId).toBe('q1');
      expect(quesoMatch?.matchedProductName).toBe(
        'Queso Mozzarella Mi Vaquita',
      );
    });

    it('todos los matched items tienen score entre 0 y 1', () => {
      const raw = `HARINA 2 42,44 84,88
QUESO 5,5 6,80 37,40`;

      const lines = parseInvoiceLines(raw);
      const products = [
        { id: 'h1', name: 'HARINA DE TRIGO' },
        { id: 'q1', name: 'Queso' },
      ];

      const matched = matchLinesToProducts(lines, products);
      expect(matched.every((m) => m.score >= 0 && m.score <= 1)).toBe(true);
    });

    it('no matching devuelve null en matchedProductId', () => {
      const raw = `XYZ PRODUCTO RARO 2 10 20`;
      const lines = parseInvoiceLines(raw);
      const products = [{ id: 'h1', name: 'HARINA DE TRIGO' }];

      const matched = matchLinesToProducts(lines, products);
      expect(matched[0]?.matchedProductId).toBeNull();
      expect(matched[0]?.score).toBeLessThan(0.6);
    });

    it('empatada por score: toma el que tiene nombre más largo', () => {
      const raw = `QUESO FRESCO 5 10`;
      const lines = parseInvoiceLines(raw);
      const products = [
        { id: 'q1', name: 'Queso Fresco' }, // 2 tokens, 2 coinciden → 2/2 = 1.0
        { id: 'q2', name: 'Queso Fresco Premium' }, // 3 tokens, 2 coinciden → 2/3 = 0.67
      ];

      const matched = matchLinesToProducts(lines, products);
      // q2 tiene menos tokens coincidentes, así que gana q1
      expect(matched[0]?.matchedProductId).toBe('q1');
    });

    it('matchLinesToProducts con array vacio de líneas devuelve array vacio', () => {
      const lines = [];
      const products = [{ id: 'h1', name: 'HARINA DE TRIGO' }];
      const matched = matchLinesToProducts(lines, products);
      expect(matched.length).toBe(0);
    });

    it('matchLinesToProducts con array vacio de productos devuelve líneas sin match', () => {
      const lines = parseInvoiceLines('HARINA 2 42,44 84,88');
      const products = [];
      const matched = matchLinesToProducts(lines, products);
      expect(matched.length).toBe(1);
      expect(matched[0]?.matchedProductId).toBeNull();
    });
  });
});

describe('rankProductsByName', () => {
  const CATALOGO = [
    { id: 'T', name: 'Tomate' },
    { id: 'S', name: 'Salsa de Tomate' },
    { id: 'A', name: 'Aji' },
    { id: 'Q', name: 'Queso Amarillo mi vaquita cheddar' },
  ];

  // Caso real 10/09/2026: el socio escribio "Tomates cesta" y el bot, que solo
  // buscaba por substring, dijo "no encontre ese producto" con Tomate cargado.
  it('encuentra el producto aunque se escriba en plural y con palabras de mas', () => {
    const r = rankProductsByName('Tomates cesta', CATALOGO);
    expect(r.map((p) => p.name)).toEqual(['Tomate']);
  });

  it('ignora acentos y mayusculas', () => {
    expect(rankProductsByName('ají', CATALOGO).map((p) => p.id)).toEqual(['A']);
  });

  it('no devuelve productos que apenas comparten una palabra', () => {
    // "Queso" es 1 de las 5 palabras del producto: demasiado flojo para sugerirlo.
    expect(rankProductsByName('queso', CATALOGO)).toEqual([]);
  });

  it('devuelve vacio cuando no se parece a nada y respeta el limite', () => {
    expect(rankProductsByName('zapatos', CATALOGO)).toEqual([]);
    expect(
      rankProductsByName('tomate', CATALOGO, 1).length,
    ).toBeLessThanOrEqual(1);
  });

  it('ordena por parecido, el mejor primero', () => {
    const r = rankProductsByName('salsa de tomate', CATALOGO);
    expect(r[0].name).toBe('Salsa de Tomate');
  });
});

// Medido el 11/09/2026 contra los 391 insumos reales: el parecido aceptaba una
// palabra metida EN MEDIO de otra ("PAN" dentro de "aPANado") y no toleraba
// ningun error de tipeo.
describe('parecido por palabras — prefijos y tipeos', () => {
  const CATALOGO = [
    { id: 'E', name: 'Empanizado/Apanado' },
    { id: 'H', name: 'Harina de Trigo' },
    { id: 'L', name: 'Lechuga Romana' },
    { id: 'C', name: 'Cebolla' },
    { id: 'T', name: 'Tomate' },
    { id: 'M', name: 'Queso Mozzarella' },
  ];

  it('un renglon "HARINA PAN" de la factura NO cae en Empanizado/Apanado', () => {
    const [linea] = matchLinesToProducts(
      parseInvoiceLines('HARINA PAN 1KGX20      20   850,00   17.000,00'),
      CATALOGO,
    );
    expect(linea.matchedProductId).not.toBe('E');
  });

  it('la busqueda escrita "harina pan" tampoco sugiere Empanizado/Apanado', () => {
    expect(
      rankProductsByName('harina pan', CATALOGO).map((p) => p.id),
    ).not.toContain('E');
  });

  it('tolera un error de tipeo', () => {
    expect(rankProductsByName('luchuga', CATALOGO)[0]?.name).toBe(
      'Lechuga Romana',
    );
    expect(rankProductsByName('ceboya', CATALOGO)[0]?.name).toBe('Cebolla');
  });

  it('una palabra que empieza igual cuenta (plural, abreviatura, OCR que corta)', () => {
    expect(rankProductsByName('tomates', CATALOGO)[0]?.name).toBe('Tomate');
    expect(rankProductsByName('tom', CATALOGO)[0]?.name).toBe('Tomate');
    const [linea] = matchLinesToProducts(
      parseInvoiceLines('QUESO MOZZARELL 2 5,00 10,00'),
      CATALOGO,
    );
    expect(linea.matchedProductId).toBe('M');
  });

  it('las palabras cortas no se aceptan con errores: "tim" no es "tom"', () => {
    expect(rankProductsByName('tim', CATALOGO)).toEqual([]);
  });
});
