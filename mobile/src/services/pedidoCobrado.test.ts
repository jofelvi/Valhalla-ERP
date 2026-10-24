import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pedidoCobrado } from './pedidoCobrado';

describe('pedidoCobrado (regla de la comanda al cobrar)', () => {
  it('un pedido recien creado (pending) todavia no se cobro', () => {
    assert.equal(pedidoCobrado('pending'), false);
    assert.equal(pedidoCobrado('PENDING'), false);
  });

  it('sin estado o cancelado no cuenta como cobrado', () => {
    assert.equal(pedidoCobrado(undefined), false);
    assert.equal(pedidoCobrado(null), false);
    assert.equal(pedidoCobrado(''), false);
    assert.equal(pedidoCobrado('cancelled'), false);
  });

  it('el mesonero lo marco pagado (en verificacion) o caja lo cobro: ya se cobro', () => {
    assert.equal(pedidoCobrado('pending_verification'), true);
    assert.equal(pedidoCobrado('paid'), true);
    assert.equal(pedidoCobrado('partial'), true);
  });
});
