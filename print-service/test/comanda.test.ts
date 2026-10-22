import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildComanda, buildCajaSummary } from '../src/escpos/receiptBuilder';
import { textoDeTicket } from '../src/escpos/preview';
import { planearComanda, OpcionesPlan, StationMode } from '../src/comandaPlan';
import { ComandaRequest } from '../src/types/printRequest';

const pedido: ComandaRequest = {
  orderNumber: 'A1B2',
  date: '22/10/2026',
  time: '14:30',
  table: 'Mesa 5',
  waiter: 'Carlos',
  orderType: 'En mesa',
  comment: 'Cliente con prisa',
  items: [
    {
      quantity: 2,
      name: 'Pizza Charcuteria - Pequeña',
      station: 'PIZZA',
      customizations: { removedIngredients: ['cebolla'] },
      notes: 'bien cocida',
    },
    { quantity: 1, name: 'Tender de Pollo x6 UND', station: 'KITCHEN' },
    { quantity: 3, name: 'Polar Pilsen Lata 355ml', station: 'BAR' },
  ],
};

const lineas = (t: string) => t.split('\n').filter((l) => l.trim() !== '');

test('la comanda es corta y trae solo lo necesario para preparar', () => {
  const t = textoDeTicket(buildComanda(pedido, 'COCINA'));
  const l = lineas(t);
  assert.ok(l.length <= 18, `demasiado larga: ${l.length} lineas\n${t}`);
  assert.ok(t.includes('COCINA') && t.includes('#A1B2'));
  assert.ok(t.includes('Mesa 5 - Carlos') && t.includes('14:30'));
  assert.ok(t.includes('2x Pizza Charcuteria - Pequena'));
  assert.ok(t.includes('SIN CEBOLLA') && t.includes('> bien cocida'));
  assert.ok(t.includes('NOTA: Cliente con prisa'));
  for (const sobra of [
    'INICIO',
    'FIN',
    'CORTAR',
    'pedido ',
    '====',
    'ESCANEAR',
  ]) {
    assert.ok(!t.includes(sobra), `no debe imprimir "${sobra}"`);
  }
  for (const linea of t.split('\n')) assert.ok(linea.length <= 32, linea);
});

test('el QR de entrega solo sale si el pedido lo trae', () => {
  assert.ok(!textoDeTicket(buildComanda(pedido, 'BARRA')).includes('[QR]'));
  const t = textoDeTicket(
    buildComanda({ ...pedido, qrData: 'token-123' }, 'BARRA'),
  );
  assert.ok(t.includes('[QR]') && t.includes('ESCANEAR PARA ENTREGAR'));
});

test('copia, tandas y nombres largos se imprimen sin romper el ancho', () => {
  const t = textoDeTicket(
    buildComanda(
      {
        ...pedido,
        isCopy: true,
        table: 'Una Mesa Con Un Nombre Larguisimo Del Salon',
        waiter: 'Un Mesonero Con Nombre Largo',
        items: [
          {
            quantity: 5,
            name: 'x'.repeat(90),
            tandas: [
              { time: '14:30', quantity: 2 },
              { time: '14:40', quantity: 3 },
            ],
          },
        ],
      },
      'BARRA 1',
    ),
  );
  assert.ok(t.includes('** COPIA **') && t.includes('14:40 -> 3'));
  for (const linea of t.split('\n')) assert.ok(linea.length <= 32, linea);
});

test('la comanda y el resumen nunca fallan con datos rotos', () => {
  const rotos: unknown[] = [
    {},
    { items: null },
    {
      ...pedido,
      items: [null, undefined, {}, { quantity: 'x', name: 5, notes: 7 }],
    },
    { ...pedido, orderNumber: null, time: undefined, table: 5, waiter: {} },
    {
      ...pedido,
      items: [
        {
          quantity: 1,
          name: 'A',
          customizations: { removedIngredients: 'cebolla' },
        },
      ],
    },
    {
      ...pedido,
      items: [
        {
          quantity: 1,
          name: 'B',
          tandas: 'x',
          customizations: { removedIngredients: [null, 7, 'sal'] },
        },
      ],
    },
    {
      ...pedido,
      items: Array.from({ length: 200 }, (_, i) => ({
        quantity: i,
        name: `Item ${i}`,
      })),
    },
    { ...pedido, comment: '😀 ñandú “raro” '.repeat(20) },
  ];
  for (const r of rotos) {
    for (const f of [buildComanda, buildCajaSummary]) {
      let buf: Buffer | undefined;
      assert.doesNotThrow(() => {
        buf = f(r as ComandaRequest, 'COCINA');
      });
      const t = textoDeTicket(buf as Buffer);
      assert.ok(
        !/undefined|NaN|\[object|null/.test(t),
        `texto basura:\n${t.slice(0, 300)}`,
      );
      assert.ok((buf as Buffer)[0] === 0x1b, 'debe empezar con ESC @');
      assert.ok(
        (buf as Buffer).subarray(-4).includes(0x56),
        'debe terminar con el corte',
      );
    }
  }
});

// ── Reparto por estación ────────────────────────────────────────────────────

const base = (
  modo: StationMode,
  extra: Partial<OpcionesPlan> = {},
): OpcionesPlan => ({
  modo,
  impresoras: {
    cocina: 'POS-COCINA',
    pizza: 'POS-COCINA',
    barra: 'POS-BARRA',
    caja: 'POS-CAJA',
  },
  resumenCaja: false,
  filtroBarra: (items) => items,
  ...extra,
});

test('modo both: un papel por estación y NINGÚN resumen de caja por defecto', () => {
  const plan = planearComanda(pedido, base('both'));
  assert.deepEqual(
    plan.papeles.map((p) => p.etiqueta),
    ['COCINA', 'PIZZA', 'BARRA'],
  );
  assert.deepEqual(
    plan.papeles.map((p) => p.items),
    [1, 1, 1],
  );
  assert.ok(!plan.papeles.some((p) => p.etiqueta === 'CAJA'));
});

test('el resumen de caja solo sale con la opción encendida, y avisa', () => {
  const plan = planearComanda(pedido, base('both', { resumenCaja: true }));
  assert.equal(plan.papeles.at(-1)?.etiqueta, 'CAJA');
  assert.equal(plan.papeles.at(-1)?.impresora, 'POS-CAJA');
  assert.ok(plan.avisos.some((a) => a.includes('RESUMEN_CAJA=1')));
});

test('avisa cuando varias estaciones salen por la misma impresora', () => {
  const plan = planearComanda(pedido, base('both'));
  assert.ok(
    plan.avisos.some(
      (a) => a.includes('COCINA + PIZZA') && a.includes('POS-COCINA'),
    ),
    JSON.stringify(plan.avisos),
  );
  const una = planearComanda(
    pedido,
    base('both', {
      impresoras: { cocina: 'X', pizza: 'X', barra: 'X', caja: 'X' },
    }),
  );
  assert.ok(una.avisos.some((a) => a.includes('COCINA + PIZZA + BARRA')));
});

test('modo kitchen: la barra no sale y queda anotado por qué', () => {
  const plan = planearComanda(pedido, base('kitchen'));
  assert.deepEqual(
    plan.papeles.map((p) => p.etiqueta),
    ['COCINA', 'PIZZA'],
  );
  assert.ok(plan.omitidos.some((o) => o.includes('barra')));
});

test('modo bar: solo la barra; bar-1 y bar-2 titulan su papel', () => {
  assert.deepEqual(
    planearComanda(pedido, base('bar')).papeles.map((p) => p.etiqueta),
    ['BARRA'],
  );
  assert.equal(
    planearComanda(pedido, base('bar-1')).papeles[0].titulo,
    'BARRA 1',
  );
  assert.equal(
    planearComanda(pedido, base('bar-2')).papeles[0].titulo,
    'BARRA 2',
  );
  const sinBarra = planearComanda(
    pedido,
    base('bar-2', { filtroBarra: () => [] }),
  );
  assert.equal(sinBarra.papeles.length, 0);
  assert.ok(sinBarra.omitidos.some((o) => o.includes('otra barra')));
});

test('los items sin estación van a cocina y un pedido vacío no genera papeles', () => {
  const plan = planearComanda(
    {
      ...pedido,
      items: [
        { quantity: 1, name: 'Algo' },
        { quantity: 1, name: 'Otro', station: null },
      ],
    },
    base('both'),
  );
  assert.deepEqual(
    plan.papeles.map((p) => [p.etiqueta, p.items]),
    [['COCINA', 2]],
  );
  assert.equal(
    planearComanda({ ...pedido, items: [] }, base('both')).papeles.length,
    0,
  );
  assert.equal(
    planearComanda({ ...pedido, items: null as never }, base('both')).papeles
      .length,
    0,
  );
});
