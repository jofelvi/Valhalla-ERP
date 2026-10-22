import {
  buildAliasKey,
  extractUnitsPerPack,
  extractInvoiceUnit,
  parseInvoiceLines,
  matchLinesToProducts,
  SupplierAlias,
} from './invoice-parser';

/**
 * Formatos reales de la factura de POLAR (proveedor recurrente).
 * El contenido del bulto viene DENTRO de la descripcion ("222Mlx36UN"),
 * asi que se puede expandir cajas a unidades sin configurar nada por
 * producto: 15 cajas x 36 = 540 botellas.
 */
describe('extractUnitsPerPack', () => {
  const casos: Array<[string, number]> = [
    ['SOLERA LIGHT RET 222Mlx36UN', 36],
    ['POLAR LIGHT RET 222Mlx36UN', 36],
    ['POLAR PILSEN RET 222Mlx36UNI', 36],
    ['MALTIN POLAR RET 222Mlx36UN', 36],
    ['PAN HARINA BLANCO FREE GLUTEN 1KGX20UND', 20],
    ['MAVESA ADEREZO MAYONESA 3.6KGx4UN CFH', 4],
    ['MINALBA SPARKLING LIMON C/G PET 500Mlx12UN', 12],
    ['MIN SPARKLING GINGER LAT355X24', 24],
    ['LIPTON DURAZNO PET 500Mlx12UN', 12],
    ['SANGRIA LA QUE MANDA LATA 250MLX24 UND', 24],
    ['MINALBA SPARKLING SODA LATA 355Mlx24UN', 24],
    ['PEPSI PET 1.5LX6UN', 6],
  ];

  it.each(casos)(
    'lee el contenido de "%s" como %i unidades',
    (texto, esperado) => {
      expect(extractUnitsPerPack(texto)).toBe(esperado);
    },
  );

  it('devuelve null cuando la descripcion no declara bulto', () => {
    expect(extractUnitsPerPack('HARINA DE TRIGO SACO 45KG')).toBeNull();
    expect(extractUnitsPerPack('QUESO MOZZARELLA KG')).toBeNull();
    expect(extractUnitsPerPack('')).toBeNull();
  });

  it('no confunde la cantidad facturada con el contenido del bulto', () => {
    // "15" es la cantidad de cajas, "36" el contenido. Debe leer 36.
    expect(
      extractUnitsPerPack('SOLERA LIGHT RET 222Mlx36UN 15 C 23,01 345,22'),
    ).toBe(36);
  });

  it('tolera espacios alrededor de la x que mete el OCR', () => {
    expect(extractUnitsPerPack('POLAR PILSEN RET 222Ml x 36 UN')).toBe(36);
  });
});

/**
 * La columna que sigue a la cantidad dice en QUE se factura:
 *   "15 C" = 15 cajas    "1 B" = 1 bulto    "2 U" = 2 unidades sueltas
 * Es la evidencia que decide si hay que expandir por el contenido o no.
 */
describe('extractInvoiceUnit', () => {
  it('lee la C de cajas', () => {
    expect(
      extractInvoiceUnit('SOLERA LIGHT RET 222Mlx36UN 15 C 23,01 345,22'),
    ).toBe('CAJA');
  });

  it('lee la B de bulto', () => {
    expect(
      extractInvoiceUnit(
        'PAN HARINA BLANCO FREE GLUTEN 1KGX20UND 1 B 24,80 24,80',
      ),
    ).toBe('BULTO');
  });

  it('lee la U de unidades sueltas', () => {
    expect(
      extractInvoiceUnit(
        'MAVESA ADEREZO MAYONESA 3.6KGx4UN CFH 2 U 28,92 57,84',
      ),
    ).toBe('UNIDAD');
  });

  it('devuelve null si no hay columna de unidad', () => {
    expect(
      extractInvoiceUnit('HARINA DE TRIGO SACO 45KG 2 42,44 84,88'),
    ).toBeNull();
  });

  it('no confunde una palabra que empiece con C con la columna de unidad', () => {
    // "CFH" no es la columna: la columna es UNA sola letra pegada a la cantidad.
    expect(
      extractInvoiceUnit(
        'MAVESA ADEREZO MAYONESA 3.6KGx4UN CFH 2 U 28,92 57,84',
      ),
    ).not.toBe('CAJA');
  });

  it('lee la letra que sigue a la CANTIDAD, no cualquier letra suelta', () => {
    expect(extractInvoiceUnit('PEPSI PET 1.5LX6UN 3 C 5,98 17,95')).toBe(
      'CAJA',
    );
  });

  it('encuentra la columna aunque la descripcion traiga una medida suelta antes', () => {
    // "1.5 LTRS" y "X 24" son del NOMBRE del producto; la columna viene despues.
    expect(
      extractInvoiceUnit(
        'OFERTA 7UP GOLDEN SABORES 1.5 LTRS X 06UND 2 C 4.25 8.49',
      ),
    ).toBe('CAJA');
    expect(
      extractInvoiceUnit('SOLERA LATA 250ML X 24 UND 1 C 23.07 23.07'),
    ).toBe('CAJA');
  });
});

describe('la columna Cant le gana a las medidas del nombre (nota de entrega Polar 16/09/2026)', () => {
  it('no confunde "1.5 LTRS" con la cantidad comprada', () => {
    const [l] = parseInvoiceLines(
      'OFERTA 7UP GOLDEN SABORES 1.5 LTRS X 06UND 2 C 4.25 8.49',
    );
    expect(l).toEqual(
      expect.objectContaining({ qty: 2, unitCost: 4.25, invoiceUnit: 'CAJA' }),
    );
  });

  it('no confunde el "X 24 UND" del envase con la cantidad comprada', () => {
    const [l] = parseInvoiceLines('SOLERA LATA 250ML X 24 UND 1 C 23.07 23.07');
    expect(l).toEqual(
      expect.objectContaining({ qty: 1, unitCost: 23.07, invoiceUnit: 'CAJA' }),
    );
  });

  it('el peso neto del pie de la factura no es un renglon', () => {
    expect(parseInvoiceLines('Peso Neto: 5 Kg Cant. 27')).toEqual([]);
  });

  it('sin columna de unidad se sigue leyendo como antes: la primera cifra es la cantidad', () => {
    const [l] = parseInvoiceLines('HARINA DE TRIGO SACO 45KG 2 42,44 84,88');
    expect(l).toEqual(
      expect.objectContaining({ qty: 2, unitCost: 42.44, invoiceUnit: null }),
    );
  });
});

describe('parseInvoiceLines con bultos', () => {
  it('lee cantidad, costo por bulto y contenido del renglon de Polar', () => {
    const raw = `Nro 7980
SOLERA LIGHT RET 222Mlx36UN   15 C   23,01   345,22
PEPSI PET 1.5LX6UN             3 C    5,98    17,95
Sub-Total                              861,43`;

    const lines = parseInvoiceLines(raw);

    const solera = lines.find((l) => l.text.includes('SOLERA'));
    expect(solera).toBeDefined();
    expect(solera?.qty).toBe(15);
    expect(solera?.unitCost).toBe(23.01);
    expect(solera?.unitsPerPack).toBe(36);
    expect(solera?.invoiceUnit).toBe('CAJA');

    const pepsi = lines.find((l) => l.text.includes('PEPSI'));
    expect(pepsi?.qty).toBe(3);
    expect(pepsi?.unitsPerPack).toBe(6);
  });

  it('deja unitsPerPack en null si la linea no declara bulto', () => {
    const raw = `HARINA DE TRIGO SACO 45KG   2   42,44   84,88`;
    const [linea] = parseInvoiceLines(raw);
    expect(linea.unitsPerPack).toBeNull();
  });
});

describe('buildAliasKey', () => {
  it('produce la MISMA clave lea el OCR la presentacion o no', () => {
    const conPresentacion = buildAliasKey(
      'SOLERA LIGHT RET 222Mlx36UN 15 C 23,01 345,22',
    );
    const sinPresentacion = buildAliasKey('SOLERA LIGHT RET 15 C 23,01 345,22');

    expect(conPresentacion).toBe('SOLERA LIGHT RET');
    expect(sinPresentacion).toBe(conPresentacion);
  });

  it('no arrastra cantidad, precio ni columna de unidad', () => {
    expect(buildAliasKey('PEPSI PET 1.5LX6UN 3 C 5,98 17,95')).toBe(
      'PEPSI PET',
    );
  });

  it('distingue renglones distintos del mismo proveedor', () => {
    const light = buildAliasKey('POLAR LIGHT RET 222Mlx36UN 5 C 23,01 115,07');
    const pilsen = buildAliasKey(
      'POLAR PILSEN RET 222Mlx36UNI 5 C 23,01 115,07',
    );

    expect(light).toBe('POLAR LIGHT RET');
    expect(pilsen).toBe('POLAR PILSEN RET');
    expect(light).not.toBe(pilsen);
  });

  it('devuelve cadena vacia si la linea no tiene palabras utiles', () => {
    expect(buildAliasKey('15 C 23,01 345,22')).toBe('');
  });
});

describe('matchLinesToProducts con alias aprendidos', () => {
  const productos = [
    { id: 'p-light', name: 'Cerveza Light Botella' },
    { id: 'p-pilsen', name: 'Cerveza Pilsen Botella' },
    { id: 'p-malta', name: 'Malta Polar 222ml' },
  ];

  it('reconoce por alias lo que el catalogo no puede matchear solo', () => {
    // "SOLERA LIGHT RET" no se parece a "Cerveza Light Botella":
    // sin alias el fuzzy no lo resuelve.
    const lines = parseInvoiceLines(
      'SOLERA LIGHT RET 222Mlx36UN 15 C 23,01 345,22',
    );
    const sinAlias = matchLinesToProducts(lines, productos);
    expect(sinAlias[0].matchedProductId).toBeNull();

    const alias: SupplierAlias[] = [
      {
        aliasKey: 'SOLERA LIGHT RET',
        productId: 'p-light',
        productName: 'Cerveza Light Botella',
        unitsPerPack: 36,
      },
    ];
    const conAlias = matchLinesToProducts(lines, productos, alias);
    expect(conAlias[0].matchedProductId).toBe('p-light');
    expect(conAlias[0].source).toBe('alias');
  });

  it('el alias le gana al parecido casual del catalogo', () => {
    // El texto dice "PILSEN", que el fuzzy mandaria a Cerveza Pilsen Botella.
    // El alias dice que ese renglon del proveedor es la Malta.
    const lines = parseInvoiceLines(
      'MALTIN POLAR PILSEN RET 222Mlx36UN 1 C 17,28 17,28',
    );
    const alias: SupplierAlias[] = [
      {
        aliasKey: 'MALTIN POLAR PILSEN RET',
        productId: 'p-malta',
        productName: 'Malta Polar 222ml',
        unitsPerPack: 36,
      },
    ];
    const [linea] = matchLinesToProducts(lines, productos, alias);
    expect(linea.matchedProductId).toBe('p-malta');
  });

  it('sin alias mantiene el comportamiento de siempre', () => {
    const lines = parseInvoiceLines('CERVEZA PILSEN BOTELLA 2 1,20 2,40');
    const [linea] = matchLinesToProducts(lines, productos);
    expect(linea.matchedProductId).toBe('p-pilsen');
    expect(linea.source).toBe('catalogo');
  });

  it('el alias aporta el contenido cuando el OCR no logro leerlo', () => {
    const lines = parseInvoiceLines('SOLERA LIGHT RET 15 C 23,01 345,22');
    expect(lines[0].unitsPerPack).toBeNull();

    const alias: SupplierAlias[] = [
      {
        aliasKey: 'SOLERA LIGHT RET',
        productId: 'p-light',
        productName: 'Cerveza Light Botella',
        unitsPerPack: 36,
      },
    ];
    const [linea] = matchLinesToProducts(lines, productos, alias);
    expect(linea.unitsPerPack).toBe(36);
  });

  it('no inventa alias cuando el renglon no se parece a ninguno', () => {
    const lines = parseInvoiceLines('TORTA DE CHOCOLATE 1 12,00 12,00');
    const alias: SupplierAlias[] = [
      {
        aliasKey: 'SOLERA LIGHT RET',
        productId: 'p-light',
        productName: 'Cerveza Light Botella',
        unitsPerPack: 36,
      },
    ];
    const [linea] = matchLinesToProducts(lines, productos, alias);
    expect(linea.matchedProductId).toBeNull();
    expect(linea.source).toBeNull();
  });
});

describe('emparejado: mejor sin producto que con el producto equivocado', () => {
  // Catalogo real de Negocio (17/09/2026), con los nombres que causaban el lio.
  const CATALOGO = [
    { id: 'pasapalos', name: 'Pasapalos #2' },
    { id: 'pepsi2l', name: 'Pepsi 2L' },
    { id: 'pepsi15', name: 'PEPSI 1.5 LTS ' },
    { id: 'pepsi1l', name: 'Pepsi 1L' },
    { id: 'limon', name: 'Limon' },
    { id: 'liptonlimon', name: 'Lipton Limon 500ml' },
    { id: 'mora', name: 'Mora' },
    { id: 'gatoradeMora', name: 'Gatorade Mora 500ml' },
    { id: 'goldons', name: 'goldons' },
    { id: '7up15', name: '7UP 1.5 LTS ' },
    { id: '7upgolden355', name: '7UP GOLDEN BOTELLA 355ml' },
    { id: 'harina', name: 'Harina PAN' },
  ];
  const empareja = (texto: string): string | null =>
    matchLinesToProducts(parseInvoiceLines(texto), CATALOGO, [])[0]
      ?.matchedProductId ?? null;

  it('una caja de Pepsi no entra al stock de "Pasapalos #2"', () => {
    // El "2" de Pasapalos #2 coincidia con el "2" de 2L y daba 0,50: justo el umbral.
    expect(empareja('PEPSI PET 2LX6UN 2 C 7.53 15.06')).toBe('pepsi2l');
  });

  it('la Pepsi de 1,5 L no se carga como Pepsi de 2 L', () => {
    expect(empareja('PEPSI PET 1.5LX6UN 4 C 5.98 23.93')).toBe('pepsi15');
  });

  it('el te Lipton de limon no es el limon de la cocina', () => {
    expect(empareja('LIPTON LIMON PET 500MIx12UN 1 C 19.78 19.78')).toBe(
      'liptonlimon',
    );
  });

  it('el Gatorade de mora no es la mora de la cocina', () => {
    expect(empareja('GATORADE MORA PET 500MIx12UN 1 C 21.24 21.24')).toBe(
      'gatoradeMora',
    );
  });

  it('"goldons" no se lleva el 7UP Golden de 1,5 L', () => {
    expect(
      empareja('OFERTA 7UP GOLDEN SABORES 1.5 LTRS X 06UND 2 C 4.25 8.49'),
    ).toBe('7up15');
  });

  it('lo que siempre funciono sigue funcionando: sin medidas en juego, manda el parecido', () => {
    expect(empareja('HARINA PAN 1KGX20 20 850,00')).toBe('harina');
  });
});
