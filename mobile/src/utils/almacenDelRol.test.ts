import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areaDelRol,
  esGerencia,
  puedeMoverInventario,
  tieneAccesoAlInventario,
} from './almacenDelRol.ts';

test('cada estacion apunta a su almacen', () => {
  assert.equal(areaDelRol('bar'), 'BARRA');
  assert.equal(areaDelRol('kitchen'), 'COCINA');
});

test('el pizzero va a COCINA, no a PIZZERIA: ahi estan sus insumos', () => {
  assert.equal(areaDelRol('pizza'), 'COCINA');
});

test('un rol sin area no tiene almacen propio', () => {
  assert.equal(areaDelRol('waiter'), null);
  assert.equal(areaDelRol('cashier'), null);
  assert.equal(areaDelRol(undefined), null);
  assert.equal(areaDelRol(''), null);
});

test('gerencia no esta atada a un area', () => {
  assert.equal(areaDelRol('admin'), null);
  assert.equal(areaDelRol('manager'), null);
  assert.equal(esGerencia('admin'), true);
  assert.equal(esGerencia('manager'), true);
  assert.equal(esGerencia('kitchen'), false);
});

test('el rol se compara sin importar mayusculas', () => {
  assert.equal(areaDelRol('KITCHEN'), 'COCINA');
  assert.equal(esGerencia('ADMIN'), true);
});

test('entran al inventario gerencia y las tres estaciones, nadie mas', () => {
  for (const rol of ['admin', 'manager', 'kitchen', 'bar', 'pizza']) {
    assert.equal(tieneAccesoAlInventario(rol), true, rol);
  }
  for (const rol of ['waiter', 'cashier', 'customer', undefined]) {
    assert.equal(tieneAccesoAlInventario(rol), false, String(rol));
  }
});

test('mover, contar y mermar es solo de gerencia: el servidor devuelve 403', () => {
  assert.equal(puedeMoverInventario('admin'), true);
  assert.equal(puedeMoverInventario('manager'), true);
  for (const rol of ['kitchen', 'bar', 'pizza', 'waiter']) {
    assert.equal(puedeMoverInventario(rol), false, rol);
  }
});
