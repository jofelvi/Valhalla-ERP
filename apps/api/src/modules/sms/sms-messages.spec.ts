import {
  buildPurchaseSms,
  buildCompraDirectaSms,
  buildCreditSms,
  buildItemsLine,
  toGsmSafe,
} from './sms-messages';

const APP = 'https://app.ejemplo.com';

describe('toGsmSafe', () => {
  it('quita los acentos que sacan al SMS del alfabeto GSM', () => {
    // Con la "i" acentuada el segmento cae de 160 a 70 caracteres y el mismo
    // aviso pasa a costar el doble.
    expect(toGsmSafe('Maltin Polar')).toBe('Maltin Polar');
    expect(toGsmSafe('Maltín Polar')).toBe('Maltin Polar');
    expect(toGsmSafe('Té de Jamaica')).toBe('Te de Jamaica');
    expect(toGsmSafe('Tequeños')).toBe('Tequenos');
  });

  it('deja el resultado dentro de ASCII', () => {
    const salida = toGsmSafe('Piña, café, señor, ÁÉÍÓÚ');
    expect(/^[\x00-\x7F]*$/.test(salida)).toBe(true);
  });
});

describe('buildItemsLine', () => {
  it('arma el detalle de lo consumido', () => {
    expect(
      buildItemsLine([
        { quantity: 2, name: 'Perro Caliente' },
        { quantity: 1, name: 'Pepsi 1L' },
      ]),
    ).toBe('2x Perro Caliente, 1x Pepsi 1L');
  });

  it('descarta items en cantidad cero', () => {
    expect(
      buildItemsLine([
        { quantity: 0, name: 'Cancelado' },
        { quantity: 1, name: 'Pepsi' },
      ]),
    ).toBe('1x Pepsi');
  });

  it('sin items devuelve vacio', () => {
    expect(buildItemsLine([])).toBe('');
    expect(buildItemsLine(null)).toBe('');
  });
});

describe('buildPurchaseSms', () => {
  const base = {
    customerName: 'Maricela Perez',
    orderId: 'abc123def456',
    total: 10.78,
    itemCount: 2,
    publicAppUrl: APP,
  };

  it('incluye el detalle de lo consumido', () => {
    const sms = buildPurchaseSms({
      ...base,
      items: [
        { quantity: 2, name: 'Perro Caliente' },
        { quantity: 1, name: 'Té de Jamaica' },
      ],
    });
    expect(sms).toContain('2x Perro Caliente');
    // El acento del template original no puede llegar al SMS.
    expect(sms).toContain('1x Te de Jamaica');
    expect(sms).toContain('Total: $10.78');
    expect(sms).toContain(`${APP}/public/precuenta/abc123def456`);
  });

  it('saluda por el primer nombre', () => {
    const sms = buildPurchaseSms({ ...base, items: [] });
    expect(sms).toContain('Maricela, gracias');
  });

  it('sin nombre no deja el saludo colgando', () => {
    const sms = buildPurchaseSms({ ...base, customerName: null, items: [] });
    expect(sms).toContain('Gracias por tu compra');
  });

  it('sin items cae al conteo en vez de quedar sin referencia', () => {
    const sms = buildPurchaseSms({ ...base, items: [] });
    expect(sms).toContain('2 item(s)');
  });

  it('nunca deja caracteres fuera de GSM', () => {
    const sms = buildPurchaseSms({
      ...base,
      customerName: 'José Ramírez',
      items: [{ quantity: 1, name: 'Piña Colada' }],
    });
    expect(/^[\x00-\x7F]*$/.test(sms)).toBe(true);
  });
});

describe('buildCreditSms', () => {
  const base = {
    customerName: 'Luis Bartender',
    orderId: 'ord41c0411e',
    accountReceivableId: 'ar-999',
    amount: 0.6,
    publicAppUrl: APP,
  };

  it('incluye el detalle de lo consumido', () => {
    const sms = buildCreditSms({
      ...base,
      items: [{ quantity: 1, name: 'Freegells Cereza' }],
    });
    expect(sms).toContain('1x Freegells Cereza');
    expect(sms).toContain('Monto: $0.60');
    expect(sms).toContain(`${APP}/public/reportar-pago/ar-999`);
  });

  it('sin items omite la linea, no deja un renglon vacio', () => {
    const sms = buildCreditSms({ ...base, items: [] });
    expect(sms).not.toContain('\n\n');
  });

  it('muestra el vencimiento cuando lo hay', () => {
    const sms = buildCreditSms({
      ...base,
      items: [],
      dueDate: new Date('2026-08-29T12:00:00Z'),
    });
    expect(sms).toContain('Vence 29/08');
  });
});

describe('buildCompraDirectaSms', () => {
  const base = {
    customerName: 'Luis Bartender',
    amount: 74.69,
    publicAppUrl: APP,
  };

  it('NO lleva enlace de pago: es lo que hacia que el aviso fuera un cobro', () => {
    // El bug: a quien pagaba en el acto le llegaba el SMS de credito, con
    // «Paga o reporta aqui» y un enlace para pagar lo que ya habia pagado.
    // Medido en produccion: 9 cuentas saldadas en menos de una hora en 45 dias.
    const sms = buildCompraDirectaSms(base);
    expect(sms).not.toContain('reportar-pago');
    expect(sms).not.toContain('Paga o reporta');
    expect(sms).not.toContain('pendiente de pago');
  });

  it('lleva la pagina del restaurante, que es lo que pidio el dueno', () => {
    expect(buildCompraDirectaSms(base)).toContain(APP);
  });

  it('agradece y dice lo pagado', () => {
    const sms = buildCompraDirectaSms(base);
    expect(sms).toContain('Luis, gracias por tu compra');
    expect(sms).toContain('Pagado: $74.69');
  });

  it('sin nombre saluda igual, sin dejar un hueco', () => {
    expect(buildCompraDirectaSms({ amount: 10 })).toContain(
      'Gracias por tu compra',
    );
  });

  it('el detalle de lo comprado va cuando lo hay', () => {
    const sms = buildCompraDirectaSms({
      ...base,
      items: [{ quantity: 2, name: 'Perro Caliente' }],
    });
    expect(sms).toContain('Perro Caliente');
  });

  it('una deuda ANTERIOR se nombra, pero sin enlace para pagarla', () => {
    const sms = buildCompraDirectaSms({ ...base, outstandingTotal: 30 });
    expect(sms).toContain('Saldo pendiente anterior: $30.00');
    expect(sms).not.toContain('reportar-pago');
  });

  it('sin deuda anterior no se inventa una linea de saldo', () => {
    const sms = buildCompraDirectaSms({ ...base, outstandingTotal: 0 });
    expect(sms).not.toContain('Saldo pendiente');
  });

  it('sale en alfabeto GSM, para que no cueste el doble', () => {
    const sms = buildCompraDirectaSms({ customerName: 'José', amount: 5 });
    expect(sms).toContain('Jose');
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7F]*$/.test(sms)).toBe(true);
  });
});
