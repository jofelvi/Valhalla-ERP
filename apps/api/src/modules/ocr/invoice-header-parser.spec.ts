import {
  parseInvoiceHeader,
  referenciaDeOperacion,
} from './invoice-header-parser';

const FACTURA_BS = `
DISTRIBUIDORA VIVELUSO C.A.
RIF: J-90000004-0
FACTURA N 000123   FECHA: 03/09/2026
HARINA PAN 1KGX20      20   850,00   17.000,00
ACEITE 1L              5    290,00    1.450,00
SUB-TOTAL                         18.450,00
IVA 16%                            2.952,00
TOTAL Bs                          21.402,00
`;

const FACTURA_USD = `
POLAR DISTRIBUCION
J-90000011-0
Fecha 02-09-2026
CERVEZA PILSEN 222MLx36UN   15 C   23,01   345,15
SUBTOTAL $ 345,15
TOTAL A PAGAR $ 345,15
`;

describe('parseInvoiceHeader', () => {
  it('toma el TOTAL (no el SUB-TOTAL) y detecta Bs', () => {
    const h = parseInvoiceHeader(FACTURA_BS);
    expect(h.total).toBe(21402);
    expect(h.currency).toBe('BS');
    expect(h.date).toBe('03/09/2026');
    expect(h.rif).toBe('J-90000004-0');
    expect(h.vendor).toBe('DISTRIBUIDORA VIVELUSO C.A.');
  });

  it('detecta $ y el TOTAL A PAGAR, con RIF sin guion final', () => {
    const h = parseInvoiceHeader(FACTURA_USD);
    expect(h.total).toBe(345.15);
    expect(h.currency).toBe('USD');
    expect(h.rif).toBe('J-90000011-0');
    expect(h.vendor).toBe('POLAR DISTRIBUCION');
    expect(h.date).toBe('02-09-2026');
  });

  it('sin linea TOTAL cae al mayor monto y moneda nula', () => {
    const h = parseInvoiceHeader('PAN 2 1.500,00\nQUESO 1 4.200,00');
    expect(h.total).toBe(4200);
    expect(h.currency).toBeNull();
    expect(h.amounts).toEqual([1500, 4200]);
  });

  it('texto vacio devuelve todo nulo sin lanzar', () => {
    expect(parseInvoiceHeader('')).toEqual({
      total: null,
      currency: null,
      date: null,
      rif: null,
      vendor: null,
      amounts: [],
      totalCandidates: [],
      esPago: false,
      concepto: null,
    });
  });

  it('el OCR lee "8s" o "Es" en vez de Bs y aun asi es bolivares', () => {
    expect(parseInvoiceHeader('TOTAL 8s 1.200,00').currency).toBe('BS');
    expect(parseInvoiceHeader('TOTAL Es 1.200,00').currency).toBe('BS');
  });
});

describe('parseInvoiceHeader — comprobante de Pago Movil', () => {
  // Capture real del 10/09/2026: la app del banco pone el "Bs" DESPUES del
  // monto y no escribe la palabra TOTAL en ningun lado.
  const PAGO_MOVIL = [
    'PagomóvilBDV Personas',
    '58.274,18 Bs',
    'Fecha: 10/09/2026',
    'Operación: 007295687556',
    'Banco: 0102 - BANCO DE VENEZUELA',
    'Concepto: tomates 2 cestas',
  ].join('\n');

  it('detecta bolivares con el "Bs" despues del monto', () => {
    const h = parseInvoiceHeader(PAGO_MOVIL);
    expect(h.total).toBe(58274.18);
    expect(h.currency).toBe('BS');
  });

  it('el "Bs" pegado al monto en la linea del TOTAL sigue siendo bolivares', () => {
    expect(parseInvoiceHeader('TOTAL 1.200,00 Bs').currency).toBe('BS');
    expect(parseInvoiceHeader('TOTAL 1.200,00Bs').currency).toBe('BS');
  });

  it('no confunde con dolares cuando la factura trae $', () => {
    expect(parseInvoiceHeader('TOTAL A PAGAR $ 345,15').currency).toBe('USD');
  });
});

/**
 * COMPROBANTES DE PAGO REALES (17/09/2026).
 *
 * Buena parte de los gastos de Negocio no llegan como factura sino como la
 * captura del Pago Movil o el voucher del punto de venta. Ahi no hay nada que
 * cargar al inventario, pero SI esta el monto y —lo mejor— el concepto que el
 * socio escribio al pagar: "panes perro", "ridery", "gas".
 */
describe('parseInvoiceHeader — comprobantes de pago', () => {
  const pagoMovilApp = `PagomóvilBDV Personas
52.541,54 Bs
Fecha: 17/09/2026
Operación: 007369741836
Identificación: 06262322
Origen: 0102****9486
Destino: 04140000008
Banco: 0134 - BANESCO
Concepto: panes perro`;

  const pagoMovilWeb = `Resultado de PagomóvilBDV
Tu PagomóvilBDV ha sido realizado con éxito. El número de operación es: 001463363950
Banco Receptor: BANESCO
Teléfono Receptor: 0414***6055
Cédula Receptor: 14***452
Monto de la Operación: 49.949,30
Concepto: gas
Banco de Venezuela, S.A. Banco Universal © RIF G-90000009-0.`;

  const voucherPos = `MENDEZ CARMONA JOSE ELAZAR
ARAGUA
RIF:V0091265792
Venta DEBITO
MASTERCARD (CL) 541105******6197
MERCANTIL BANCO J-90000008-0
Fecha: 16/09/2026 Hora: 11:22:32 a. m.
Terminal 22 Lote 239 Ticket 7271
MONTO Bs. 3.600,00
NO REQUIERE FIRMA`;

  it('reconoce que son pagos y no facturas', () => {
    expect(parseInvoiceHeader(pagoMovilApp).esPago).toBe(true);
    expect(parseInvoiceHeader(pagoMovilWeb).esPago).toBe(true);
    expect(parseInvoiceHeader(voucherPos).esPago).toBe(true);
  });

  it('saca el monto de cada uno', () => {
    expect(parseInvoiceHeader(pagoMovilApp).total).toBe(52541.54);
    expect(parseInvoiceHeader(pagoMovilWeb).total).toBe(49949.3);
    expect(parseInvoiceHeader(voucherPos).total).toBe(3600);
  });

  it('toma el concepto como descripcion del gasto', () => {
    expect(parseInvoiceHeader(pagoMovilApp).concepto).toBe('panes perro');
    expect(parseInvoiceHeader(pagoMovilWeb).concepto).toBe('gas');
  });

  it('el Pago Movil es en bolivares aunque la web no lo diga', () => {
    expect(parseInvoiceHeader(pagoMovilWeb).currency).toBe('BS');
    expect(parseInvoiceHeader(pagoMovilApp).currency).toBe('BS');
  });

  it('una factura normal no se confunde con un pago', () => {
    const factura = `DISTRIBUIDORA VIVELUSO C.A.
RIF: J-90000004-0
HARINA PAN 1KGX20 20 850,00
TOTAL Bs 17.000,00`;
    const h = parseInvoiceHeader(factura);
    expect(h.esPago).toBe(false);
    expect(h.concepto).toBeNull();
  });
});

describe('parseInvoiceHeader — varios montos en la misma factura', () => {
  // "es importante que si en la factura ve varios montos pregunte cual es el
  // correcto, el usuario sabe cual es" (dueño, 17/09/2026).
  it('la nota de Polar pone la deuda acumulada debajo del total', () => {
    const polar = `SOLERA LIGHT RET 222Mlx36UN 15 C 23.01 345.22
Deuda Actual: $ 7222.04
Sub-Total 861.43
Iva 0.00
Total 861.43`;
    const c = parseInvoiceHeader(polar).totalCandidates.map((x) => x.monto);
    expect(c).toContain(861.43);
    expect(c).toContain(7222.04);
    // El total de la compra va primero: es lo que el socio confirma de un toque.
    expect(c[0]).toBe(861.43);
  });

  it('Coca-Cola trae el monto en dolares y en bolivares', () => {
    const coca = `Monto USD: 54,49
Total ARTÍCULOS 9 46,97
BI: Bs 39.804,26 IVA: BS 6.368,68 TOTAL: Bs 46.172,94
SUB TOTAL 46,97
TOTAL A PAGAR 54,49`;
    const c = parseInvoiceHeader(coca).totalCandidates;
    // Lo que se paga, en dolares, primero; el total en Bs queda como opcion EN Bs.
    expect(c[0]).toEqual({ monto: 54.49, moneda: 'USD' });
    expect(c).toContainEqual({ monto: 46172.94, moneda: 'BS' });
    expect(c.map((x) => x.monto)).toContain(46.97);
  });

  it('un ticket con un solo monto no da nada que elegir', () => {
    expect(parseInvoiceHeader('MONTO Bs. 3.600,00').totalCandidates).toEqual([
      { monto: 3600, moneda: 'BS' },
    ]);
  });
});

describe('parseInvoiceHeader — la nota de Coca-Cola tal como la leyo el OCR (17/09/2026)', () => {
  // Texto REAL de la foto que mando el dueño. "me puso el menor": el bot
  // propuso Bs 6.368,68, que es el IVA. La foto corto el total en Bs
  // ("TOTAL: BS" sin numero) y el parser se quedo con el ultimo numero de esa
  // linea. Lo que se pago son $54,49, que estaba en la linea "DOLARES" y ni
  // siquiera se ofrecia como opcion.
  const coca = `Serie 31
'A DE REFERENCIA No Fiscal
31FP9599097
320103 NOMBRE DEL CLIENTE, C.A. 17/09/2026
101. COCA-COLA 3500C
223 COCA-COLA ORIG PET 1LTX6 5
224 COCA COLA PET1,5LT SUN 3
7 Total ARTICULOS --==-: > 9
DOLARES . 54,49
ST. NOMBRE DEL CLIENTE
izar la tasa vigente del día
os de la LIVA el TC del BCV utilizado en la factura
LU Be 39.804,26 IVA: Bs 6.368,68 TOTAL: BS`;

  it('propone los $54,49 en dolares, no el IVA', () => {
    const h = parseInvoiceHeader(coca);
    expect(h.total).toBe(54.49);
    expect(h.currency).toBe('USD');
  });

  it('el IVA y la base quedan como opciones, cada una en su moneda', () => {
    const c = parseInvoiceHeader(coca).totalCandidates;
    expect(c[0]).toEqual({ monto: 54.49, moneda: 'USD' });
    expect(c).toContainEqual({ monto: 39804.26, moneda: 'BS' });
    expect(c).toContainEqual({ monto: 6368.68, moneda: 'BS' });
  });

  it('en una linea con TOTAL solo cuenta el numero que viene DESPUES de la palabra', () => {
    const h = parseInvoiceHeader(
      'BI: Bs 39.804,26 IVA: Bs 6.368,68 TOTAL: Bs 46.172,94',
    );
    expect(h.total).toBe(46172.94);
  });

  it('"TOTAL A PAGAR" le gana a un "TOTAL" anterior', () => {
    expect(
      parseInvoiceHeader('TOTAL 46,97\nSUB TOTAL 46,97\nTOTAL A PAGAR 54,49')
        .total,
    ).toBe(54.49);
  });

  it('las divisas de Tony quedan como opcion en dolares', () => {
    const h = parseInvoiceHeader('TOTAL A PAGAR Bs.: 1.904,65\nDivisas :2.25');
    expect(h.total).toBe(1904.65);
    expect(h.currency).toBe('BS');
    expect(h.totalCandidates).toContainEqual({ monto: 2.25, moneda: 'USD' });
  });
});

describe('referenciaDeOperacion — el mismo pago fotografiado dos veces', () => {
  it('las dos capturas del Ridery duplicado del 17/09 dan la misma referencia', () => {
    // Registrado dos veces (23:09 y 23:16). El OCR leyo distinto las cifras
    // del principio, no las del final.
    const comprobante =
      'PagomóvilBDV Personas\n2.118,61 Bs\nFecha: 17/09/2026\nOperación: 007374924115 m)';
    const detalle =
      'Operacion pagomovil bdv\n-2.118,61 Bs\nFecha: 17/09/2026\nHora: 10:01 PM\nOperación: 0677274924115 [O';
    expect(referenciaDeOperacion(comprobante)).toBe('74924115');
    expect(referenciaDeOperacion(detalle)).toBe(
      referenciaDeOperacion(comprobante),
    );
  });

  it('dos Ridery distintos del mismo monto NO se confunden', () => {
    expect(referenciaDeOperacion('Operación: 007374865733')).not.toBe(
      referenciaDeOperacion('Operación: 007374902846'),
    );
  });

  it('lee la web del BDV y una factura sin operacion da null', () => {
    expect(
      referenciaDeOperacion('El número de operación es: 001463363950'),
    ).toBe('63363950');
    expect(referenciaDeOperacion('TOTAL Bs 26.888,80')).toBeNull();
  });
});

describe('nota de Viveluso: la deuda con el proveedor no es el total (18/09/2026)', () => {
  // Pie tal como lo leyo el OCR de la foto real: "Total" salio "| Otal".
  const pie = [
    'PEPSIPETISIXGUN 3C 698 1796',
    'Sub-Total 861.43',
    'Deuda Actual: $ 7222.04 va 0.00',
    'Beso 0',
    '| Otal 861.43',
  ].join('\n');

  it('propone el total de la compra, no la deuda', () => {
    const h = parseInvoiceHeader(pie);
    expect(h.total).toBe(861.43);
    expect(h.currency).toBe('USD');
  });

  it('sin la linea del total, cae al sub-total y nunca a la deuda', () => {
    const h = parseInvoiceHeader(pie.split('\n').slice(0, 4).join('\n'));
    expect(h.total).toBe(861.43);
  });

  it('sin total ni sub-total, el mayor monto sin contar la deuda', () => {
    const h = parseInvoiceHeader(
      'PEPSI 3C 5.98 17.96\nDeuda Actual: $ 7222.04',
    );
    expect(h.total).toBe(17.96);
  });
});
