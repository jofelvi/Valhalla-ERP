import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReceipt,
  buildFicha,
  buildRondaTicket,
  buildPrecuenta,
} from '../src/escpos/receiptBuilder';
import { PrintRequest } from '../src/types/printRequest';

// Bytes de parametros de cada comando ESC (0x1b) y GS (0x1d) que usa el
// servicio. Un comando sin tabla se toma sin parametros.
const PARAMS_ESC: Record<number, number> = {
  0x40: 0, // ESC @  init
  0x74: 1, // ESC t  tabla de caracteres
  0x45: 1, // ESC E  negrita
  0x61: 1, // ESC a  alineacion
  0x21: 1, // ESC !  modo de texto
  0x64: 1, // ESC d  avanzar lineas
  0x2d: 1, // ESC -  subrayado
  0x69: 0, // ESC i  corte total
  0x6d: 0, // ESC m  corte parcial
};
const PARAMS_GS: Record<number, number> = {
  0x21: 1, // GS !  tamano
  0x42: 1, // GS B  video inverso
  0x56: 1, // GS V  corte
};

// Texto que ve el cliente de un ticket: quita comandos y el raster del QR
// (GS v 0 m xL xH yL yH + datos) y se queda con los caracteres imprimibles.
function textoDeTicket(buf: Buffer): string {
  let out = '';
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x1b) {
      i += 2 + (PARAMS_ESC[buf[i + 1]] ?? 0);
      continue;
    }
    if (b === 0x1d) {
      if (buf[i + 1] === 0x76) {
        // GS v 0 m xL xH yL yH: el ancho va en bytes y el alto en puntos.
        const xL = buf[i + 4];
        const xH = buf[i + 5];
        const yL = buf[i + 6];
        const yH = buf[i + 7];
        i += 8 + (xL + 256 * xH) * (yL + 256 * yH);
        continue;
      }
      i += 2 + (PARAMS_GS[buf[i + 1]] ?? 0);
      continue;
    }
    const ch = String.fromCharCode(b);
    if (/[\x20-\x7e\n]/.test(ch)) out += ch;
    i++;
  }
  return out;
}
const texto = textoDeTicket;

// Palabras del formato fijo de los tickets (etiquetas, nunca datos de negocio).
const FORMATO = new Set([
  'INICIO',
  'FIN',
  'CORTAR',
  'FACTURA',
  'PRECUENTA',
  'RONDA',
  'FICHA',
  'PRODUCTOS',
  'Subtotal',
  'Orden',
  'Fecha',
  'Hora',
  'Tipo',
  'Mesa',
  'Cliente',
  'Mesonero',
  'Producto',
  'Bartender',
  'Entregadas',
  'Pendientes',
  'Esta',
  'ronda',
  'TOTAL',
  'Bs',
  'USD',
  'PAGOS',
  'PAGO',
  'MOVIL',
  'Tel',
  'RIF',
  'CI',
  'Tasa',
  'BCV',
  'Descuento',
  'Propina',
  'Servicio',
  'IVA',
  'NO',
  'ES',
  'Total',
  'pendiente',
  'TE',
  'QUEDA',
  'PENDIENTE',
  'Entrega',
  'total',
  'o',
  'parcial',
  'Presente',
  'este',
  'QR',
  'en',
  'la',
  'barra',
  'cocina',
  'pizza',
  'DE',
  'BARRA',
  'COCINA',
  'PIZZA',
  'Si',
  'lees',
  'PRUEBA',
  'IMPRESORA',
  'Impresora',
  'Modo',
  'funciona',
  'OK',
  'cerv',
  'COPIA',
  'REIMPRESION',
  'RESUMEN',
  'NOTA',
  'SIN',
  'ESCANEAR',
  'PARA',
  'ENTREGAR',
  'c',
  'u',
  'x',
  'pedido',
  'INCLUYE',
  'Sin',
  'mesa',
]);

// Palabras del ticket que no salen del pedido ni del formato: texto ajeno.
function palabrasAjenas(ticket: string, pedido: unknown): string[] {
  const delPedido = new Set<string>();
  const recorrer = (v: unknown): void => {
    if (typeof v === 'string') {
      for (const w of v.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]+/g) ?? []) delPedido.add(w);
    } else if (Array.isArray(v)) {
      v.forEach(recorrer);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(recorrer);
    }
  };
  recorrer(pedido);
  const palabras = ticket.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]+/g) ?? [];
  return palabras.filter((w) => !FORMATO.has(w) && !delPedido.has(w));
}

// Payload minimo: lo que manda un POS sin datos de negocio cargados.
const minimo: PrintRequest = {
  businessName: '',
  orderNumber: 'A1',
  date: '01/01/2026',
  time: '10:00',
  items: [{ quantity: 1, name: 'Cafe', unitPrice: 2, total: 2 }],
  subtotal: 2,
  tax: 0,
  total: 2,
  payments: [],
};

test('factura minima: todo el texto sale del pedido o del formato', () => {
  const t = texto(buildReceipt(minimo));
  assert.deepEqual(palabrasAjenas(t, minimo), []);
  assert.ok(t.includes('Cafe'), 'debe imprimir el producto');
  assert.ok(t.includes('TOTAL:'), 'debe imprimir el total');
  assert.ok(!t.includes('Tel:'), 'sin telefono no hay linea Tel');
  assert.ok(!t.includes('RIF:'), 'sin RIF no hay linea RIF');
  assert.ok(!t.includes('undefined') && !t.includes('null'));
});

test('la factura imprime solo los datos de negocio que trae el pedido', () => {
  const pedido: PrintRequest = {
    ...minimo,
    businessName: 'Mi Negocio',
    address: 'Calle 1',
    phone: '0000',
    rif: 'X-1',
    footerMessage: 'Vuelva pronto',
    footerBrand: 'Pie de prueba',
  };
  const t = texto(buildReceipt(pedido));
  assert.ok(t.includes('Mi Negocio'));
  assert.ok(t.includes('Calle 1'));
  assert.ok(t.includes('Tel: 0000'));
  assert.ok(t.includes('RIF: X-1'));
  assert.ok(t.includes('Vuelva pronto'));
  assert.ok(t.includes('Pie de prueba'));
  assert.deepEqual(palabrasAjenas(t, pedido), []);
});

test('la linea de servicio aparece con serviceLabel y desaparece sin el', () => {
  const con = texto(
    buildReceipt({
      ...minimo,
      serviceCharge: 0.2,
      serviceLabel: 'Servicio (10%)',
    }),
  );
  assert.ok(con.includes('Servicio (10%):'), 'con etiqueta debe imprimirla');
  assert.ok(con.includes('$0.20'));

  const sin = texto(buildReceipt({ ...minimo, serviceCharge: 0.2 }));
  assert.ok(!sin.includes('Servicio'), 'sin etiqueta no debe haber linea');
});

test('servicio incluido imprime la etiqueta sin monto', () => {
  const t = texto(
    buildReceipt({
      ...minimo,
      serviceCharge: 0,
      serviceLabel: 'Servicio incluido',
    }),
  );
  assert.ok(t.includes('Servicio incluido'));
  assert.ok(!t.includes('Servicio incluido:'), 'sin monto no lleva dos puntos');
});

test('el impuesto sumado va con su etiqueta; sin etiqueta no hay linea', () => {
  const con = texto(
    buildReceipt({ ...minimo, tax: 0.32, taxLabel: 'IVA (16%)' }),
  );
  assert.ok(con.includes('IVA (16%):'));

  const sin = texto(buildReceipt({ ...minimo, tax: 0.32 }));
  assert.ok(!sin.includes('IVA'), 'sin taxLabel no se inventa el IVA');
});

test('impuesto incluido se imprime como desglose despues del TOTAL', () => {
  const t = texto(
    buildReceipt({
      ...minimo,
      tax: 0.32,
      taxLabel: 'IVA incluido (16%)',
      taxMode: 'included',
    }),
  );
  const posTotal = t.indexOf('TOTAL:');
  const posIva = t.indexOf('IVA incluido (16%):');
  assert.ok(posTotal >= 0 && posIva > posTotal, 'el desglose va tras el TOTAL');
});

test('pago movil solo se imprime si el pedido trae sus datos', () => {
  const sin = texto(buildReceipt({ ...minimo, qrData: 'x' }));
  assert.ok(!sin.includes('PAGO MOVIL'), 'sin pagoMovil no hay bloque');

  const pedido: PrintRequest = {
    ...minimo,
    pagoMovil: { banco: 'Banco X', telefono: '0412', documento: 'V-1' },
  };
  const con = texto(buildReceipt(pedido));
  assert.ok(con.includes('PAGO MOVIL:'));
  assert.ok(con.includes('Banco X'));
  assert.ok(con.includes('Tel: 0412'));
  assert.ok(con.includes('CI: V-1'));
  assert.deepEqual(palabrasAjenas(con, pedido), []);
});

test('ficha, ronda y precuenta sin businessName solo imprimen formato y pedido', () => {
  const fichaPedido = {
    orderNumber: 'A1',
    date: '01/01/2026',
    time: '10:00',
    qrData: 'AR1.test',
    items: [{ productName: 'Cerveza', pendingQty: 2 }],
    totalPending: 2,
    station: 'BAR' as const,
  };
  const ficha = texto(buildFicha(fichaPedido));
  assert.ok(ficha.includes('FICHA DE BARRA'));
  assert.deepEqual(palabrasAjenas(ficha, fichaPedido), []);

  const rondaPedido = {
    orderNumber: 'A1',
    productName: 'Tobo',
    rondaNum: 1,
    unitsThisRound: 4,
    totalDelivered: 4,
    totalUnits: 12,
    time: '10:00',
  };
  const ronda = texto(buildRondaTicket(rondaPedido));
  assert.deepEqual(palabrasAjenas(ronda, rondaPedido), []);

  const precuentaPedido = {
    orderNumber: 'A1',
    date: '01/01/2026',
    time: '10:00',
    items: minimo.items,
    subtotal: 2,
    total: 2,
  };
  const pre = texto(buildPrecuenta(precuentaPedido));
  assert.ok(pre.includes('PRECUENTA'));
  assert.deepEqual(palabrasAjenas(pre, precuentaPedido), []);
});

// ── Recibo simple y que no falla ────────────────────────────────────────────

const tipico: PrintRequest = {
  businessName: 'Pizzeria Los Pinos',
  address: 'Av. Bolivar, local 4',
  phone: '0414-5550101',
  rif: 'J-12345678-9',
  orderNumber: 'A1B2C3D4',
  date: '22/10/2026',
  time: '14:30',
  table: 'Salon Principal',
  items: [
    {
      quantity: 2,
      name: 'Pizza Charcuteria - Pequeña',
      unitPrice: 7,
      total: 14,
    },
    { quantity: 1, name: 'Tender de Pollo x6 UND', unitPrice: 7, total: 7 },
    {
      quantity: 3,
      name: 'Polar Pilsen Lata 355ml',
      unitPrice: 1.75,
      total: 5.25,
    },
  ],
  subtotal: 26.25,
  serviceCharge: 3.15,
  serviceLabel: 'Servicio (12%)',
  tax: 0,
  total: 29.4,
  totalBs: 1234.56,
  bcvRate: 42,
  payments: [{ method: 'CASH_USD', methodLabel: 'Efectivo USD', amount: 29.4 }],
  footerMessage: 'Gracias por su visita',
};

test('el recibo tipico es corto: sin bandas, sin titulos de seccion ni relleno', () => {
  const t = texto(buildReceipt(tipico));
  const lineas = t.split('\n').filter((l) => l.trim() !== '');
  assert.ok(lineas.length <= 24, `demasiado largo: ${lineas.length} lineas`);
  for (const sobra of [
    'INICIO',
    'FIN',
    'CORTAR',
    'FACTURA',
    'PRODUCTOS:',
    'PAGOS:',
    'c/u',
    'Tasa BCV',
    'Hora:',
  ]) {
    assert.ok(!t.includes(sobra), `no debe imprimir "${sobra}"`);
  }
  assert.ok(t.includes('Orden #A1B2C3D4') && t.includes('22/10/2026 14:30'));
  assert.ok(
    t.includes('Pizza Charcuteria - Pequena'),
    'el nombre completo, sin cortar',
  );
  assert.ok(t.includes('TOTAL:') && t.includes('$29.40 USD'));
  assert.ok(t.includes('Efectivo USD'));
});

test('ninguna linea del recibo pasa del ancho del papel', () => {
  const largo: PrintRequest = {
    ...tipico,
    businessName: 'Un Negocio Con Un Nombre Demasiado Largo Para El Papel',
    items: [
      { quantity: 12, name: 'x'.repeat(120), unitPrice: 1234.5, total: 14814 },
    ],
    customerName: 'Cliente Con Nombre Larguisimo Y Apellidos Aun Mas Largos',
  };
  for (const l of texto(buildReceipt(largo)).split('\n')) {
    assert.ok(l.length <= 32, `linea de ${l.length}: ${l}`);
  }
});

test('el recibo nunca falla ni imprime undefined/NaN con datos rotos', () => {
  const rotos: unknown[] = [
    {},
    { items: null, payments: null },
    {
      ...tipico,
      items: [null, undefined, {}, { quantity: 'x', name: 5, total: 'abc' }],
    },
    {
      ...tipico,
      subtotal: NaN,
      total: Infinity,
      tax: -1,
      totalBs: 'mucho',
      serviceCharge: undefined,
    },
    {
      ...tipico,
      payments: [null, {}, { methodLabel: null, amount: NaN }],
      pagoMovil: {},
    },
    {
      ...tipico,
      businessName: null,
      date: undefined,
      time: 7,
      orderNumber: 99,
    },
    {
      ...tipico,
      items: Array.from({ length: 300 }, (_, i) => ({
        quantity: i,
        name: `Item ${i}`,
        unitPrice: 1,
        total: i,
      })),
    },
    {
      ...tipico,
      businessName: 'Ñandú café 🍕 “comillas” — raro',
      footerMessage: '¡Gracias! 😀',
    },
  ];
  for (const r of rotos) {
    let buf: Buffer | undefined;
    assert.doesNotThrow(() => {
      buf = buildReceipt(r as PrintRequest);
    });
    const t = texto(buf as Buffer);
    assert.ok(
      !/undefined|NaN|Infinity|null|\[object/.test(t),
      `texto basura: ${t.slice(0, 200)}`,
    );
    assert.ok(
      (buf as Buffer).length > 10 && (buf as Buffer)[0] === 0x1b,
      'debe empezar con ESC @',
    );
    const fin = (buf as Buffer).subarray(-4);
    assert.ok(
      fin.includes(0x56) || fin.includes(0x6d),
      'debe terminar con el corte de papel',
    );
  }
});

test('todas las combinaciones de servicio e impuesto imprimen un total correcto', () => {
  for (const serviceLabel of [
    undefined,
    'Servicio (12%)',
    'Servicio incluido',
  ]) {
    for (const taxMode of [undefined, 'added', 'included'] as const) {
      for (const taxLabel of [undefined, 'IVA (16%)']) {
        const t = texto(
          buildReceipt({
            ...tipico,
            serviceLabel,
            taxMode,
            taxLabel,
            tax: taxLabel ? 4.2 : 0,
          }),
        );
        assert.ok(
          t.includes('$29.40 USD'),
          `${serviceLabel}/${taxMode}/${taxLabel}`,
        );
      }
    }
  }
});
