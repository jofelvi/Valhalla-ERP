import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisoNoAgregarProductos,
  motivoNoAgregarProductos,
} from './pedidoAgregarProductos';

describe('motivoNoAgregarProductos (prepago: no agregar a pedido cobrado o rechazado)', () => {
  it('sin COMANDA_AL_PAGAR nunca bloquea por pago', () => {
    assert.equal(
      motivoNoAgregarProductos({ paymentStatus: 'paid' }, false),
      null,
    );
    assert.equal(
      motivoNoAgregarProductos({ paymentRejected: true }, false),
      null,
    );
  });

  it('pedido pendiente de pago admite productos', () => {
    assert.equal(
      motivoNoAgregarProductos({ paymentStatus: 'pending' }, true),
      null,
    );
    assert.equal(motivoNoAgregarProductos({ paymentStatus: null }, true), null);
  });

  it('pedido ya cobrado no admite productos', () => {
    assert.equal(
      motivoNoAgregarProductos({ paymentStatus: 'paid' }, true),
      'cobrado',
    );
    assert.equal(
      motivoNoAgregarProductos({ paymentStatus: 'partial' }, true),
      'cobrado',
    );
    assert.equal(
      motivoNoAgregarProductos({ paymentStatus: 'pending_verification' }, true),
      'cobrado',
    );
  });

  it('pago rechazado no admite productos, y gana sobre cobrado', () => {
    assert.equal(
      motivoNoAgregarProductos(
        { paymentStatus: 'pending', paymentRejected: true },
        true,
      ),
      'rechazado',
    );
    assert.equal(
      motivoNoAgregarProductos(
        { paymentStatus: 'paid', paymentRejected: true },
        true,
      ),
      'rechazado',
    );
  });

  it('cancelado no cuenta como cobrado', () => {
    assert.equal(
      motivoNoAgregarProductos({ paymentStatus: 'cancelled' }, true),
      null,
    );
  });
});

describe('avisoNoAgregarProductos', () => {
  it('da el texto que explica qué hacer en cada caso', () => {
    assert.match(
      avisoNoAgregarProductos('cobrado') ?? '',
      /crea un pedido nuevo/,
    );
    assert.match(
      avisoNoAgregarProductos('rechazado') ?? '',
      /cóbralo de nuevo/,
    );
    assert.equal(avisoNoAgregarProductos(null), null);
  });
});
