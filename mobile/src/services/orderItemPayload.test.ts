import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toApiOrderItem } from './orderItemPayload.ts';
import type { OrderItem } from '../types/models.ts';

const beer: OrderItem = {
  _id: '6aa43ae2db701aab0d115737',
  productId: '1AaLkkeIBE1kT21bxmyt',
  productName: 'Solera Verde Botella',
  quantity: 2,
  unitPrice: 1.5,
  totalPrice: 3,
  notes: null,
  deliveredQty: 1,
  sentQty: 2,
  station: 'BAR',
  cancelledAt: null,
  addedAt: '2026-09-04T23:58:14.205Z',
};

test('manda total y name, que el DTO exige (sin ellos: 400)', () => {
  const payload = toApiOrderItem(beer);
  assert.equal(payload.total, 3);
  assert.equal(payload.name, 'Solera Verde Botella');
  assert.equal(payload.totalPrice, 3);
  assert.equal(payload.productName, 'Solera Verde Botella');
});

test('conserva sentQty, entrega, estacion y fecha de alta', () => {
  const payload = toApiOrderItem(beer);
  assert.equal(payload.sentQty, 2);
  assert.equal(payload.deliveredQty, 1);
  assert.equal(payload.station, 'BAR');
  assert.equal(payload.addedAt, '2026-09-04T23:58:14.205Z');
});

test('no manda cancelledAt vacio: el servidor hereda la anulacion previa', () => {
  assert.equal('cancelledAt' in toApiOrderItem(beer), false);
  const cancelled = toApiOrderItem({
    ...beer,
    cancelledAt: '2026-09-05T01:00:00.000Z',
  });
  assert.equal(cancelled.cancelledAt, '2026-09-05T01:00:00.000Z');
});

test('sin sentQty no inventa uno (el servidor lo hereda)', () => {
  const { sentQty: _omit, ...fresh } = beer;
  assert.equal('sentQty' in toApiOrderItem(fresh), false);
});

test('los packs conservan presentationQty', () => {
  assert.equal(
    toApiOrderItem({ ...beer, presentationQty: 12 }).presentationQty,
    12,
  );
  assert.equal('presentationQty' in toApiOrderItem(beer), false);
});
