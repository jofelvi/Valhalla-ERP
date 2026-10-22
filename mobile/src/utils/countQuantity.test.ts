import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTypingCountQuantity, parseCountQuantity } from './countQuantity.ts';

test('deja escribir decimales tecla a tecla, con punto o coma', () => {
  for (const paso of ['', '0', '0.', '0.5', '1', '1,', '1,5', '12.25']) {
    assert.equal(isTypingCountQuantity(paso), true, paso);
  }
});

test('rechaza lo que no es una cantidad', () => {
  for (const malo of ['-1', 'a', '1.2.3', '1,2,3', '1 2', '1e3']) {
    assert.equal(isTypingCountQuantity(malo), false, malo);
  }
});

test('vacío o incompleto es "sin contar", no cero', () => {
  assert.equal(parseCountQuantity(''), undefined);
  assert.equal(parseCountQuantity('  '), undefined);
  assert.equal(parseCountQuantity('.'), undefined);
  assert.equal(parseCountQuantity(','), undefined);
});

test('el cero escrito cuenta como cero', () => {
  assert.equal(parseCountQuantity('0'), 0);
  assert.equal(parseCountQuantity('0,0'), 0);
});

test('convierte coma y punto al mismo número', () => {
  assert.equal(parseCountQuantity('0.5'), 0.5);
  assert.equal(parseCountQuantity('1,5'), 1.5);
  assert.equal(parseCountQuantity('5.'), 5);
  assert.equal(parseCountQuantity('9500'), 9500);
});
