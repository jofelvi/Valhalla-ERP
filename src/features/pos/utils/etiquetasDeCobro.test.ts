import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NOMINA_DEFAULT,
  TARIFAS_DEFAULT,
  type NominaConfig,
  type TarifasConfig,
} from '@odin6/types';
import {
  etiquetaComision,
  etiquetaImpuesto,
  etiquetaServicio,
  porcentaje,
} from './etiquetasDeCobro.ts';

function tarifasCon(extra: Partial<TarifasConfig> = {}): TarifasConfig {
  return { ...TARIFAS_DEFAULT, ...extra };
}

describe('porcentaje', () => {
  it('convierte la fracción a texto sin ceros de sobra', () => {
    assert.equal(porcentaje(0.1), '10%');
    assert.equal(porcentaje(0.16), '16%');
    assert.equal(porcentaje(0.075), '7.5%');
    assert.equal(porcentaje(0), '0%');
  });
});

describe('etiquetaServicio según el modo', () => {
  it('additional: "Servicio (X%)"', () => {
    assert.equal(
      etiquetaServicio(
        tarifasCon({ serviceMode: 'additional', serviceRate: 0.1 }),
      ),
      'Servicio (10%)',
    );
  });

  it('included: "Servicio incluido (X%)"', () => {
    assert.equal(
      etiquetaServicio(
        tarifasCon({ serviceMode: 'included', serviceRate: 0.12 }),
      ),
      'Servicio incluido (12%)',
    );
  });

  it('none: sin línea de servicio', () => {
    assert.equal(
      etiquetaServicio(tarifasCon({ serviceMode: 'none', serviceRate: 0.1 })),
      null,
    );
  });
});

describe('etiquetaImpuesto', () => {
  const impuesto = {
    ...TARIFAS_DEFAULT.tax,
    enabled: true,
    rate: 0.16,
    label: 'IVA',
  };

  it('apagado: sin línea de impuesto', () => {
    assert.equal(
      etiquetaImpuesto(tarifasCon({ tax: { ...impuesto, enabled: false } })),
      null,
    );
  });

  it('sumado: lleva "sumado" y la etiqueta configurada', () => {
    assert.equal(
      etiquetaImpuesto(
        tarifasCon({ tax: { ...impuesto, includedInPrice: false } }),
      ),
      'IVA (16%) sumado',
    );
  });

  it('incluido: lleva "incluido"', () => {
    assert.equal(
      etiquetaImpuesto(
        tarifasCon({ tax: { ...impuesto, includedInPrice: true } }),
      ),
      'IVA (16%) incluido',
    );
  });

  it('usa la etiqueta del negocio, no un nombre fijo', () => {
    assert.equal(
      etiquetaImpuesto(
        tarifasCon({
          tax: {
            ...impuesto,
            label: 'ITBIS',
            rate: 0.18,
            includedInPrice: false,
          },
        }),
      ),
      'ITBIS (18%) sumado',
    );
  });
});

describe('etiquetaComision', () => {
  const nomina: NominaConfig = { ...NOMINA_DEFAULT };

  it('sobre ventas: "del consumo"', () => {
    assert.equal(
      etiquetaComision({
        ...nomina,
        commissionBasis: 'sales',
        commissionRate: 0.07,
      }),
      'Comisión · 7% del consumo',
    );
  });

  it('sobre servicio: "del servicio"', () => {
    assert.equal(
      etiquetaComision({
        ...nomina,
        commissionBasis: 'service',
        commissionRate: 0.7,
      }),
      'Comisión · 70% del servicio',
    );
  });
});
