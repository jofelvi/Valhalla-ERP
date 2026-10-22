import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tarifasDeOrden } from './tarifasDeOrden.ts';
import { TARIFAS_DEFAULT } from '../shared/contrato.ts';

test('sin orden devuelve las tarifas vigentes', () => {
  assert.equal(tarifasDeOrden(null, TARIFAS_DEFAULT), TARIFAS_DEFAULT);
});

test('la orden guardada manda sobre la configuración vigente', () => {
  const t = tarifasDeOrden(
    {
      tasaServicio: 0.05,
      modoServicio: 'included',
      tasaIva: 0.16,
      ivaIncluido: false,
    },
    TARIFAS_DEFAULT,
  );
  assert.equal(t.serviceRate, 0.05);
  assert.equal(t.serviceMode, 'included');
  assert.equal(t.tax.enabled, true);
  assert.equal(t.tax.rate, 0.16);
  assert.equal(t.tax.includedInPrice, false);
});

test('tasaIva 0 en la orden apaga el impuesto para esa orden', () => {
  const vigente = {
    ...TARIFAS_DEFAULT,
    tax: { ...TARIFAS_DEFAULT.tax, enabled: true },
  };
  const t = tarifasDeOrden({ tasaIva: 0 }, vigente);
  assert.equal(t.tax.enabled, false);
});

test('campos ausentes o de tipo inválido caen a la vigente', () => {
  const t = tarifasDeOrden(
    { modoServicio: 'raro', tasaServicio: Number.NaN },
    TARIFAS_DEFAULT,
  );
  assert.equal(t.serviceMode, TARIFAS_DEFAULT.serviceMode);
  assert.equal(t.serviceRate, TARIFAS_DEFAULT.serviceRate);
});
