import {
  claveDeAlias,
  extractUnitsPerPack,
  matchLinesToProducts,
  parseInvoiceLines,
} from './invoice-parser';

/**
 * LOS SEIS COMPROBANTES QUE LLEGAN DE VERDAD.
 *
 * El dueño mandó estos seis el 17/09/2026 con una sola instrucción: "esas son
 * prueba con esas y perfecciona el bot". Son los formatos que el personal
 * fotografía en la calle, y entre ellos NO se parecen en nada:
 *
 *   1. Un comprobante de Pago Móvil: no tiene renglones, solo un monto.
 *   2. Polar: columna "Cant" con letra ("15 C" = 15 cajas de 36).
 *   3. Coca-Cola FEMSA: empieza por el CODIGO del producto y pone el precio
 *      ANTES que la cantidad.
 *   4. Condimentos Tony: vende por peso ("0,250 x 7.618,59").
 *   5. Importaciones Karin: la cantidad y el precio van en la linea de ARRIBA
 *      y el nombre debajo.
 *   6. Ticket de desechables: igual que Karin, cantidad arriba.
 *
 * Cada describe trae el texto tal como lo entrega el OCR, con sus cortes de
 * linea. Si un cambio al parser rompe uno de estos seis, rompio una compra
 * real de Negocio.
 */

/** Renglon reconocido, en corto, para poder leer el expect de un vistazo. */
const resumen = (t: string) =>
  parseInvoiceLines(t).map((l) => ({
    qty: l.qty,
    unitCost: l.unitCost,
    pack: l.unitsPerPack,
    unidad: l.invoiceUnit,
  }));

const nombres = (t: string) =>
  parseInvoiceLines(t).map((l) => l.text.replace(/\s+/g, ' ').trim());

describe('1. Pago Movil BDV — un comprobante de pago no tiene renglones', () => {
  const texto = `PagomóvilBDV Personas
52.541,54 Bs
Fecha: 17/09/2026
Operación: 007369741836
Identificación: 06262322
Origen: 0102****9486
Destino: 04140000008
Banco: 0134 - BANESCO
Concepto: panes perro`;

  it('no inventa renglones de compra donde solo hay una transferencia', () => {
    // Antes esto devolvia basura: "Banco: 0134 - BANESCO" tiene dos numeros y
    // una palabra larga, o sea cumplia de sobra el criterio de "renglon".
    expect(parseInvoiceLines(texto)).toEqual([]);
  });
});

describe('2. Polar / Spicy Grill — la columna Cant manda sobre la descripcion', () => {
  const texto = `SPICY GRILL CA | Lic. Licores
Producto Cant Precio Precio Total
SOLERA LIGHT RET 222Mlx36UN 15 C 23.01 345.22
POLAR LIGHT RET 222Mlx36UN 5 C 23.01 115.07
POLAR PILSEN RET 222Mlx36UNI 5 C 23.01 115.07
MALTIN POLAR RET 222Mlx36UN 1 C 17.28 17.28
PAN HARINA BLANCO FREE GLUTEN 1KGX20UND 1 B 24.80 24.80
MAVESA ADEREZO MAYONESA 3.6KGx4UN CFH 2 U 28.92 57.84
MINALBA SPARKLING LIMON C/G PET 500Mlx12UN 1 C 13.40 13.40
MIN SPARKLING GINGER LAT355X24 1 C 26.00 26.00
LIPTON LIMON PET 500Mlx12UN 1 C 19.78 19.78
PEPSI PET 1.5LX6UN 3 C 5.98 17.95
Peso Neto: 27.2 Kg Cant. 41
Deuda Actual: $ 7222.04
Sub-Total 861.43
Iva 0.00
Total 861.43`;

  it('lee las diez lineas de producto y ninguna del pie', () => {
    expect(parseInvoiceLines(texto)).toHaveLength(10);
    expect(nombres(texto).join(' ')).not.toMatch(
      /Peso Neto|Deuda|Sub-Total|Total 861/i,
    );
  });

  it('15 cajas de Solera son 15, no 222 ni 36', () => {
    const [solera] = resumen(texto);
    expect(solera).toEqual({
      qty: 15,
      unitCost: 23.01,
      pack: 36,
      unidad: 'CAJA',
    });
  });

  it('distingue caja, bulto y unidad suelta en la misma factura', () => {
    const r = resumen(texto);
    expect(r[4]).toEqual({ qty: 1, unitCost: 24.8, pack: 20, unidad: 'BULTO' });
    expect(r[5]).toEqual({
      qty: 2,
      unitCost: 28.92,
      pack: 4,
      unidad: 'UNIDAD',
    });
    expect(r[9]).toEqual({ qty: 3, unitCost: 5.98, pack: 6, unidad: 'CAJA' });
  });
});

describe('3. Coca-Cola FEMSA — el codigo va primero y el precio antes que la cantidad', () => {
  const texto = `CÓD DESCRIPCIÓN PRECIO / U USD % DCTO. MONTO DESCUENTO CANT TOTAL USD. % IMP
101 COCA-COLA 350CC 8,62 1 8,62 16,00
223 COCA-COLA ORIG PET 1LTX6 4,31 5 21,55 16,00
224 COCA COLA PET1,5LT 6UN 5,60 3 16,80 16,00
Total ARTÍCULOS 9 46,97`;

  it('lee los tres renglones y no el total', () => {
    expect(parseInvoiceLines(texto)).toHaveLength(3);
  });

  it('el 101 es el codigo del producto, no 101 cajas de Coca-Cola', () => {
    // Sin esto el bot cargaba 101 unidades a $8,62 = $870 de una factura de $54.
    const [una, cinco, tres] = resumen(texto);
    expect(una.qty).toBe(1);
    expect(una.unitCost).toBe(8.62);
    expect(cinco.qty).toBe(5);
    expect(cinco.unitCost).toBe(4.31);
    expect(tres.qty).toBe(3);
    expect(tres.unitCost).toBe(5.6);
  });

  it('cantidad x precio tiene que dar el total del renglon', () => {
    for (const l of parseInvoiceLines(texto)) {
      const total = (l.qty ?? 0) * (l.unitCost ?? 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe('4. Condimentos Tony — se compra por peso', () => {
  const texto = `CONDIMENTOS Y ESPECIAS TONY, C.A.
J-90000007-0
RAZON SOCIAL : VENTA CONTADO
FECHA: 16/09/2026 HORA: 12:38 pm
SEMILLAS DE HINOJO POR KG (E)
0,250 x 7.618,59 1.904,65
TOTAL A PAGAR Bs.: 1.904,65`;

  it('un cuarto de kilo es 0,250, no 250 kilos', () => {
    const r = resumen(texto);
    expect(r).toHaveLength(1);
    expect(r[0].qty).toBe(0.25);
    expect(r[0].unitCost).toBe(7618.59);
  });

  it('se queda con el nombre del producto, no con la linea de numeros', () => {
    expect(nombres(texto)[0]).toMatch(/HINOJO/i);
  });
});

describe('5. Importaciones Karin — la cantidad va en la linea de ARRIBA', () => {
  const texto = `IMPORTACIONES KARIN, C.A.
VENTA CONTADO
FACTURA: 00118008
FECHA: 16-09-2026 HORA: 16:21
0,5xBs 6.763,64
MANI SIN SAL GRANDE GELATTO (E) Bs 3.381,82
0,502xBs 3.970,15
PIMIENTA NEGRA MOLIDA BACKER (G) Bs 1.993,02
0,998xBs 7.703,27
AJO GRANULADO (E) Bs 7.687,86
0,506xBs 8.168,85
OREGANO EN HOJAS (E) Bs 4.133,44
0,252xBs 17.488,96
ALMENDRAS NATURALES (E) Bs 4.407,22
EXENTO Bs 19.610,34
SUBTTL Bs 21.603,36
TOTAL Bs 21.922,24`;

  it('junta la linea de cantidad con el nombre que viene debajo', () => {
    const r = resumen(texto);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual(
      expect.objectContaining({ qty: 0.5, unitCost: 6763.64 }),
    );
    expect(r[2]).toEqual(
      expect.objectContaining({ qty: 0.998, unitCost: 7703.27 }),
    );
  });

  it('cada renglon queda con el nombre del producto', () => {
    const n = nombres(texto);
    expect(n[0]).toMatch(/MANI SIN SAL/i);
    expect(n[2]).toMatch(/AJO GRANULADO/i);
    expect(n[4]).toMatch(/ALMENDRAS/i);
  });

  it('no cuenta EXENTO, SUBTTL ni TOTAL como compras', () => {
    expect(nombres(texto).join(' ')).not.toMatch(/EXENTO|SUBTTL|TOTAL/i);
  });
});

describe('6. Ticket de desechables — mismo formato, cantidades enteras', () => {
  const texto = `000002250
FECHA: 16-09-2026 HORA: 12:14
2 x Bs. 2.500,00
ROLLO PUNTO (G) Bs 5.000,00
1 x Bs. 3.500,00
SERVILLETA ORIGAMI (G) Bs 3.500,00
4 x Bs. 1.900,00
PORTA PERRO G (G) Bs 7.600,00
4 x Bs. 1.100,00
BOLSA CELOFAN #10X18 (G) Bs 4.400,00
4 x Bs. 670,00
VASO #17 MAXIPLAST (G) Bs 2.680,00
SUBTTL Bs 23.180,00
BI G16,00% Bs 23.180,00
IVA G16,00% Bs 3.708,80
TOTAL Bs 26.888,80`;

  it('lee los cinco renglones con su cantidad y su precio unitario', () => {
    const r = resumen(texto);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual(expect.objectContaining({ qty: 2, unitCost: 2500 }));
    expect(r[2]).toEqual(expect.objectContaining({ qty: 4, unitCost: 1900 }));
    expect(r[4]).toEqual(expect.objectContaining({ qty: 4, unitCost: 670 }));
  });

  it('"BOLSA CELOFAN #10X18" no es un bulto de 18', () => {
    // El #10X18 es la medida de la bolsa en pulgadas, no el contenido.
    const bolsa = parseInvoiceLines(texto)[3];
    expect(bolsa.qty).toBe(4);
    expect(bolsa.unitCost).toBe(1100);
  });
});

describe('7. Ticket de punto de venta — a veces llega solo el voucher con el monto', () => {
  // "a veces el solo el ticket del punto de venta con el monto" (dueño, 17/09).
  const texto = `MENDEZ CARMONA JOSE ELAZAR
ARAGUA
RIF:V0091265792
Venta DEBITO
MASTERCARD (CL) 541105******6197
MERCANTIL BANCO J-90000008-0
Fecha: 16/09/2026 Hora: 11:22:32 a. m.
No. Autor. No.Operac.
224862 305894
Terminal 22 Lote 239 Ticket 7271
MONTO Bs. 3.600,00
NO REQUIERE FIRMA
Debit Mastercard
AID:A0000000041010 CT:0215FF5F4B27E26D
0-09.06.06 V-80 VERSION: 1.4.49b`;

  it('un voucher de punto de venta no trae renglones que cargar', () => {
    // "Terminal 22 Lote 239 Ticket 7271" cumplia de sobra el criterio de
    // renglon: tres numeros y palabras largas. Cargaba 22 "terminales".
    expect(parseInvoiceLines(texto)).toEqual([]);
  });
});

describe('8 y 9. Los otros dos Pago Movil: la app y la web del banco', () => {
  const app = `PagomóvilBDV Personas
2.105,52 Bs
Fecha: 15/09/2026
Operación: 007346037777
Identificación: 28219407
Origen: 0102****9486
Destino: 04120000009
Banco: 0102 - BANCO DE VENEZUELA
Concepto: ridery`;

  // La web del banco no escribe "Bs" al lado del monto ni usa las mismas
  // etiquetas que la app: aqui es "Monto de la Operación" y "Banco Receptor".
  const web = `Resultado de PagomóvilBDV
Tu PagomóvilBDV ha sido realizado con éxito. El número de operación es: 001463363950
Banco Receptor: BANESCO
Teléfono Receptor: 0414***6055
Cédula Receptor: 14***452
Monto de la Operación: 49.949,30
Concepto: gas
Banco de Venezuela, S.A. Banco Universal © RIF G-90000009-0.`;

  it('ninguno de los dos trae renglones', () => {
    expect(parseInvoiceLines(app)).toEqual([]);
    expect(parseInvoiceLines(web)).toEqual([]);
  });
});

describe('10. La nota de Coca-Cola tal como la leyo el OCR (foto real, 17/09/2026)', () => {
  // De esta foto el bot sacaba 6 "renglones": el RIF con el telefono como
  // 508.222.202 unidades, la direccion ("LOCAL NRO 29 Y 30"), el codigo del
  // producto como cantidad, "Total ARTICULOS" y la linea del IVA. La nota no
  // trae precio por renglon (solo el total en dolares): los productos salen
  // sin costo y el socio lo pone en el bot.
  const texto = `Serie 31
NOT
'A DE REFERENCIA No Fiscal
31FP9599097
320103 NOMBRE DEL CLIENTE, C.A. 17/09/2026
508222202 1650 OLEA 4120000010 ea
Direccion
PROVIDENCIA TURM
LOCAL NRO 29 Y 30 SECTOR LA
1
de Entrega AY INTERCOMUNAL SANTIAGO MARIÑO ESTE
101. COCA-COLA 3500C
223 COCA-COLA ORIG PET 1LTX6 5
224 COCA COLA PET1,5LT SUN 3
7 Total ARTICULOS --==-: > 9
DOLARES . 54,49
LU Be 39.804,26 IVA: Bs 6.368,68 TOTAL: BS`;

  it('saca los 3 productos, sin costo, y nada mas: ni el RIF, ni la direccion, ni el total', () => {
    const r = parseInvoiceLines(texto);
    expect(r.map((l) => [l.text, l.qty, l.unitCost])).toEqual([
      // La cantidad de este renglon el OCR la dejo en otra linea: sale en blanco.
      ['101. COCA-COLA 3500C', null, null],
      ['223 COCA-COLA ORIG PET 1LTX6 5', 5, null],
      ['224 COCA COLA PET1,5LT SUN 3', 3, null],
    ]);
  });

  it('un numero de 8+ cifras (RIF, telefono, cedula) nunca es una cantidad', () => {
    const r = parseInvoiceLines('508222202 1650 OLEA 4120000010 ea');
    expect(r.every((l) => (l.qty ?? 0) < 100000)).toBe(true);
  });

  it('el codigo del producto no se lee como cantidad cuando falta el precio', () => {
    const [l] = parseInvoiceLines('223 COCA-COLA ORIG PET 1LTX6 5');
    expect(l.qty).toBe(5);
    expect(l.unitCost).toBeNull();
    expect(l.unitsPerPack).toBe(6);
    // 5 paquetes de 6, no 5 botellas.
    expect(l.invoiceUnit).toBe('CAJA');
  });

  it('"6UN" tambien dice que se cuentan paquetes; sin contenido, se cuenta suelto', () => {
    expect(parseInvoiceLines('224 COCA COLA PET1,5LT 6UN 3')[0]).toMatchObject({
      qty: 3,
      unitsPerPack: 6,
      invoiceUnit: 'CAJA',
    });
    expect(parseInvoiceLines('101 COCA-COLA 350CC 1')[0]).toMatchObject({
      qty: 1,
      unitsPerPack: null,
      invoiceUnit: null,
    });
  });

  it('el codigo de cliente (6 cifras) con la fecha no es un producto', () => {
    expect(
      parseInvoiceLines('320103 NOMBRE DEL CLIENTE, C.A. 17/09/2026'),
    ).toEqual([]);
  });

  it('ni cuando el OCR le come una cifra al codigo de cliente', () => {
    expect(parseInvoiceLines('20103 NOMBRE DEL CLIENTE, C.A. Mano')).toEqual(
      [],
    );
  });

  it('la version en PDF de la misma factura se sigue leyendo bien', () => {
    const r = parseInvoiceLines(
      '223 COCA-COLA ORIG PET 1LTX6 4,31 5 21,55 16,00',
    );
    expect(r).toHaveLength(1);
    expect(r[0].qty).toBe(5);
    expect(r[0].unitCost).toBe(4.31);
  });
});

describe('las reglas nuevas no se comen productos de verdad', () => {
  // "AV" (avenida) o "IVA" sueltos no pueden tumbar un renglon por aparecer
  // DENTRO de una palabra.
  it.each([
    'PAVO AHUMADO KG 2 850,00 1.700,00',
    'LAVAPLATOS AXION 3 120,00 360,00',
    'SALSA ACTIVA PICANTE 2 90,00 180,00',
    'TURBO LIMPIADOR 1 45,00 45,00',
  ])('%s sigue siendo un renglon', (linea) => {
    expect(parseInvoiceLines(linea)).toHaveLength(1);
  });
});

describe('el codigo del proveedor identifica el producto (Coca-Cola)', () => {
  const alias = [
    {
      aliasKey: '#223',
      productId: 'C1L',
      productName: 'Coca Cola 1 lt',
      unitsPerPack: 6,
    },
  ];

  it('la clave de un renglon con codigo es el codigo, lea lo que lea el OCR en la descripcion', () => {
    expect(claveDeAlias('223 COCA-COLA ORIG PET 1LTX6 5')).toBe('#223');
    expect(claveDeAlias('223. COCA C0LA 0RIG PET 5')).toBe('#223');
    // Sin codigo, la clave de siempre.
    expect(claveDeAlias('SOLERA LIGHT RET 222Mlx36UN 15 C 23,01 345,22')).toBe(
      'SOLERA LIGHT RET',
    );
  });

  it('la siguiente nota empareja por el codigo aunque el OCR lea otra descripcion', () => {
    const lineas = parseInvoiceLines('223 COCA C0LA 0RIG PETILTX6 4');
    const [m] = matchLinesToProducts(
      lineas,
      [{ id: 'LATA', name: 'Coca Cola Lata' }],
      alias,
    );
    expect(m).toMatchObject({
      qty: 4,
      matchedProductId: 'C1L',
      source: 'alias',
      score: 1,
    });
  });

  it('otro codigo no se parece al aprendido', () => {
    const lineas = parseInvoiceLines('224 COCA COLA PET1,5LT 6UN 3');
    const [m] = matchLinesToProducts(lineas, [], alias);
    expect(m.matchedProductId).toBeNull();
  });
});

describe('presupuesto de Viveluso: codigo, descripcion, cantidad, UNIDAD, precio (foto real 18/09/2026)', () => {
  // Renglones tal como los leyo el OCR, con su ruido.
  const casos: Array<
    [string, number, number, number | null, string | null, string | null]
  > = [
    [
      'A0148 ACEIT SOL Y OLIVA CARBONEL ASXILT CAJA y + 0.201 CAJ 146.61 0.00',
      0.201,
      146.61,
      null,
      'CAJA',
      null,
    ],
    [
      'A0194 ANCHOAS BONGUSTII 12X200gr CAJA L 2 0.167 CA 55.03 0.00',
      0.167,
      55.03,
      12,
      'CAJA',
      null,
    ],
    [
      'P0046 PAPA FRITA PERRO 1Kg FRITO MIX PAQUETE » 15.000 UND 5.90 0.00',
      15,
      5.9,
      null,
      'UNIDAD',
      null,
    ],
    [
      "Q0281' QUE MOZZARELLA MONTESANO KILO 28.160 KG 12,54 0.00 35214",
      28.16,
      12.54,
      null,
      null,
      'kg',
    ],
    [
      '(C0095 CREMA DE COCINA MASTER TOP 12X1Lt CAJA Y” 1.000 CAJ 80.17 po Ne',
      1,
      80.17,
      12,
      'CAJA',
      null,
    ],
    [
      '50099 SAL BAHIA EVAPORADA 25XIKG BULTO — |/ + 0.240 BUL 22.24 e pa!',
      0.24,
      22.24,
      null,
      'BULTO',
      null,
    ],
    [
      'A0002  ATUN ACEITE MARGARITA 24X170gr CAJA eS + 0.250 CAJ 83,52 0.00 1 !',
      0.25,
      83.52,
      24,
      'CAJA',
      null,
    ],
    // El OCR se comio el punto de la cantidad: 0.834 cajas y 3.000 kilos.
    [
      'A0250  ACEIT SOYA LA LUCHA 12X900ML CAJA Y ” 083 CA 31.98 00',
      0.83,
      31.98,
      12,
      'CAJA',
      null,
    ],
    [
      '20357 — MORTADELA CARNE CORTA ESPECIAL ARICHUNA KILO Y 3000 KG 3.18 0.00',
      3,
      3.18,
      null,
      null,
      'kg',
    ],
  ];

  it.each(casos)(
    '%s',
    (linea, qty, unitCost, unitsPerPack, invoiceUnit, measureUnit) => {
      const [l] = parseInvoiceLines(linea);
      expect(l).toMatchObject({ qty, unitCost, unitsPerPack, invoiceUnit });
      expect(l.measureUnit ?? null).toBe(measureUnit);
    },
  );

  it('el codigo alfanumerico identifica el producto, aunque el OCR lea O por 0', () => {
    expect(
      claveDeAlias(
        'A0148 ACEIT SOL Y OLIVA CARBONEL 15X1LT CAJA 0.201 CAJ 146.61',
      ),
    ).toBe('#A0148');
    expect(
      claveDeAlias(
        'HO124 HUEVOS TIPO A CARIDAD 12 CARTONES CAJA 1.000 CA 72.94',
      ),
    ).toBe('#H0124');
    expect(
      claveDeAlias("Q0281' QUE MOZZARELLA MONTESANO KILO 28.160 KG 12,54"),
    ).toBe('#Q0281');
    expect(claveDeAlias('(C0095 CREMA DE COCINA MASTER TOP 12X1Lt CAJA')).toBe(
      '#C0095',
    );
  });
});

describe('contenido del bulto escrito con la cantidad primero', () => {
  it.each([
    ['ACEIT SOYA LA LUCHA 12X900ML CAJA', 12],
    ['ACEIT SOL Y OLIVA CARBONEL 15X1LT CAJA', 15],
    ['ATUN ACEITE MARGARITA 24X170gr CAJA', 24],
    ['SAL BAHIA EVAPORADA 25X1KG BULTO', 25],
    // Los de siempre, con el contenido despues, no cambian.
    ['SOLERA LIGHT RET 222Mlx36UN', 36],
    ['PEPSI PET 1.5LX6UN', 6],
    ['MIN SPARKLING GINGER LAT355X24', 24],
    ['PAN HARINA 1KGX20UND', 20],
  ])('%s -> %i', (texto, n) => {
    expect(extractUnitsPerPack(texto)).toBe(n);
  });
});
