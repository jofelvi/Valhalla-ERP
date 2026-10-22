import {
  CONFIG_DEFAULTS,
  CONFIG_IDS,
  NOMINA_DEFAULT,
  TARIFAS_DEFAULT,
  TarifasConfig,
  calcularComision,
  computeOrderTotals,
  mergeConfig,
  nombreVisible,
  normalizeConfig,
} from '@odin6/types';

const tarifas = (c: Partial<TarifasConfig> = {}): TarifasConfig => ({
  ...TARIFAS_DEFAULT,
  ...c,
  tax: { ...TARIFAS_DEFAULT.tax, ...c.tax },
});
const item = (total: number, extra: Record<string, unknown> = {}) => ({
  total,
  ...extra,
});

describe('contrato de configuración', () => {
  it.each(CONFIG_IDS)('%s: sin documento devuelve el valor neutro', (id) => {
    expect(normalizeConfig(id, undefined)).toEqual(CONFIG_DEFAULTS[id]);
    expect(normalizeConfig(id, null)).toEqual(CONFIG_DEFAULTS[id]);
    expect(normalizeConfig(id, 'basura')).toEqual(CONFIG_DEFAULTS[id]);
  });

  it('el perfil neutro no trae ninguna marca ni dato de negocio', () => {
    // Nada de dominios, correos ni RIF de ejemplo en los valores neutros.
    const json = JSON.stringify(CONFIG_DEFAULTS);
    expect(json).not.toMatch(/https?:\/\//);
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/\b[JVEG]-\d{6,}/);
    expect(CONFIG_DEFAULTS.negocio.tradeName).toBe('');
    expect(nombreVisible(CONFIG_DEFAULTS.marca, CONFIG_DEFAULTS.negocio)).toBe(
      'Punto de venta',
    );
  });

  it('el nombre visible sigue marca → negocio → genérico', () => {
    const negocio = { tradeName: 'Sabor' };
    expect(nombreVisible({ appName: '' }, negocio)).toBe('Sabor');
    expect(nombreVisible({ appName: 'Mi POS' }, negocio)).toBe('Mi POS');
  });

  it('descarta lo inválido y acota lo numérico', () => {
    const t = normalizeConfig('tarifas', {
      serviceMode: 'regalado',
      serviceRate: 7,
      baseCurrency: 'dolares',
      tax: { enabled: 'sí', rate: -1, label: '' },
    });
    expect(t.serviceMode).toBe('additional');
    expect(t.serviceRate).toBe(0.5);
    expect(t.baseCurrency).toBe('USD');
    expect(t.tax.enabled).toBe(false);
    expect(t.tax.rate).toBe(0);
    expect(t.tax.label).toBe('IVA');
  });

  it('marca: colores no hex y URLs peligrosas vuelven al valor neutro', () => {
    const m = normalizeConfig('marca', {
      logoLightUrl: 'javascript:alert(1)',
      logoDarkUrl: '//evil.example/x.png',
      iconUrl: '/logo.png',
      palette: { light: { primary: 'rojo' }, dark: { primary: '#abcdef' } },
    });
    expect(m.logoLightUrl).toBe('');
    expect(m.logoDarkUrl).toBe('');
    expect(m.iconUrl).toBe('/logo.png');
    expect(m.palette.light.primary).toBe(
      CONFIG_DEFAULTS.marca.palette.light.primary,
    );
    expect(m.palette.dark.primary).toBe('#ABCDEF');
  });

  it('operación: zona horaria inexistente vuelve a la neutra', () => {
    expect(
      normalizeConfig('operacion', { timezone: 'Marte/Olimpo' }).timezone,
    ).toBe(CONFIG_DEFAULTS.operacion.timezone);
    expect(
      normalizeConfig('operacion', { timezone: 'America/Bogota' }).timezone,
    ).toBe('America/Bogota');
  });

  it('mergeConfig mezcla un solo campo anidado sin perder el resto', () => {
    const vigente = normalizeConfig('tarifas', { serviceRate: 0.12 });
    const merged = normalizeConfig(
      'tarifas',
      mergeConfig(vigente, { tax: { enabled: true } }),
    );
    expect(merged.serviceRate).toBe(0.12);
    expect(merged.tax.enabled).toBe(true);
    expect(merged.tax.label).toBe('IVA');
  });

  it('las dos monedas y los arreglos se reemplazan, no se mezclan', () => {
    const merged = normalizeConfig(
      'tarifas',
      mergeConfig({ suggestedTipsPct: [10, 15] }, { suggestedTipsPct: [5] }),
    );
    expect(merged.suggestedTipsPct).toEqual([5]);
  });
});

describe('dinero parametrizado', () => {
  it('servicio adicional 10 % con mesonero (valor neutro)', () => {
    const t = computeOrderTotals([item(100)], true);
    expect(t.serviceCharge).toBe(10);
    expect(t.total).toBe(110);
    expect(t.comisionBase).toBe(100);
    expect(calcularComision(t.comisionBase)).toBe(7);
    expect(t.tasaServicio).toBe(0.1);
    expect(t.modoServicio).toBe('additional');
  });

  it('sin mesonero no hay servicio ni comisión', () => {
    const t = computeOrderTotals([item(100)], false);
    expect(t.serviceCharge).toBe(0);
    expect(t.total).toBe(100);
    expect(t.comisionBase).toBe(0);
  });

  it('serviceOnlyWithWaiter=false cobra servicio también sin mesonero', () => {
    const t = computeOrderTotals(
      [item(100)],
      false,
      tarifas({ serviceOnlyWithWaiter: false }),
    );
    expect(t.serviceCharge).toBe(10);
    expect(t.comisionBase).toBe(0);
  });

  it('servicio incluido en el precio: no se suma, se informa cuánto contiene', () => {
    const t = computeOrderTotals(
      [item(110)],
      true,
      tarifas({ serviceMode: 'included' }),
    );
    expect(t.serviceCharge).toBe(0);
    expect(t.servicioIncluido).toBe(10);
    expect(t.total).toBe(110);
    expect(t.comisionBase).toBe(110);
  });

  it('sin servicio: el total es el subtotal', () => {
    const t = computeOrderTotals(
      [item(100)],
      true,
      tarifas({ serviceMode: 'none' }),
    );
    expect(t.serviceCharge).toBe(0);
    expect(t.servicioIncluido).toBe(0);
    expect(t.total).toBe(100);
  });

  it('cortesía: el servicio la incluye, la comisión no', () => {
    const t = computeOrderTotals(
      [item(100), item(20, { noCharge: true })],
      true,
    );
    expect(t.subtotal).toBe(120);
    expect(t.noChargeAmount).toBe(20);
    expect(t.serviceCharge).toBe(12);
    expect(t.total).toBe(112);
    expect(t.comisionBase).toBe(100);
  });

  it('cortesía cuenta para la comisión si la nómina lo permite', () => {
    const t = computeOrderTotals(
      [item(100), item(20, { noCharge: true })],
      true,
      TARIFAS_DEFAULT,
      { ...NOMINA_DEFAULT, excludeComplimentaryFromCommission: false },
    );
    expect(t.comisionBase).toBe(120);
  });

  it('descuento baja servicio y comisión', () => {
    const t = computeOrderTotals([item(100, { discountAmount: 20 })], true);
    expect(t.serviceCharge).toBe(8);
    expect(t.total).toBe(88);
    expect(t.comisionBase).toBe(80);
  });

  it('ítems cancelados no cuentan', () => {
    const t = computeOrderTotals(
      [item(100), item(50, { cancelledAt: new Date() })],
      true,
    );
    expect(t.subtotal).toBe(100);
  });

  it('comisión sobre el servicio: 70 % del 10 % cobrado', () => {
    const nomina = {
      ...NOMINA_DEFAULT,
      commissionBasis: 'service' as const,
      commissionRate: 0.7,
    };
    const t = computeOrderTotals([item(100)], true, TARIFAS_DEFAULT, nomina);
    expect(t.comisionBase).toBe(10);
    expect(calcularComision(t.comisionBase, nomina)).toBe(7);
  });

  it('impuesto sumado: se agrega al total', () => {
    const t = computeOrderTotals(
      [item(100)],
      true,
      tarifas({
        tax: { ...TARIFAS_DEFAULT.tax, enabled: true, includedInPrice: false },
      }),
    );
    expect(t.tax).toBe(16);
    expect(t.total).toBe(126);
    expect(t.ivaIncluido).toBe(false);
  });

  it('impuesto incluido: se informa, no se suma', () => {
    const t = computeOrderTotals(
      [item(116)],
      false,
      tarifas({
        tax: { ...TARIFAS_DEFAULT.tax, enabled: true, includedInPrice: true },
      }),
    );
    expect(t.tax).toBe(16);
    expect(t.total).toBe(116);
  });

  it('impuesto apagado por defecto', () => {
    expect(computeOrderTotals([item(100)], true).tax).toBe(0);
  });

  it('una orden vacía da todo en cero', () => {
    const t = computeOrderTotals([], true);
    expect(t.total).toBe(0);
    expect(t.serviceCharge).toBe(0);
    expect(t.comisionBase).toBe(0);
  });
});
