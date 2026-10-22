import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  almacenParaEstacion,
  diferenciaEsGrande,
  hayQueContar,
} from './stockDeProducto.ts';

// El 22/08/2026 el dueño puso 168 en el campo "Stock" de la Cerveza Pilsen y el
// mesonero siguió viéndola en "Sin stock": el formulario escribía
// `product.stock`, un campo que NADIE lee, mientras la disponibilidad sale de
// `warehouse_stocks` (que tenía −93). Estas pruebas fijan cómo el formulario
// decide a qué almacén va el número y cuándo debe registrar el conteo.

const ALMACENES = [
  { id: 'w-dep', name: 'Depósito General' },
  { id: 'w-coc', name: 'Cocina' },
  { id: 'w-piz', name: 'Pizzería' },
  { id: 'w-bar', name: 'Barra' },
];

describe('almacenParaEstacion', () => {
  test('cada estación va a su almacén', () => {
    assert.equal(almacenParaEstacion('BAR', ALMACENES)?.id, 'w-bar');
    assert.equal(almacenParaEstacion('KITCHEN', ALMACENES)?.id, 'w-coc');
  });

  // Pizza sale de COCINA, igual que en el servidor. El almacén "Pizzería"
  // existe pero lleva 0 filas desde que se creó: los 24 insumos de las 41
  // pizzas con receta tienen su stock en Cocina, que es de donde el consumo
  // descuenta. Mientras esto apuntó a Pizzería, la tabla de productos buscaba
  // el stock de cada pizza en un almacén vacío y el panel no mostraba nada.
  test('pizza busca su stock en COCINA, no en el almacén vacío', () => {
    assert.equal(almacenParaEstacion('PIZZA', ALMACENES)?.id, 'w-coc');
  });

  test('sin estación cae al Depósito General', () => {
    assert.equal(almacenParaEstacion(null, ALMACENES)?.id, 'w-dep');
    assert.equal(almacenParaEstacion(undefined, ALMACENES)?.id, 'w-dep');
    assert.equal(almacenParaEstacion('', ALMACENES)?.id, 'w-dep');
  });

  // Los almacenes se identifican por NOMBRE (no tienen campo de estación), así
  // que el emparejado no puede depender de tildes ni de mayúsculas.
  test('empareja sin importar tildes ni mayúsculas', () => {
    const raros = [
      { id: 'x1', name: 'COCÍNA' },
      { id: 'x2', name: 'barra' },
      { id: 'x3', name: 'deposito general' },
    ];
    assert.equal(almacenParaEstacion('KITCHEN', raros)?.id, 'x1');
    assert.equal(almacenParaEstacion('BAR', raros)?.id, 'x2');
    assert.equal(almacenParaEstacion(null, raros)?.id, 'x3');
  });

  test('devuelve null si ese almacén no existe (mejor que adivinar)', () => {
    assert.equal(
      almacenParaEstacion('BAR', [{ id: 'x', name: 'Cocina' }]),
      null,
    );
    assert.equal(almacenParaEstacion('BAR', []), null);
  });
});

describe('hayQueContar', () => {
  test('solo cuando el número cambió', () => {
    assert.equal(hayQueContar(576.7, 576.7), false);
    assert.equal(hayQueContar(576.7, 600), true);
  });

  test('cuenta desde negativo (el caso real de la Pilsen)', () => {
    assert.equal(hayQueContar(-93, 168), true);
  });

  test('sin dato real previo, cualquier número es un conteo', () => {
    assert.equal(hayQueContar(null, 100), true);
    assert.equal(hayQueContar(undefined, 0), true);
  });

  test('no cuenta con un valor vacío o no numérico', () => {
    assert.equal(hayQueContar(10, null), false);
    assert.equal(hayQueContar(10, undefined), false);
    assert.equal(hayQueContar(10, Number.NaN), false);
  });

  test('un negativo no se puede contar: no existe stock físico negativo', () => {
    assert.equal(hayQueContar(10, -5), false);
  });
});

describe('diferenciaEsGrande', () => {
  // El servidor rechaza diferencias >50% sin confirmación explícita, para
  // atrapar errores de unidad (contar gramos como kilos). El formulario tiene
  // que avisar ANTES, no tragarse el error.
  test('detecta el salto que el servidor va a frenar', () => {
    assert.equal(diferenciaEsGrande(-93, 168), true);
    assert.equal(diferenciaEsGrande(100, 1000), true);
  });

  test('un ajuste pequeño pasa sin ruido', () => {
    assert.equal(diferenciaEsGrande(100, 110), false);
    assert.equal(diferenciaEsGrande(576.7, 580), false);
  });

  test('desde cero o sin dato, cualquier carga es grande y hay que confirmarla', () => {
    assert.equal(diferenciaEsGrande(0, 50), true);
    assert.equal(diferenciaEsGrande(null, 50), true);
  });
});
