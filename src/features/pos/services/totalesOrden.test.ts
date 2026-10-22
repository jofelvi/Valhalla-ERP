import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NOMINA_DEFAULT,
  TARIFAS_DEFAULT,
  type NominaConfig,
  type TarifasConfig,
} from '@odin6/types';
import {
  calcularTotalesOrden,
  tarifasDeOrden,
  tasasGuardadasDe,
} from './totalesOrden.ts';

/** Una orden de un solo ítem por $100, sin cortesías ni descuentos. */
const ITEMS = [{ total: 100 }];

/** Tarifas de prueba: cada caso cambia solo lo que prueba. */
function tarifasCon(extra: Partial<TarifasConfig> = {}): TarifasConfig {
  return { ...TARIFAS_DEFAULT, ...extra };
}

function impuesto(
  extra: Partial<TarifasConfig['tax']> = {},
): TarifasConfig['tax'] {
  return { ...TARIFAS_DEFAULT.tax, enabled: true, rate: 0.16, ...extra };
}

function nominaCon(extra: Partial<NominaConfig> = {}): NominaConfig {
  return { ...NOMINA_DEFAULT, ...extra };
}

describe('calcularTotalesOrden: modos de servicio', () => {
  it('additional con mesonero: el servicio se suma al total', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas: tarifasCon({ serviceMode: 'additional', serviceRate: 0.1 }),
      nomina: nominaCon(),
    });
    assert.equal(t.serviceCharge, 10);
    assert.equal(t.total, 110);
    assert.equal(t.servicioIncluido, 0);
  });

  it('additional sin mesonero y con serviceOnlyWithWaiter: no hay servicio', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: false,
      tarifas: tarifasCon({
        serviceMode: 'additional',
        serviceRate: 0.1,
        serviceOnlyWithWaiter: true,
      }),
      nomina: nominaCon(),
    });
    assert.equal(t.serviceCharge, 0);
    assert.equal(t.total, 100);
  });

  it('additional sin mesonero pero sin la restricción: el servicio aplica igual', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: false,
      tarifas: tarifasCon({
        serviceMode: 'additional',
        serviceRate: 0.1,
        serviceOnlyWithWaiter: false,
      }),
      nomina: nominaCon(),
    });
    assert.equal(t.serviceCharge, 10);
    assert.equal(t.total, 110);
  });

  it('included: no se suma; informa cuánto trae el precio', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas: tarifasCon({ serviceMode: 'included', serviceRate: 0.1 }),
      nomina: nominaCon(),
    });
    assert.equal(t.serviceCharge, 0);
    assert.equal(t.total, 100);
    // 100 − 100/1.1 = 9.09
    assert.equal(t.servicioIncluido, 9.09);
  });

  it('none: sin servicio ni información de servicio', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas: tarifasCon({ serviceMode: 'none', serviceRate: 0.1 }),
      nomina: nominaCon(),
    });
    assert.equal(t.serviceCharge, 0);
    assert.equal(t.servicioIncluido, 0);
    assert.equal(t.total, 100);
  });

  it('una tasa de servicio distinta cambia el total sin tocar código', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas: tarifasCon({ serviceMode: 'additional', serviceRate: 0.15 }),
      nomina: nominaCon(),
    });
    assert.equal(t.serviceCharge, 15);
    assert.equal(t.total, 115);
  });
});

describe('calcularTotalesOrden: impuesto sumado o incluido', () => {
  const base = tarifasCon({ serviceMode: 'none', tax: impuesto() });

  it('sumado: se agrega al total', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: false,
      tarifas: { ...base, tax: impuesto({ includedInPrice: false }) },
      nomina: nominaCon(),
    });
    assert.equal(t.tax, 16);
    assert.equal(t.total, 116);
    assert.equal(t.ivaIncluido, false);
    assert.equal(t.tasaIva, 0.16);
  });

  it('incluido: no se suma; el total queda igual y el impuesto es informativo', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: false,
      tarifas: { ...base, tax: impuesto({ includedInPrice: true }) },
      nomina: nominaCon(),
    });
    // 100 − 100/1.16 = 13.79
    assert.equal(t.tax, 13.79);
    assert.equal(t.total, 100);
    assert.equal(t.ivaIncluido, true);
  });

  it('impuesto apagado: tasaIva 0 y sin impuesto', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: false,
      tarifas: { ...base, tax: impuesto({ enabled: false }) },
      nomina: nominaCon(),
    });
    assert.equal(t.tax, 0);
    assert.equal(t.tasaIva, 0);
    assert.equal(t.total, 100);
  });

  it('appliesToService: el impuesto también grava el servicio', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas: tarifasCon({
        serviceMode: 'additional',
        serviceRate: 0.1,
        tax: impuesto({ includedInPrice: false, appliesToService: true }),
      }),
      nomina: nominaCon(),
    });
    // (100 + 10) × 16 % = 17.60
    assert.equal(t.tax, 17.6);
    assert.equal(t.total, 127.6);
  });
});

describe('calcularTotalesOrden: comisión del mesonero', () => {
  const tarifas = tarifasCon({ serviceMode: 'additional', serviceRate: 0.1 });

  it('basis sales: la base es la venta, sin servicio', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas,
      nomina: nominaCon({ commissionBasis: 'sales', commissionRate: 0.07 }),
    });
    assert.equal(t.comisionBase, 100);
  });

  it('basis service: la base es el servicio de esa venta', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas,
      nomina: nominaCon({ commissionBasis: 'service', commissionRate: 0.7 }),
    });
    assert.equal(t.comisionBase, 10);
  });

  it('sin mesonero no hay base de comisión', () => {
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: false,
      tarifas,
      nomina: nominaCon(),
    });
    assert.equal(t.comisionBase, 0);
  });

  it('cortesía excluida de la comisión: baja la base, no el servicio', () => {
    const t = calcularTotalesOrden({
      items: [{ total: 100 }, { total: 40, noCharge: true }],
      tieneMesonero: true,
      tarifas,
      nomina: nominaCon({
        commissionBasis: 'sales',
        excludeComplimentaryFromCommission: true,
      }),
    });
    // La cortesía sale del consumo que paga el mesonero, pero el servicio se calcula sobre el subtotal.
    assert.equal(t.comisionBase, 100);
    assert.equal(t.serviceCharge, 14);
  });
});

describe('tasas guardadas en la orden', () => {
  it('tasasGuardadasDe lee las cuatro tasas cuando la orden las trae', () => {
    const guardadas = {
      tasaServicio: 0.05,
      modoServicio: 'additional',
      tasaIva: 0,
      ivaIncluido: false,
    };
    assert.deepEqual(tasasGuardadasDe(guardadas), guardadas);
  });

  it('tasasGuardadasDe devuelve undefined si faltan o son inválidas', () => {
    assert.equal(tasasGuardadasDe({}), undefined);
    assert.equal(tasasGuardadasDe(null), undefined);
    assert.equal(
      tasasGuardadasDe({
        tasaServicio: 0.1,
        modoServicio: 'otro',
        tasaIva: 0,
        ivaIncluido: false,
      }),
      undefined,
    );
  });

  it('una orden guardada se calcula con SUS tasas, no con las vigentes', () => {
    // Vigente: servicio 10 % e IVA 16 %. La orden se cerró con 5 % y sin IVA.
    const t = calcularTotalesOrden({
      items: ITEMS,
      tieneMesonero: true,
      tarifas: tarifasCon({
        serviceMode: 'additional',
        serviceRate: 0.1,
        tax: impuesto({ includedInPrice: false }),
      }),
      nomina: nominaCon(),
      guardadas: {
        tasaServicio: 0.05,
        modoServicio: 'additional',
        tasaIva: 0,
        ivaIncluido: false,
      },
    });
    assert.equal(t.serviceCharge, 5);
    assert.equal(t.tax, 0);
    assert.equal(t.total, 105);
    assert.equal(t.tasaServicio, 0.05);
    assert.equal(t.tasaIva, 0);
  });

  it('sin tasas guardadas rigen las vigentes', () => {
    const vigentes = tarifasCon({ serviceRate: 0.1 });
    assert.equal(tarifasDeOrden(vigentes, undefined), vigentes);
  });
});
