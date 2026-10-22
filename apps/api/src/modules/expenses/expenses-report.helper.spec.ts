import { OPERACION_DEFAULT } from '@odin6/types';
import {
  armarInforme,
  formatearInformeTelegram,
  formatearGastoTelegram,
  escapeHtml,
} from './expenses-report.helper';
import { ExpenseLean } from './schemas/expense.schema';

const semana = {
  desde: new Date('2026-09-01T10:00:00.000Z'),
  hasta: new Date('2026-09-08T10:00:00.000Z'),
  socio: 'Orlando',
  estimado: true,
};

function gasto(p: Partial<ExpenseLean>): ExpenseLean {
  return {
    _id: p._id ?? 'g1',
    kind: 'GENERAL',
    category: 'Otros',
    currency: 'BS',
    amountBs: 100,
    amountUsd: 2.74,
    exchangeRate: 36.5,
    paymentStatus: 'PAID',
    fundsSource: 'EMPRESA',
    invoiceUrls: [],
    date: new Date('2026-09-02T12:00:00.000Z'),
    weekStart: semana.desde,
    socioTurno: 'Orlando',
    registeredBy: { socio: 'Jonathan' },
    source: 'telegram',
    ...p,
  } as ExpenseLean;
}

describe('armarInforme', () => {
  it('totaliza por tipo, categoria y socio en ambas monedas', () => {
    const inf = armarInforme({
      semana,
      gastos: [
        gasto({
          _id: 'a',
          kind: 'INSUMOS',
          category: 'Bebidas',
          amountBs: 3650,
          amountUsd: 100,
        }),
        gasto({
          _id: 'b',
          kind: 'GENERAL',
          category: 'Transporte',
          amountBs: 365,
          amountUsd: 10,
          registeredBy: { socio: 'Daisy' },
        }),
        gasto({
          _id: 'c',
          kind: 'GENERAL',
          category: 'Transporte',
          amountBs: 365,
          amountUsd: 10,
        }),
      ],
      porPagar: [],
      reembolsos: [],
      comprasWeb: [],
      novedades: [],
    });
    expect(inf.total).toEqual({ bs: 4380, usd: 120 });
    expect(inf.porKind.INSUMOS).toEqual({ bs: 3650, usd: 100 });
    expect(inf.porCategoria).toEqual([
      { category: 'Bebidas', total: { bs: 3650, usd: 100 }, cantidad: 1 },
      { category: 'Transporte', total: { bs: 730, usd: 20 }, cantidad: 2 },
    ]);
    expect(inf.porSocio.map((s) => s.socio)).toEqual(['Jonathan', 'Daisy']);
  });

  it('agrupa por pagar por proveedor y reembolsos por socio', () => {
    const inf = armarInforme({
      semana,
      gastos: [],
      comprasWeb: [],
      novedades: [],
      porPagar: [
        gasto({
          _id: 'p1',
          paymentStatus: 'CREDIT',
          fundsSource: undefined,
          supplierName: 'Polar',
          amountUsd: 50,
          amountBs: 1825,
        }),
        gasto({
          _id: 'p2',
          paymentStatus: 'CREDIT',
          fundsSource: undefined,
          supplierName: 'Polar',
          amountUsd: 25,
          amountBs: 912.5,
        }),
        gasto({
          _id: 'p3',
          paymentStatus: 'CREDIT',
          fundsSource: undefined,
          amountUsd: 1,
          amountBs: 36.5,
        }),
      ],
      reembolsos: [
        gasto({
          _id: 'r1',
          fundsSource: 'PROPIOS',
          paidBy: 'Daisy',
          amountUsd: 10,
          amountBs: 365,
        }),
      ],
    });
    expect(inf.porPagar).toEqual([
      expect.objectContaining({
        supplierName: 'Polar',
        total: { bs: 2737.5, usd: 75 },
      }),
      expect.objectContaining({
        supplierName: '(sin proveedor)',
        total: { bs: 36.5, usd: 1 },
      }),
    ]);
    expect(inf.reembolsos[0]).toEqual(
      expect.objectContaining({ socio: 'Daisy', total: { bs: 365, usd: 10 } }),
    );
  });
});

describe('formatearInformeTelegram', () => {
  it('arma un solo mensaje con todas las secciones y sin HTML roto', () => {
    const inf = armarInforme({
      semana,
      gastos: [
        gasto({ description: 'Taxi <hielo> & mas', category: 'Transporte' }),
      ],
      porPagar: [
        gasto({
          _id: 'p',
          paymentStatus: 'CREDIT',
          fundsSource: undefined,
          supplierName: 'Polar',
        }),
      ],
      reembolsos: [
        gasto({ _id: 'r', fundsSource: 'PROPIOS', paidBy: 'Daisy' }),
      ],
      comprasWeb: [
        {
          purchaseId: 'w',
          placeName: 'Makro',
          date: new Date('2026-09-03T12:00:00.000Z'),
          total: 12,
        },
      ],
      novedades: [
        {
          _id: 'n',
          text: 'Se daño la nevera',
          socio: 'Orlando',
          date: new Date(),
          weekStart: semana.desde,
        },
      ],
    });
    const partes = formatearInformeTelegram(inf, OPERACION_DEFAULT);
    expect(partes).toHaveLength(1);
    const t = partes[0];
    expect(t).toContain('Semana de Orlando');
    expect(t).toContain('01/09');
    expect(t).toContain('Taxi &lt;hielo&gt; &amp; mas');
    expect(t).toContain('Por pagar');
    expect(t).toContain('Reembolsos');
    expect(t).toContain('Makro');
    expect(t).toContain('Se daño la nevera');
  });

  it('parte en varios mensajes cuando se pasa de 3900 caracteres', () => {
    const muchos = Array.from({ length: 120 }, (_, i) =>
      gasto({
        _id: String(i),
        description: `Gasto numero ${i} con una descripcion larga para llenar`,
      }),
    );
    const partes = formatearInformeTelegram(
      armarInforme({
        semana,
        gastos: muchos,
        porPagar: [],
        reembolsos: [],
        comprasWeb: [],
        novedades: [],
      }),
      OPERACION_DEFAULT,
    );
    expect(partes.length).toBeGreaterThan(1);
    for (const p of partes) expect(p.length).toBeLessThanOrEqual(3900);
  });

  it('una descripcion mas larga que el limite se trocea sin generar partes vacias', () => {
    const inf = armarInforme({
      semana,
      gastos: [gasto({ description: 'D'.repeat(5000) })],
      porPagar: [],
      reembolsos: [],
      comprasWeb: [],
      novedades: [],
    });
    const partes = formatearInformeTelegram(inf, OPERACION_DEFAULT);
    expect(partes.length).toBeGreaterThan(0);
    for (const p of partes) {
      expect(p.length).toBeGreaterThan(0);
      expect(p.length).toBeLessThanOrEqual(3900);
    }
  });

  it('si el primer bloque ya viene oversized no se genera una parte vacia', () => {
    const semanaConSocioLargo = { ...semana, socio: 'X'.repeat(5000) };
    const inf = armarInforme({
      semana: semanaConSocioLargo,
      gastos: [],
      porPagar: [],
      reembolsos: [],
      comprasWeb: [],
      novedades: [],
    });
    const partes = formatearInformeTelegram(inf, OPERACION_DEFAULT);
    expect(partes.every((p) => p.length > 0)).toBe(true);
    for (const p of partes) expect(p.length).toBeLessThanOrEqual(3900);
  });
});

describe('formatearGastoTelegram', () => {
  it('dice quien, que, cuanto en ambas monedas, fondos y forma de pago', () => {
    const t = formatearGastoTelegram(
      gasto({
        kind: 'INSUMOS',
        supplierName: 'Viveluso',
        category: 'Insumos de cocina',
        amountBs: 3650,
        amountUsd: 100,
        fundsSource: 'PROPIOS',
        paidBy: 'Jonathan',
      }),
      [{ productName: 'Harina PAN', qty: 34500, baseUnit: 'GR' }],
    );
    expect(t).toContain('Jonathan');
    expect(t).toContain('Viveluso');
    expect(t).toContain('Bs 3.650,00');
    expect(t).toContain('$ 100,00');
    expect(t).toContain('Propios');
    expect(t).toContain('Contado');
    expect(t).toContain('Harina PAN: 34,5 kg');
  });

  it('un credito se marca como tal', () => {
    expect(
      formatearGastoTelegram(
        gasto({ paymentStatus: 'CREDIT', fundsSource: undefined }),
        OPERACION_DEFAULT,
      ),
    ).toContain('CRÉDITO');
  });

  it('escapa el nombre de quien pago con fondos propios (paidBy no es HTML de confianza)', () => {
    const t = formatearGastoTelegram(
      gasto({ fundsSource: 'PROPIOS', paidBy: 'A&B <x>' }),
      OPERACION_DEFAULT,
    );
    expect(t).toContain('A&amp;B &lt;x&gt;');
    expect(t).not.toContain('A&B <x>');
  });
});

describe('escapeHtml', () => {
  it('escapa lo que Telegram HTML no admite', () => {
    expect(escapeHtml('<b> & "x"')).toBe('&lt;b&gt; &amp; "x"');
  });
});

describe('armarInforme · contado contra credito', () => {
  const base = {
    semana,
    porPagar: [],
    reembolsos: [],
    comprasWeb: [],
    novedades: [],
  };

  it('parte el total segun como se pago, y las dos partes suman el total', () => {
    const inf = armarInforme({
      ...base,
      gastos: [
        gasto({
          _id: 'a',
          amountUsd: 100,
          amountBs: 85000,
          paymentStatus: 'PAID',
        }),
        gasto({
          _id: 'b',
          amountUsd: 30,
          amountBs: 25500,
          paymentStatus: 'CREDIT',
        }),
      ],
    });

    expect(inf.contado.usd).toBe(100);
    expect(inf.credito.usd).toBe(30);
    expect(inf.total.usd).toBe(130);
    expect(inf.contado.bs + inf.credito.bs).toBe(inf.total.bs);
  });

  it('lo que la caja descuenta es el contado, nunca el credito: esa plata no salio', () => {
    const inf = armarInforme({
      ...base,
      gastos: [
        gasto({ _id: 'a', amountUsd: 100, paymentStatus: 'PAID' }),
        gasto({ _id: 'b', amountUsd: 30, paymentStatus: 'CREDIT' }),
      ],
      cobros: [
        { clave: 'punto', etiqueta: 'Punto de Venta', bruto: 500, propina: 0 },
      ],
      nomina: {
        dias: 0,
        comisiones: 0,
        propinas: 0,
        bonos: 0,
        descuentos: 0,
        neto: 0,
        pagos: 0,
        porTrabajador: [],
      },
    });

    expect(inf.caja?.gastosPagados).toBe(100);
    expect(inf.caja?.gastosPagados).toBe(inf.contado.usd);
  });

  it('sin creditos el contado es el total entero', () => {
    const inf = armarInforme({ ...base, gastos: [gasto({ amountUsd: 42 })] });

    expect(inf.credito.usd).toBe(0);
    expect(inf.contado.usd).toBe(inf.total.usd);
  });

  it('pasa el saldo inicial a la caja', () => {
    const inf = armarInforme({
      ...base,
      gastos: [gasto({ amountUsd: 100, paymentStatus: 'PAID' })],
      cobros: [
        { clave: 'punto', etiqueta: 'Punto de Venta', bruto: 500, propina: 0 },
      ],
      nomina: {
        dias: 0,
        comisiones: 0,
        propinas: 0,
        bonos: 0,
        descuentos: 0,
        neto: 0,
        pagos: 0,
        porTrabajador: [],
      },
      saldoInicial: 533,
    });

    expect(inf.caja?.saldoInicial).toBe(533);
    expect(inf.caja?.quedaTotal).toBe(933);
  });

  it('la cabecera de Telegram dice cual es contado y cual credito', () => {
    const inf = armarInforme({
      ...base,
      gastos: [
        gasto({ _id: 'a', amountUsd: 100, paymentStatus: 'PAID' }),
        gasto({ _id: 'b', amountUsd: 30, paymentStatus: 'CREDIT' }),
      ],
    });
    const texto = formatearInformeTelegram(inf, OPERACION_DEFAULT).join('\n');

    expect(texto).toContain('Contado');
    expect(texto).toContain('A crédito');
  });

  it('el saldo inicial aparece en el texto solo si se cargo', () => {
    const conCaja = (saldoInicial?: number) =>
      formatearInformeTelegram(
        armarInforme({
          ...base,
          gastos: [gasto({ amountUsd: 100 })],
          cobros: [
            {
              clave: 'punto',
              etiqueta: 'Punto de Venta',
              bruto: 500,
              propina: 0,
            },
          ],
          nomina: {
            dias: 0,
            comisiones: 0,
            propinas: 0,
            bonos: 0,
            descuentos: 0,
            neto: 0,
            pagos: 0,
            porTrabajador: [],
          },
          saldoInicial,
        }),
        OPERACION_DEFAULT,
      ).join('\n');

    expect(conCaja(533)).toContain('Saldo inicial');
    expect(conCaja()).not.toContain('Saldo inicial');
  });
});
