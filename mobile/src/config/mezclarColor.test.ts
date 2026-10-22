import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mezclarHex, oscurecer, tinte } from './mezclarColor.ts';

test('mezclarHex: extremos devuelven cada color', () => {
  assert.equal(mezclarHex('#000000', '#FFFFFF', 0), '#000000');
  assert.equal(mezclarHex('#000000', '#FFFFFF', 1), '#FFFFFF');
});

test('mezclarHex: punto medio', () => {
  assert.equal(mezclarHex('#000000', '#FFFFFF', 0.5), '#808080');
});

test('mezclarHex: un valor que no es hex no se transforma', () => {
  assert.equal(
    mezclarHex('rgba(0,0,0,0.5)', '#FFFFFF', 0.5),
    'rgba(0,0,0,0.5)',
  );
});

test('tinte: intensidad 0 es el fondo, 1 es el color', () => {
  assert.equal(tinte('#FF0000', '#FFFFFF', 1), '#FF0000');
  assert.equal(tinte('#FF0000', '#FFFFFF', 0), '#FFFFFF');
});

test('oscurecer: mezcla con negro', () => {
  assert.equal(oscurecer('#FFFFFF', 0.5), '#808080');
  assert.equal(oscurecer('#FFFFFF', 0), '#FFFFFF');
});
