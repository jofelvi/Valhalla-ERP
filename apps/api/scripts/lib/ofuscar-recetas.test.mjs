import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearOfuscador, dosCifras } from './ofuscar-recetas.mjs';

const SEMILLA = 'semilla-de-prueba-1234567890';
const masa = () => ({
  _id: 'masa',
  type: 'COMPUESTO',
  isForSale: false,
  cost: 3.2,
  presentation: 'Gramo',
  presentationQuantity: 4112,
  description: '1 lote = 5112g. Harina, levadura, sal.',
  ingredients: [
    { productId: 'harina', quantity: 3000, unit: 'Gramo', wastePercentage: 0 },
    { productId: 'levadura', quantity: 12, unit: 'Gramo', wastePercentage: 0 },
    { productId: 'sal', quantity: 30, unit: 'Gramo', wastePercentage: 0 },
    {
      productId: 'agua',
      quantity: 1000,
      unit: 'Mililitro',
      wastePercentage: 0,
    },
    { productId: 'huevo', quantity: 4, unit: 'Unidad', wastePercentage: 0 },
    { productId: 'bandeja', quantity: 1, unit: 'Unidad', wastePercentage: 0 },
  ],
});
const porId = (p) =>
  Object.fromEntries(p.ingredients.map((i) => [i.productId, i.quantity]));

describe('ofuscar recetas', () => {
  test('nunca baja una cantidad y siempre sube las que se pueden esconder', () => {
    const o = crearOfuscador(SEMILLA).producto(masa());
    const antes = porId(masa());
    const despues = porId(o);
    for (const k of Object.keys(antes)) assert.ok(despues[k] >= antes[k], k);
    for (const k of ['harina', 'levadura', 'sal', 'agua', 'huevo'])
      assert.ok(despues[k] > antes[k], k);
    assert.equal(despues.bandeja, 1, 'una sola unidad no se toca');
    assert.ok(despues.harina <= 3000 * 1.35 * 1.05);
  });

  test('una fracción de unidad se ofusca (es una receta), un conteo de 1 no', () => {
    const p = {
      _id: 'f',
      type: 'COMPUESTO',
      ingredients: [
        { productId: 'a', quantity: 0.0278, unit: 'Unidad' },
        { productId: 'b', quantity: 1, unit: 'Unidad' },
      ],
    };
    const o = porId(crearOfuscador(SEMILLA).producto(p));
    assert.ok(o.a > 0.0278);
    assert.equal(o.b, 1);
  });

  test('los factores son distintos por ingrediente: cambian las proporciones', () => {
    const o = porId(crearOfuscador(SEMILLA).producto(masa()));
    const a = porId(masa());
    const f = ['harina', 'levadura', 'sal', 'agua'].map((k) => o[k] / a[k]);
    assert.ok(new Set(f.map((x) => x.toFixed(2))).size > 2, `factores: ${f}`);
  });

  test('es determinista con la misma semilla y distinto con otra', () => {
    const a = crearOfuscador(SEMILLA).producto(masa());
    const b = crearOfuscador(SEMILLA).producto(masa());
    const c = crearOfuscador('otra-semilla-distinta-98765').producto(masa());
    assert.deepEqual(a, b);
    assert.notDeepEqual(porId(a), porId(c));
  });

  test('no muta el original y mantiene coherente el rendimiento del lote', () => {
    const original = masa();
    const o = crearOfuscador(SEMILLA).producto(original);
    assert.deepEqual(original, masa());
    const antes = 3000 + 12 + 30 + 1000;
    const despues = ['harina', 'levadura', 'sal', 'agua'].reduce(
      (s, k) => s + porId(o)[k],
      0,
    );
    assert.ok(o.presentationQuantity > 4112);
    assert.ok(
      Math.abs(o.presentationQuantity / 4112 - despues / antes) < 0.001,
    );
  });

  test('el costo solo sube y la descripción de un preparado pierde la receta', () => {
    const o = crearOfuscador(SEMILLA).producto(masa());
    assert.ok(o.cost > 3.2 && o.cost <= 3.2 * 1.15 + 1e-6);
    assert.equal(o.description, 'Preparado de la casa.');
    const base = crearOfuscador(SEMILLA).producto({
      _id: 'x',
      type: 'BASE',
      cost: 2,
      description: 'Bolsa de 100 gr',
    });
    assert.ok(base.cost > 2);
    assert.equal(
      base.description,
      'Bolsa de 100 gr',
      'solo se tocan las fórmulas',
    );
  });

  test('un plato a la venta conserva su texto comercial y pierde solo las cantidades', () => {
    const p = {
      _id: 'p',
      type: 'COMPUESTO',
      isForSale: true,
      ingredients: [],
      description:
        'Crujientes y dorados. Rellenos con 120 g de queso. Con papas.',
    };
    assert.equal(
      crearOfuscador(SEMILLA).producto(p).description,
      'Crujientes y dorados. Con papas.',
    );
  });

  test('exige semilla larga y factores mayores que 1', () => {
    assert.throws(() => crearOfuscador('corta'));
    assert.throws(() => crearOfuscador(SEMILLA, { minFactor: 0.9 }));
  });

  test('dosCifras', () => {
    assert.equal(dosCifras(3640), 3600);
    assert.equal(dosCifras(14.04), 14);
    assert.equal(dosCifras(0.5234), 0.52);
  });
});
