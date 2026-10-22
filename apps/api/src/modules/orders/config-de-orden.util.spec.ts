import {
  computeOrderTotals,
  NOMINA_DEFAULT,
  NominaConfig,
  TARIFAS_DEFAULT,
  TarifasConfig,
} from '@odin6/types';
import {
  camposDeTotales,
  configDeOrden,
  diferenciasConCliente,
  nominaDeOrden,
} from './config-de-orden.util';

const linea = (total: number, extra: Record<string, unknown> = {}) => ({
  total,
  ...extra,
});

const conTarifas = (over: Partial<TarifasConfig>): TarifasConfig => ({
  ...TARIFAS_DEFAULT,
  ...over,
});

const conImpuesto = (over: Partial<TarifasConfig['tax']>): TarifasConfig =>
  conTarifas({ tax: { ...TARIFAS_DEFAULT.tax, enabled: true, ...over } });

/** Lo que el servidor guarda al crear una orden con esa configuracion. */
const crear = (
  items: Array<Record<string, unknown>>,
  hadWaiter: boolean,
  tarifas: TarifasConfig,
  nomina: NominaConfig = NOMINA_DEFAULT,
) => {
  const config = { tarifas, nomina };
  return camposDeTotales(
    computeOrderTotals(items, hadWaiter, tarifas, nomina),
    config,
  );
};

describe('servicio: los tres modos', () => {
  const items = [linea(100)];

  it('additional: el servicio se suma a la cuenta', () => {
    const t = computeOrderTotals(items, true, TARIFAS_DEFAULT, NOMINA_DEFAULT);
    expect(t.serviceCharge).toBe(10);
    expect(t.servicioIncluido).toBe(0);
    expect(t.total).toBe(110);
  });

  it('included: no se suma, pero se informa cuanto trae el precio', () => {
    const t = computeOrderTotals(
      items,
      true,
      conTarifas({ serviceMode: 'included' }),
      NOMINA_DEFAULT,
    );
    expect(t.serviceCharge).toBe(0);
    expect(t.servicioIncluido).toBe(9.09); // 100 - 100 / 1.10
    expect(t.total).toBe(100);
  });

  it('none: no hay servicio', () => {
    const t = computeOrderTotals(
      items,
      true,
      conTarifas({ serviceMode: 'none' }),
      NOMINA_DEFAULT,
    );
    expect(t.serviceCharge).toBe(0);
    expect(t.total).toBe(100);
  });

  it('sin mesonero no hay servicio si serviceOnlyWithWaiter', () => {
    const t = computeOrderTotals(items, false, TARIFAS_DEFAULT, NOMINA_DEFAULT);
    expect(t.serviceCharge).toBe(0);
  });
});

describe('impuesto: sumado e incluido', () => {
  it('sumado: se agrega al total', () => {
    const t = computeOrderTotals(
      [linea(100)],
      false,
      conImpuesto({ rate: 0.16, includedInPrice: false }),
      NOMINA_DEFAULT,
    );
    expect(t.tax).toBe(16);
    expect(t.total).toBe(116);
    expect(t.tasaIva).toBe(0.16);
    expect(t.ivaIncluido).toBe(false);
  });

  it('incluido: no se suma, se informa lo que contiene', () => {
    const t = computeOrderTotals(
      [linea(116)],
      false,
      conImpuesto({ rate: 0.16, includedInPrice: true }),
      NOMINA_DEFAULT,
    );
    expect(t.tax).toBe(16);
    expect(t.total).toBe(116);
    expect(t.ivaIncluido).toBe(true);
  });
});

describe('comision: sobre ventas y sobre servicio', () => {
  it('sales: la base son las ventas atribuibles; la comision es base x tasa', () => {
    const t = computeOrderTotals(
      [linea(100)],
      true,
      TARIFAS_DEFAULT,
      NOMINA_DEFAULT,
    );
    expect(t.comisionBase).toBe(100);
  });

  it('sales: las cortesias no generan comision si la nomina las excluye', () => {
    const t = computeOrderTotals(
      [linea(100), linea(20, { noCharge: true })],
      true,
      TARIFAS_DEFAULT,
      NOMINA_DEFAULT,
    );
    expect(t.comisionBase).toBe(100);
  });

  it('service: la base es el servicio de esas ventas', () => {
    const nomina: NominaConfig = {
      ...NOMINA_DEFAULT,
      commissionBasis: 'service',
    };
    const t = computeOrderTotals([linea(100)], true, TARIFAS_DEFAULT, nomina);
    expect(t.comisionBase).toBe(10);
  });
});

describe('la orden guarda su configuracion y no la vigente', () => {
  it('cambiar la tarifa no altera el total de una orden ya creada', () => {
    // Creada con el 10 %: la orden guarda la configuracion completa.
    const guardado = crear([linea(100)], true, TARIFAS_DEFAULT);
    expect(guardado.serviceCharge).toBe(10);
    expect(guardado.total).toBe(110);

    // Despues el dueno sube la tarifa al 20 %: el recalculo de la orden sigue con el 10 %.
    // (La vigente solo la leen las ordenes que nacen; ver configVigente en orders.service.)
    const config = configDeOrden(guardado);
    const recalculo = computeOrderTotals(
      [linea(100)],
      true,
      config.tarifas,
      config.nomina,
    );
    expect(recalculo.serviceCharge).toBe(10);
    expect(recalculo.tax).toBe(0);
    expect(recalculo.total).toBe(110);
  });

  it('cambiar si el servicio exige mesonero no toca una orden de caja creada sin el', () => {
    const creada = crear([linea(50)], false, TARIFAS_DEFAULT);
    const despues = conTarifas({ serviceOnlyWithWaiter: false });
    const config = configDeOrden(creada);
    const t = computeOrderTotals(
      [linea(50)],
      false,
      config.tarifas,
      config.nomina,
    );
    expect(t.serviceCharge).toBe(0);
    expect(despues.serviceOnlyWithWaiter).toBe(false); // la vigente cambio, la orden no
  });

  it('cambiar la comision no cambia la nomina con que nacio la orden', () => {
    const creada = crear([linea(100)], true, TARIFAS_DEFAULT, NOMINA_DEFAULT);
    expect(nominaDeOrden(creada).commissionRate).toBe(0.07);
  });

  it('una orden anterior a la configuracion se reconstruye con neutros, no con los vigentes', () => {
    const legado = {
      tasaServicio: 0.1,
      modoServicio: 'additional' as const,
      tasaIva: 0,
      ivaIncluido: true,
    };
    const config = configDeOrden(legado);
    expect(config.tarifas.serviceRate).toBe(0.1);
    expect(config.tarifas.serviceMode).toBe('additional');
    expect(config.tarifas.tax.enabled).toBe(false);
    expect(config.nomina).toEqual(NOMINA_DEFAULT);
  });

  it('nominaDeOrden sin copia devuelve la neutra', () => {
    expect(nominaDeOrden({})).toEqual(NOMINA_DEFAULT);
  });
});

describe('diferenciasConCliente: el servidor manda, el log dice lo que difirio', () => {
  const calculado = { serviceCharge: 10, tax: 0, total: 110 };

  it('no avisa si el cliente coincide (con centavos de redondeo)', () => {
    expect(
      diferenciasConCliente({ serviceCharge: 10.004, total: 110 }, calculado),
    ).toEqual([]);
  });

  it('avisa con el campo y los dos valores si difiere', () => {
    expect(diferenciasConCliente({ total: 130 }, calculado)).toEqual([
      'total cliente=130 servidor=110',
    ]);
  });

  it('un campo que no llego no cuenta como diferencia', () => {
    expect(diferenciasConCliente({}, calculado)).toEqual([]);
  });

  it('ignora lo que no es numero', () => {
    expect(diferenciasConCliente({ total: 'x' }, calculado)).toEqual([]);
  });
});
