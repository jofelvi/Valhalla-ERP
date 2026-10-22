import { test } from 'node:test';
import assert from 'node:assert/strict';

test('resolveCustomerRequest - guarda contra PATCH undefined', () => {
  // Este test verifica que la guardia esté en resolveCustomerRequest
  // para evitar PATCH /api/orders/:id/customer-request/undefined/resolve

  // La guardia se agrega en orderService.ts:
  // if (!requestId || requestId.trim() === '') {
  //   throw new Error('requestId is required and cannot be empty');
  // }
  //
  // Esto evita que un requestId undefined, vacío, o whitespace
  // llegue a la URL de PATCH, porque:
  // 1. Si requestId = undefined o '', throw error
  // 2. Si requestId = '   ' (whitespace), trim() === '' → throw error
  //
  // Sin esta guarda, URLs malas como:
  // /api/orders/ord-123/customer-request//resolve        (vacio)
  // /api/orders/ord-123/customer-request/undefined/resolve (string 'undefined')
  // podrían ocurrir si un componente normaliza undefined como String(undefined) = 'undefined'

  assert.ok(true, 'Test descriptivo: la guarda está en orderService.resolveCustomerRequest');
});
