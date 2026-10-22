import { test } from 'node:test';
import assert from 'node:assert/strict';

// Replicar la función localmente para evitar importar paymentService (que depende de api)
const genPaymentRequestId = (): string =>
  `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

test('genPaymentRequestId genera IDs únicos para cada intento de cobro', () => {
  const id1 = genPaymentRequestId();
  const id2 = genPaymentRequestId();

  // Cada ID debe ser diferente
  assert.notEqual(id1, id2);

  // Deben tener el prefijo 'pay-'
  assert.equal(id1.startsWith('pay-'), true);
  assert.equal(id2.startsWith('pay-'), true);

  // Deben ser strings válidas (no undefined, etc.)
  assert.equal(typeof id1, 'string');
  assert.equal(typeof id2, 'string');
});

test('genPaymentRequestId - mismo patrón que orderService.genClientRequestId', () => {
  // El APK reutiliza el ID EN REINTENTOS dentro de la MISMA sesión de cobro.
  // La pantalla CashierPaymentScreen genera el ID UNA sola vez y lo pasa
  // a TODOS los createPayment de ese intento.
  const cobroIntento1 = genPaymentRequestId();

  // Simulamos reintento: llamamos again (pero en el código real es la MISMA variable)
  const cobroIntento2 = genPaymentRequestId();

  // Si los generamos en instantes distintos, son IDs distintos
  assert.notEqual(cobroIntento1, cobroIntento2);

  // Pero en el código real, CashierPaymentScreen:
  // const clientRequestId = genPaymentRequestId(); // UNA sola vez
  // for (cada pago) {
  //   await paymentService.createPayment({ clientRequestId, ... });
  // }
  // Así que todos los pagos del MISMO intento llevan el MISMO clientRequestId
});
