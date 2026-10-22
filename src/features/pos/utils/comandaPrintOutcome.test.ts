import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comandaPrintOutcome,
  COMANDA_EN_COLA_SIN_SERVICIO,
} from './comandaPrintOutcome.ts';

describe('comandaPrintOutcome', () => {
  test('impresa en la PC de caja: exito y sin correo', () => {
    assert.deepEqual(
      comandaPrintOutcome({ success: true, via: 'local' }, null),
      {
        status: 'success',
        errorMessage: null,
        alert: false,
      },
    );
  });

  // El caso de la orden #39250588 (27/09): el mesonero no tiene la impresora
  // en su equipo, la comanda se encola y el print-service de la caja esta
  // conectado. Antes esto era un correo de "servicio caido" y ninguna comanda.
  test('encolada con el servicio conectado: sin correo', () => {
    assert.deepEqual(
      comandaPrintOutcome({ success: true, via: 'queue' }, true),
      {
        status: 'queued',
        errorMessage: null,
        alert: false,
      },
    );
  });

  test('encolada sin servicio conectado: se avisa, pero queda encolada', () => {
    const r = comandaPrintOutcome({ success: true, via: 'queue' }, false);
    assert.equal(r.status, 'queued');
    assert.equal(r.alert, true);
    assert.equal(r.errorMessage, COMANDA_EN_COLA_SIN_SERVICIO);
  });

  test('encolada sin poder saber si hay servicio: no se avisa', () => {
    assert.equal(
      comandaPrintOutcome({ success: true, via: 'queue' }, null).alert,
      false,
    );
  });

  test('la impresora respondio con error: se avisa con su mensaje', () => {
    const r = comandaPrintOutcome(
      { success: false, error: 'POS-BARRA caida (cola atascada)' },
      true,
    );
    assert.equal(r.status, 'http_500');
    assert.equal(r.alert, true);
    assert.equal(r.errorMessage, 'POS-BARRA caida (cola atascada)');
  });
});
