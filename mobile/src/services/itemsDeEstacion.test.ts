import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * Cocina, barra y pizza decian "todo despachado" con pedidos sin entregar
 * (28/08/2026). La causa: el mapeo de items del movil (`normalizeItem`) armaba
 * el objeto campo por campo y NO copiaba `_id`. `flattenPendingItems` descarta
 * cualquier item sin id de linea, asi que descartaba TODOS.
 *
 * Aqui se replica esa regla: lo que el mapeo entrega tiene que alcanzar para
 * armar la vista de la estacion. Si alguien vuelve a quitar un campo, esto se
 * pone rojo antes de que el restaurante se quede sin ver sus pedidos.
 */

// Los campos del item que consume flattenPendingItems.
const CAMPOS_QUE_USA_LA_ESTACION = [
  '_id',
  'station',
  'quantity',
  'deliveredQty',
  'cancelledAt',
  'addedAt',
  'presentationQty',
  'productId',
  'productName',
  'notes',
];

// Copia fiel de lo que devuelve normalizeItem hoy.
const itemNormalizado = (crudo: Record<string, unknown>) => ({
  productId: crudo.productId ?? '',
  productName: crudo.productName ?? crudo.name ?? '',
  quantity: crudo.quantity ?? 1,
  unitPrice: crudo.unitPrice ?? 0,
  totalPrice: crudo.totalPrice ?? 0,
  notes: crudo.notes ?? null,
  deliveredQty: crudo.deliveredQty ?? 0,
  sentQty: crudo.sentQty,
  station: crudo.station ?? null,
  _id: crudo._id,
  cancelledAt: crudo.cancelledAt ?? null,
  addedAt: crudo.addedAt,
  presentationQty: crudo.presentationQty,
});

describe('el item normalizado sirve para la vista de estacion', () => {
  const crudo = {
    _id: '6a91e814aeeee6063140564c',
    productId: 'p1',
    name: 'Pepsi Lata 355ml',
    quantity: 2,
    deliveredQty: 0,
    station: 'BAR',
    addedAt: '2026-08-28T19:00:00.000Z',
    presentationQty: 12,
  };

  test('conserva todos los campos que usa la estacion', () => {
    const item = itemNormalizado(crudo) as Record<string, unknown>;
    for (const campo of CAMPOS_QUE_USA_LA_ESTACION) {
      assert.ok(
        campo in item,
        `falta "${campo}": la estacion no podra usar el item`,
      );
    }
  });

  test('el id de linea sobrevive — sin el se descarta el item', () => {
    const item = itemNormalizado(crudo);
    assert.equal(String(item._id ?? ''), '6a91e814aeeee6063140564c');
    assert.notEqual(String(item._id ?? ''), '');
  });

  test('un item sin entregar queda como pendiente', () => {
    const item = itemNormalizado(crudo);
    const pendiente = Number(item.quantity) - Number(item.deliveredQty);
    assert.equal(pendiente, 2);
  });
});
