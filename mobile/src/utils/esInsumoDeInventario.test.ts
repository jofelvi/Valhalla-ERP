import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esInsumoDeInventario } from '../utils/esInsumoDeInventario.ts';

test('lo marcado como insumo cuenta', () => {
  assert.equal(
    esInsumoDeInventario({ isForInventory: true, type: 'BASE' }),
    true,
  );
  // Aunque el tipo diga otra cosa: el campo explicito manda.
  assert.equal(
    esInsumoDeInventario({ isForInventory: true, type: 'COMPUESTO' }),
    true,
  );
});

test('el false EXPLICITO manda, y esto es lo que estaba roto', () => {
  // Los 13 servicios de evento: BASE, pero alguien dijo que no son insumo.
  // Con el criterio viejo (`isForInventory === true || type === 'BASE'`) el
  // `||` los colaba en las listas de las tres estaciones.
  assert.equal(
    esInsumoDeInventario({ isForInventory: false, type: 'BASE' }),
    false,
  );
});

test('sin el campo se cae al tipo, como estaba', () => {
  assert.equal(esInsumoDeInventario({ type: 'BASE' }), true);
  assert.equal(esInsumoDeInventario({ type: 'COMPUESTO' }), false);
  assert.equal(esInsumoDeInventario({}), false);
});

test('un producto inactivo nunca es insumo, diga lo que diga el resto', () => {
  assert.equal(
    esInsumoDeInventario({
      isForInventory: true,
      type: 'BASE',
      isActive: false,
    }),
    false,
  );
});

test('isActive ausente no descalifica', () => {
  assert.equal(esInsumoDeInventario({ isForInventory: true }), true);
});
