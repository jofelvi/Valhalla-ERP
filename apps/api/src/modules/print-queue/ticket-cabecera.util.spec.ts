import {
  CONFIG_DEFAULTS,
  MARCA_DEFAULT,
  NEGOCIO_DEFAULT,
  NegocioConfig,
  OPERACION_DEFAULT,
  TARIFAS_DEFAULT,
  TarifasConfig,
} from '@odin6/types';
import {
  completarCabeceraTicket,
  etiquetaImpuestoTicket,
  etiquetaServicioTicket,
  porcentajeTexto,
  ConfigTicket,
} from './ticket-cabecera.util';

// Negocio ficticio: los datos de prueba no salen de ningún negocio real.
const NEGOCIO: NegocioConfig = {
  ...NEGOCIO_DEFAULT,
  tradeName: 'Local Prueba',
  tagline: 'Restaurante de prueba',
  address: 'Calle de prueba 1',
  phone: '+1 555 0100',
  taxId: 'T-000',
  receiptFooter: 'Gracias de prueba',
  mobilePayment: { bank: '0001', phone: '5550100', documentId: '99' },
};

const tarifas = (cambios: Partial<TarifasConfig>): TarifasConfig => ({
  ...TARIFAS_DEFAULT,
  ...cambios,
});

const cfg = (
  t: TarifasConfig = TARIFAS_DEFAULT,
  negocio: NegocioConfig = NEGOCIO,
): ConfigTicket => ({
  negocio,
  marca: MARCA_DEFAULT,
  tarifas: t,
  operacion: OPERACION_DEFAULT,
});

// 21/10/2026 10:30 UTC = 06:30 en Caracas (UTC-4).
const AHORA = new Date('2026-10-21T10:30:00Z');

describe('completarCabeceraTicket', () => {
  it('completa la cabecera desde negocio y marca cuando el cliente no manda nada', () => {
    const out = completarCabeceraTicket({ orderNumber: 'A1' }, cfg(), AHORA);

    expect(out.businessName).toBe('Local Prueba');
    expect(out.businessSubtitle).toBe('Restaurante de prueba');
    expect(out.address).toBe('Calle de prueba 1');
    expect(out.footerMessage).toBe('Gracias de prueba');
  });

  it('usa el nombre visible de la marca antes que el nombre comercial', () => {
    const out = completarCabeceraTicket(
      { orderNumber: 'A1' },
      {
        ...cfg(),
        marca: { ...MARCA_DEFAULT, appName: 'Mi Marca' },
        negocio: NEGOCIO,
      },
      AHORA,
    );
    expect(out.businessName).toBe('Mi Marca');
    expect(out.footerBrand).toBe('Mi Marca');
  });

  it('cae al nombre comercial cuando la marca no tiene nombre', () => {
    const out = completarCabeceraTicket({}, cfg(), AHORA);
    expect(out.businessName).toBe('Local Prueba');
    expect(out.address).toBe('Calle de prueba 1');
    expect(out.phone).toBe('+1 555 0100');
    expect(out.rif).toBe('T-000');
  });

  it('no pisa lo que el cliente ya mandó, ni siquiera con el valor distinto', () => {
    const out = completarCabeceraTicket(
      { businessName: 'Desde la APK', address: '', taxLabel: 'IVA (16%)' },
      cfg(tarifas({ tax: { ...TARIFAS_DEFAULT.tax, enabled: true } })),
      AHORA,
    );
    expect(out.businessName).toBe('Desde la APK');
    // Texto vacío cuenta como ausente: la dirección sí se completa.
    expect(out.address).toBe('Calle de prueba 1');
    expect(out.taxLabel).toBe('IVA (16%)');
  });

  it('pone fecha y hora de 24 horas en la zona del negocio', () => {
    const out = completarCabeceraTicket({}, cfg(), AHORA);
    expect(out.date).toBe('21/10/2026');
    expect(out.time).toBe('06:30');
  });

  it('respeta la fecha y hora que manda el cliente', () => {
    const out = completarCabeceraTicket(
      { date: '01/01/2026', time: '12:00' },
      cfg(),
      AHORA,
    );
    expect(out.date).toBe('01/01/2026');
    expect(out.time).toBe('12:00');
  });

  it('servicio aditivo: "Servicio (X%)" con la tasa configurada', () => {
    const out = completarCabeceraTicket(
      {},
      cfg(tarifas({ serviceMode: 'additional', serviceRate: 0.075 })),
      AHORA,
    );
    expect(out.serviceLabel).toBe('Servicio (7.5%)');
  });

  it('servicio incluido: "Servicio incluido (X%)"', () => {
    const out = completarCabeceraTicket(
      {},
      cfg(tarifas({ serviceMode: 'included', serviceRate: 0.1 })),
      AHORA,
    );
    expect(out.serviceLabel).toBe('Servicio incluido (10%)');
  });

  it('sin servicio no pone serviceLabel', () => {
    const out = completarCabeceraTicket(
      {},
      cfg(tarifas({ serviceMode: 'none' })),
      AHORA,
    );
    expect(out.serviceLabel).toBeUndefined();
  });

  it('impuesto apagado: no pone taxLabel, pero sí taxMode', () => {
    const out = completarCabeceraTicket({}, cfg(), AHORA);
    expect(out.taxLabel).toBeUndefined();
    // Por defecto el impuesto viene incluido en el precio.
    expect(out.taxMode).toBe('included');
  });

  it('impuesto encendido e incluido: etiqueta con su tasa y taxMode included', () => {
    const out = completarCabeceraTicket(
      {},
      cfg(
        tarifas({
          tax: {
            enabled: true,
            rate: 0.16,
            label: 'IVA',
            includedInPrice: true,
            appliesToService: false,
          },
        }),
      ),
      AHORA,
    );
    expect(out.taxLabel).toBe('IVA (16%) incluido');
    expect(out.taxMode).toBe('included');
  });

  it('impuesto sumado: taxMode added', () => {
    const out = completarCabeceraTicket(
      {},
      cfg(
        tarifas({
          tax: {
            enabled: true,
            rate: 0.12,
            label: 'ITBIS',
            includedInPrice: false,
            appliesToService: false,
          },
        }),
      ),
      AHORA,
    );
    expect(out.taxLabel).toBe('ITBIS (12%) sumado');
    expect(out.taxMode).toBe('added');
  });

  it('pago móvil sale de negocio; sin datos no se agrega el bloque', () => {
    const conPm = completarCabeceraTicket({}, cfg(), AHORA);
    expect(conPm.pagoMovil).toEqual({
      banco: '0001',
      telefono: '5550100',
      documento: '99',
    });

    const sinPm = completarCabeceraTicket(
      {},
      cfg(TARIFAS_DEFAULT, { ...NEGOCIO, mobilePayment: null }),
      AHORA,
    );
    expect(sinPm.pagoMovil).toBeUndefined();
  });

  it('no toca el payload original', () => {
    const original = { orderNumber: 'A1' };
    completarCabeceraTicket(original, cfg(), AHORA);
    expect(original).toEqual({ orderNumber: 'A1' });
  });

  it('con la configuración neutra del contrato no inventa datos de un negocio', () => {
    const out = completarCabeceraTicket(
      { orderNumber: 'A1' },
      {
        negocio: CONFIG_DEFAULTS.negocio,
        marca: CONFIG_DEFAULTS.marca,
        tarifas: CONFIG_DEFAULTS.tarifas,
        operacion: CONFIG_DEFAULTS.operacion,
      },
      AHORA,
    );
    expect(out.pagoMovil).toBeUndefined();
    expect(out.phone).toBeUndefined();
    expect(out.rif).toBeUndefined();
    expect(out.businessName).toBe('Punto de venta');
  });
});

describe('etiquetas de servicio e impuesto', () => {
  it('porcentajeTexto quita los decimales de cero', () => {
    expect(porcentajeTexto(0.1)).toBe('10%');
    expect(porcentajeTexto(0.075)).toBe('7.5%');
  });

  it('servicio: null con modo none', () => {
    expect(etiquetaServicioTicket(tarifas({ serviceMode: 'none' }))).toBeNull();
  });

  it('impuesto: null cuando está apagado', () => {
    expect(etiquetaImpuestoTicket(TARIFAS_DEFAULT)).toBeNull();
  });
});
