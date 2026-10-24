import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estadoVisibleDePedido } from './estadoVisibleDePedido';

const ver = (status: string, paymentStatus?: string, extra = {}) =>
  estadoVisibleDePedido({ status, paymentStatus, ...extra }, true);

describe('estadoVisibleDePedido', () => {
  it('un pedido cobrado ya no dice "Pendiente"', () => {
    assert.deepEqual(ver('PENDING', 'paid'), {
      etiqueta: 'Pagado',
      tono: 'pagado',
    });
  });

  it('cobrado por el mesonero y a la espera de caja dice "Por verificar"', () => {
    assert.deepEqual(ver('PENDING', 'pending_verification'), {
      etiqueta: 'Por verificar',
      tono: 'verificar',
    });
  });

  it('suma la etapa de cocina cuando ya se esta preparando', () => {
    assert.equal(
      ver('IN_PROGRESS', 'paid').etiqueta,
      'Pagado · En preparación',
    );
    assert.equal(
      ver('READY', 'pending_verification').etiqueta,
      'Por verificar · Listo',
    );
  });

  it('un pedido sin cobrar dice "Por cobrar" con la comanda al cobrar', () => {
    assert.deepEqual(ver('PENDING', 'pending'), {
      etiqueta: 'Por cobrar',
      tono: 'porCobrar',
    });
    assert.equal(ver('PENDING', undefined).etiqueta, 'Por cobrar');
  });

  it('sin la comanda al cobrar conserva "Pendiente"', () => {
    assert.equal(
      estadoVisibleDePedido(
        { status: 'PENDING', paymentStatus: 'pending' },
        false,
      ).etiqueta,
      'Pendiente',
    );
  });

  it('pago rechazado, cancelado, credito, entregado y pagado de la orden mandan', () => {
    assert.equal(
      ver('PENDING', 'pending', { paymentRejected: true }).etiqueta,
      'Pago rechazado',
    );
    assert.equal(ver('CANCELLED', 'paid').etiqueta, 'Cancelado');
    assert.equal(ver('CREDIT', 'pending').etiqueta, 'Crédito');
    assert.equal(ver('DELIVERED', 'paid').etiqueta, 'Entregado');
    assert.equal(ver('PAID', 'paid').etiqueta, 'Pagado');
  });

  it('un pago parcial se ve como parcial', () => {
    assert.deepEqual(ver('PENDING', 'partial'), {
      etiqueta: 'Pago parcial',
      tono: 'parcial',
    });
  });
});
