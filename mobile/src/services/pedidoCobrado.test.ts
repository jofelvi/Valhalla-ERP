import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pedidoCobrado,
  comandaYaSalio,
  visibleParaEstaciones,
  visibleParaCaja,
} from './pedidoCobrado';

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

describe('comandaYaSalio (no reimprimir tras un rechazo)', () => {
  it('un pedido sin cobrar y sin rechazo todavia no tiene comanda', () => {
    assert.equal(
      comandaYaSalio({ paymentStatus: 'pending', paymentRejected: false }),
      false,
    );
    assert.equal(comandaYaSalio({ paymentStatus: 'pending' }), false);
  });

  it('un pedido cobrado ya tiene comanda', () => {
    assert.equal(comandaYaSalio({ paymentStatus: 'paid' }), true);
    assert.equal(
      comandaYaSalio({ paymentStatus: 'pending_verification' }),
      true,
    );
  });

  it('un pago rechazado (vuelve a pending) conserva la comanda que ya salio', () => {
    assert.equal(
      comandaYaSalio({ paymentStatus: 'pending', paymentRejected: true }),
      true,
    );
  });
});

describe('visibleParaEstaciones (cocina y barra)', () => {
  it('con COMANDA_AL_PAGAR solo ve pedidos cobrados', () => {
    assert.equal(
      visibleParaEstaciones({ paymentStatus: 'pending' }, true),
      false,
    );
    assert.equal(visibleParaEstaciones({ paymentStatus: 'paid' }, true), true);
    assert.equal(
      visibleParaEstaciones({ paymentStatus: 'partial' }, true),
      true,
    );
  });

  it('un pago rechazado sigue visible: su comanda ya estaba en la estacion', () => {
    assert.equal(
      visibleParaEstaciones(
        { paymentStatus: 'pending', paymentRejected: true },
        true,
      ),
      true,
    );
  });

  it('sin COMANDA_AL_PAGAR todo es visible, como antes', () => {
    assert.equal(
      visibleParaEstaciones({ paymentStatus: 'pending' }, false),
      true,
    );
  });
});

describe('visibleParaCaja (listas de caja con COMANDA_AL_PAGAR)', () => {
  it('oculta lo que el mesonero aun no cobro', () => {
    assert.equal(visibleParaCaja({ paymentStatus: 'pending' }, true), false);
    assert.equal(visibleParaCaja({ paymentStatus: null }, true), false);
  });

  it('muestra lo cobrado a verificar y los pagos parciales', () => {
    assert.equal(
      visibleParaCaja({ paymentStatus: 'pending_verification' }, true),
      true,
    );
    assert.equal(visibleParaCaja({ paymentStatus: 'partial' }, true), true);
    assert.equal(visibleParaCaja({ paymentStatus: 'paid' }, true), true);
  });

  it('oculta los rechazados: vuelven al mesonero para recobrar', () => {
    assert.equal(
      visibleParaCaja(
        { paymentStatus: 'pending', paymentRejected: true },
        true,
      ),
      false,
    );
  });

  it('muestra las cuentas a credito aunque su pago siga pendiente', () => {
    assert.equal(
      visibleParaCaja({ paymentStatus: 'pending', status: 'CREDIT' }, true),
      true,
    );
  });

  it('sin COMANDA_AL_PAGAR caja ve todo, incluido lo pendiente y lo rechazado', () => {
    assert.equal(visibleParaCaja({ paymentStatus: 'pending' }, false), true);
    assert.equal(
      visibleParaCaja(
        { paymentStatus: 'pending', paymentRejected: true },
        false,
      ),
      true,
    );
  });
});
