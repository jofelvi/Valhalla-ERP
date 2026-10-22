import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  FILTROS_DE_SERVIDOR,
  coincideConElFiltro,
} from './ordersSubscriptionFilters.ts';

/**
 * Las pantallas de cocina, barra, pizza y despacho decian "todas las ordenes
 * han sido despachadas" con pedidos sin entregar en la calle (28/08/2026).
 *
 * La suscripcion pide `/api/orders?active=true` y despues replicaba ESE mismo
 * parametro contra el documento de la orden para decidir si un evento del
 * socket le pertenecia. Pero `active` no es un campo de la orden: es un filtro
 * que entiende el servidor. La comparacion daba siempre falso y cada evento
 * `order:updated` sacaba la orden del cache. Las pantallas arrancaban bien —el
 * primer fetch si trae todo— y se iban vaciando solas con el movimiento.
 */
describe('filtros de la suscripcion de ordenes', () => {
  test('`active` esta declarado como filtro de servidor', () => {
    assert.ok(FILTROS_DE_SERVIDOR.includes('active'));
  });

  test('ningun campo real de la orden esta en la lista', () => {
    for (const campo of [
      'waiterId',
      'customerId',
      'tableId',
      'status',
      'sector',
    ]) {
      assert.ok(
        !FILTROS_DE_SERVIDOR.includes(campo),
        `${campo} no debe ignorarse`,
      );
    }
  });

  test('comparar `active` contra la orden siempre daba falso', () => {
    const orden: Record<string, unknown> = {
      id: 'o1',
      status: 'PENDING',
      waiterId: 'w1',
    };
    assert.equal(String(orden.active ?? '') === 'true', false);
  });
});

describe('coincideConElFiltro - el parametro puede traer varios valores', () => {
  test('un solo valor: comparacion exacta, como siempre', () => {
    assert.ok(coincideConElFiltro('PENDING', 'PENDING'));
    assert.ok(!coincideConElFiltro('PAID', 'PENDING'));
  });

  test('varios valores: pertenece a la lista', () => {
    // Sin esto, `'PENDING' === 'PENDING,IN_PROGRESS,READY'` da falso SIEMPRE y
    // cada evento del socket sacaria la orden del cache — el mismo bug que
    // dejo a cocina, barra y pizza diciendo "todo despachado" con pedidos en
    // la calle.
    const vivos = 'PENDING,IN_PROGRESS,READY,DELIVERED,CREDIT';
    for (const estado of ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CREDIT']) {
      assert.ok(coincideConElFiltro(estado, vivos), estado + ' deberia entrar');
    }
    assert.ok(!coincideConElFiltro('CANCELLED', vivos));
    assert.ok(!coincideConElFiltro('PAID', vivos));
  });

  test('espacios alrededor de las comas no rompen la pertenencia', () => {
    assert.ok(coincideConElFiltro('READY', 'PENDING , READY'));
  });

  test('campo ausente no coincide con nada', () => {
    assert.ok(!coincideConElFiltro(undefined, 'PENDING,READY'));
    assert.ok(!coincideConElFiltro(null, 'PENDING'));
  });

  test('limit y page son de servidor: no se comparan contra la orden', () => {
    // Son paginacion, no una propiedad del documento.
    assert.ok(FILTROS_DE_SERVIDOR.includes('limit'));
    assert.ok(FILTROS_DE_SERVIDOR.includes('page'));
  });
});
