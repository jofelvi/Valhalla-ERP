import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { esTasaConfiable, RANGO_TASA_PLAUSIBLE } from './bcvRateGuard.ts';

// El 19/08/2026 la caja mostró "BCV: 50.00" con la tasa real en 775,34: una
// cuenta de $195,80 apareció como Bs 9.790 en vez de Bs 151.806. El origen no
// fue el número 50, sino que un FALLO de red se respondió como dato válido
// (`success: true`) y se cacheó 30 min en el servidor y 24 h en el navegador.
// Estas pruebas fijan la regla: una tasa inventada no es una tasa.
describe('esTasaConfiable', () => {
  it('acepta una tasa real de una fuente real', () => {
    assert.equal(esTasaConfiable(775.3356, 'bcv-api (dolarapi)'), true);
  });

  it('RECHAZA el fallback aunque venga con éxito', () => {
    assert.equal(esTasaConfiable(50, 'default (fallback)'), false);
    assert.equal(esTasaConfiable(50, 'default'), false);
  });

  it('rechaza cualquier fuente de error', () => {
    assert.equal(esTasaConfiable(775.3356, 'error'), false);
    assert.equal(esTasaConfiable(775.3356, 'critical error'), false);
  });

  it('rechaza valores imposibles', () => {
    assert.equal(esTasaConfiable(0, 'bcv-api (dolarapi)'), false);
    assert.equal(esTasaConfiable(-10, 'bcv-api (dolarapi)'), false);
    assert.equal(esTasaConfiable(Number.NaN, 'bcv-api (dolarapi)'), false);
    assert.equal(esTasaConfiable(null, 'bcv-api (dolarapi)'), false);
    assert.equal(esTasaConfiable(undefined, 'bcv-api (dolarapi)'), false);
  });

  // Una fuente puede responder 200 con un número absurdo (o quedarse en una
  // tasa de hace años). Cobrar en Bs con eso es regalar la cuenta o cobrarla
  // multiplicada, así que fuera del rango plausible tampoco se acepta.
  it('rechaza una tasa fuera del rango plausible aunque la fuente sea real', () => {
    assert.equal(esTasaConfiable(1, 'bcv-api (dolarapi)'), false);
    assert.equal(esTasaConfiable(36.5, 'bcv-api (rafnixg)'), false);
    assert.equal(esTasaConfiable(1_000_000, 'bcv-api (dolarapi)'), false);
  });

  it('el rango plausible cubre la tasa real de hoy', () => {
    const [min, max] = RANGO_TASA_PLAUSIBLE;
    assert.ok(min < 775.3356 && 775.3356 < max);
  });
});
