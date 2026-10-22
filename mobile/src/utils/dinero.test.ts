import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearUsd, formatearNumero, formatearBs } from './dinero.ts';

test('formatearUsd = $X.XX, idéntico a `$${x.toFixed(2)}`', () => {
  assert.equal(formatearUsd(1234.5), '$1234.50');
  assert.equal(formatearUsd(0), '$0.00');
  assert.equal(formatearUsd(5), '$5.00');
  // Paridad exacta con el patrón ad-hoc que reemplaza.
  const x = 42.1;
  assert.equal(formatearUsd(x), `$${x.toFixed(2)}`);
});

test('formatearUsd tolera null/undefined como 0', () => {
  assert.equal(formatearUsd(null), '$0.00');
  assert.equal(formatearUsd(undefined), '$0.00');
});

test('formatearNumero = miles es-VE sin símbolo', () => {
  assert.equal(formatearNumero(1234.5), '1.234,50');
  assert.equal(formatearNumero(0), '0,00');
});

test('formatearBs = Bs + miles', () => {
  assert.equal(formatearBs(1234.5), 'Bs 1.234,50');
  assert.equal(formatearBs(null), 'Bs 0,00');
});
