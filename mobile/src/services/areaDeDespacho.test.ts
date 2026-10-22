import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarPorArea, ESTACIONES_DE_DESPACHO } from './areaDeDespacho.ts';

const PIZZAS = 'cat-pizzas';
const categoriaDe = (id: string) =>
  id === 'p-pizza-vieja' ? PIZZAS : 'cat-otra';

const items = [
  { productId: 'p-cerveza', station: 'BAR' },
  { productId: 'p-perro', station: 'KITCHEN' },
  { productId: 'p-pizza-nueva', station: 'PIZZA' },
  { productId: 'p-pizza-vieja', station: 'KITCHEN' }, // orden vieja: pizza marcada como cocina
];

test('la pizza con station PIZZA aparece en su pestana', () => {
  const r = filtrarPorArea(items, 'PIZZA', categoriaDe, PIZZAS);
  assert.deepEqual(
    r.map((i) => i.productId),
    ['p-pizza-nueva', 'p-pizza-vieja'],
  );
});

test('la pizza NO se cuela en cocina', () => {
  const r = filtrarPorArea(items, 'KITCHEN', categoriaDe, PIZZAS);
  assert.deepEqual(
    r.map((i) => i.productId),
    ['p-perro'],
  );
});

test('barra solo ve lo suyo', () => {
  const r = filtrarPorArea(items, 'BAR', categoriaDe, PIZZAS);
  assert.deepEqual(
    r.map((i) => i.productId),
    ['p-cerveza'],
  );
});

test('ningun item se pierde entre las tres pestanas', () => {
  const total = (['KITCHEN', 'BAR', 'PIZZA'] as const).flatMap((a) =>
    filtrarPorArea(items, a, categoriaDe, PIZZAS),
  );
  assert.equal(
    total.length,
    items.length,
    'hay items que no caen en ninguna pestana',
  );
});

test('sin catalogo la pizza nueva se sigue viendo', () => {
  // El catalogo carga en segundo plano; lo que trae station PIZZA no lo necesita.
  const r = filtrarPorArea(items, 'PIZZA', undefined, PIZZAS);
  assert.deepEqual(
    r.map((i) => i.productId),
    ['p-pizza-nueva'],
  );
});

test('sin catalogo cocina no esconde nada', () => {
  const r = filtrarPorArea(items, 'KITCHEN', undefined, PIZZAS);
  assert.deepEqual(
    r.map((i) => i.productId),
    ['p-perro', 'p-pizza-vieja'],
  );
});

test('la estacion se compara sin importar mayusculas ni espacios', () => {
  const raros = [
    { productId: 'x', station: 'pizza' },
    { productId: 'y', station: null },
  ];
  assert.equal(filtrarPorArea(raros, 'PIZZA', categoriaDe, PIZZAS).length, 1);
  assert.equal(filtrarPorArea(raros, 'KITCHEN', categoriaDe, PIZZAS).length, 0);
});

test('se cargan las TRES estaciones: omitir una las hace invisibles', () => {
  assert.deepEqual([...ESTACIONES_DE_DESPACHO].sort(), [
    'BAR',
    'KITCHEN',
    'PIZZA',
  ]);
});
