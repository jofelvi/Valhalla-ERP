import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estadoDeCobro, resumenDeCobro } from './estadoDeCobro.ts';

describe('estadoDeCobro', () => {
  it('sin nada reportado ni aprobado es "sin_pago"', () => {
    assert.equal(estadoDeCobro({ paymentStatus: 'pending' }), 'sin_pago');
    assert.equal(estadoDeCobro({ paymentStatus: null }), 'sin_pago');
    assert.equal(
      estadoDeCobro({ paymentStatus: 'pending', pendingPayments: [] }),
      'sin_pago',
    );
  });

  it('con un pago reportado a la caja es "por_verificar"', () => {
    assert.equal(
      estadoDeCobro({ paymentStatus: 'pending_verification' }),
      'por_verificar',
    );
    // El estado puede quedar atrás; manda el pago reportado.
    assert.equal(
      estadoDeCobro({ paymentStatus: 'pending', pendingPayments: [{}] }),
      'por_verificar',
    );
  });

  it('con abonos que no cubren el total es "parcial"', () => {
    assert.equal(estadoDeCobro({ paymentStatus: 'partial' }), 'parcial');
  });

  it('pagada no lleva etiqueta', () => {
    assert.equal(estadoDeCobro({ paymentStatus: 'paid' }), null);
    assert.equal(estadoDeCobro({ paymentStatus: 'PAID' }), null);
  });

  it('un pago rechazado vuelve a "sin_pago": la API vacía los reportados', () => {
    assert.equal(
      estadoDeCobro({ paymentStatus: 'pending', pendingPayments: [] }),
      'sin_pago',
    );
  });
});

describe('resumenDeCobro', () => {
  it('suma órdenes y dólares por estado, en centavos exactos', () => {
    const r = resumenDeCobro([
      { paymentStatus: 'pending', total: 9.9 },
      { paymentStatus: 'pending', total: 6.6 },
      { paymentStatus: 'pending_verification', total: 29 },
      { paymentStatus: 'partial', total: 10 },
      { paymentStatus: 'paid', total: 100 },
    ]);
    assert.deepEqual(r.sinPago, { n: 2, usd: 16.5 });
    assert.deepEqual(r.porVerificar, { n: 1, usd: 29 });
    assert.deepEqual(r.parcial, { n: 1, usd: 10 });
  });

  it('sin órdenes da ceros', () => {
    assert.deepEqual(resumenDeCobro([]).sinPago, { n: 0, usd: 0 });
  });
});
