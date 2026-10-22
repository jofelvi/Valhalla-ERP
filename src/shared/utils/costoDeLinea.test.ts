import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  baseDeUnidad,
  convertirABase,
  costoDeLinea,
  costoPorUnidadBase,
  factorFaltante,
  medidasDisponibles,
} from './costoDeLinea.ts';

/**
 * Paridad con el servidor (apps/api/src/modules/inventory/units.ts): la
 * pantalla y el cálculo real no pueden dar números distintos para una misma
 * línea de receta.
 *
 *     npm run test:unit
 */

const cerca = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} no está cerca de ${b}`);

const harina = {
  name: 'Harina',
  cost: 45,
  presentation: 'Kilogramo',
  presentationQuantity: 45,
};
const leche = {
  name: 'Leche en polvo',
  cost: 15.59,
  presentation: 'Gramo',
  presentationQuantity: 900,
  gramsPerMl: 0.12,
};
const aceite = {
  name: 'Aceite',
  cost: 4.3,
  presentation: 'Litro',
  presentationQuantity: 1,
  gramsPerMl: 0.92,
};
const huevo = {
  name: 'Huevo',
  cost: 6.86,
  presentation: 'Unidad',
  presentationQuantity: 30,
  gramsPerUnit: 55,
};

describe('unidades base', () => {
  test('mg es peso y vale una milésima de gramo', () => {
    assert.equal(baseDeUnidad('mg'), 'GR');
    assert.equal(baseDeUnidad('Miligramo'), 'GR');
    cerca(convertirABase(500, 'mg', 'GR') as number, 0.5);
  });
  test('Galón (con tilde, como lo guarda el enum) es volumen', () => {
    assert.equal(baseDeUnidad('Galón'), 'ML');
  });
  test('Docena de huevos cuenta 12 unidades', () => {
    assert.equal(convertirABase(2, 'Docena', 'UND'), 24);
  });
});

describe('convertirABase — cruce de familias', () => {
  test('sin equivalencia no inventa: devuelve null', () => {
    assert.equal(convertirABase(100, 'Mililitro', 'GR'), null);
    assert.equal(convertirABase(100, 'Gramo', 'UND', {}), null);
  });
  test('una equivalencia en 0, negativa o NaN no cuenta', () => {
    for (const malo of [0, -1, Number.NaN]) {
      assert.equal(
        convertirABase(100, 'Mililitro', 'GR', { gramsPerMl: malo }),
        null,
      );
    }
  });
  test('ml → g y g → ml', () => {
    cerca(convertirABase(100, 'Mililitro', 'GR', leche) as number, 12);
    cerca(convertirABase(92, 'Gramo', 'ML', aceite) as number, 100);
  });
  test('g → unidades del huevo', () => {
    cerca(convertirABase(110, 'Gramo', 'UND', huevo) as number, 2);
  });
  test('unidad ↔ ml con mlPerUnit (lata de 355 ml)', () => {
    cerca(
      convertirABase(710, 'Mililitro', 'UND', { mlPerUnit: 355 }) as number,
      2,
    );
    cerca(convertirABase(1, 'Unidad', 'ML', { mlPerUnit: 355 }) as number, 355);
  });
  test('unidad ↔ ml también pasa por gramos con los dos factores', () => {
    cerca(
      convertirABase(1, 'Unidad', 'ML', {
        gramsPerUnit: 50,
        gramsPerMl: 1,
      }) as number,
      50,
    );
    assert.equal(
      factorFaltante('UND', 'ML', { gramsPerUnit: 50 }),
      'mlPerUnit',
    );
  });
});

describe('costoDeLinea — mismos números que el servidor', () => {
  test('harina 500 g a $45 el saco de 45 kg', () => {
    cerca(costoPorUnidadBase(harina), 0.001);
    const l = costoDeLinea(harina, 500, 'Gramo');
    assert.equal(l.estado, 'ok');
    cerca(l.costo, 0.5);
  });
  test('500 000 mg de harina = 500 g', () => {
    cerca(costoDeLinea(harina, 500000, 'Miligramo').costo, 0.5);
  });
  test('leche pedida en ml se convierte y SÍ cuesta (antes: $0 en silencio)', () => {
    const l = costoDeLinea(leche, 100, 'Mililitro');
    assert.equal(l.estado, 'ok');
    cerca(l.costo, 12 * (15.59 / 900), 1e-4);
  });
  test('la merma se aplica sobre la cantidad ya convertida', () => {
    const l = costoDeLinea(huevo, 110, 'Gramo', 10);
    cerca(l.costo, 2 * 1.1 * (6.86 / 30), 1e-6);
  });
  test('línea incompatible: costo 0 + estado + qué dato cargar', () => {
    const sinDensidad = { ...aceite, gramsPerMl: null };
    const l = costoDeLinea(sinDensidad, 100, 'Gramo');
    assert.equal(l.estado, 'incompatible');
    assert.equal(l.costo, 0);
    assert.equal(l.falta, 'gramsPerMl');
    assert.match(l.mensaje ?? '', /gramos hay por ml/);
  });
  test('insumo sin precio: estado sin-costo', () => {
    const l = costoDeLinea(
      { name: 'Sal', presentation: 'Kilogramo' },
      5,
      'Gramo',
    );
    assert.equal(l.estado, 'sin-costo');
  });
});

describe('medidasDisponibles — qué se puede elegir en la receta', () => {
  test('sin equivalencias, solo la familia del insumo', () => {
    assert.deepEqual(medidasDisponibles('Kilogramo'), [
      'Gramo',
      'Kilogramo',
      'Miligramo',
    ]);
    assert.deepEqual(medidasDisponibles('Litro'), ['Mililitro', 'Litro']);
    assert.deepEqual(medidasDisponibles('Unidad'), ['Unidad', 'Docena']);
  });
  test('con gramsPerMl un insumo por peso también admite ml y litros', () => {
    const m = medidasDisponibles('Gramo', { gramsPerMl: 0.12 });
    assert.ok(m.includes('Mililitro') && m.includes('Litro'));
    assert.ok(!m.includes('Unidad'));
  });
  test('con gramsPerUnit un insumo por unidad admite gramos', () => {
    const m = medidasDisponibles('Unidad', { gramsPerUnit: 55 });
    assert.ok(m.includes('Gramo') && m.includes('Kilogramo'));
  });
});
