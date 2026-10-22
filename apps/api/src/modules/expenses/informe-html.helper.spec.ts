import { OPERACION_DEFAULT } from '@odin6/types';
import { formatearInformeHtml } from './informe-html.helper';
import { InformeSemanal } from './expenses-report.helper';
import { NominaSemana } from './caja-semana.helper';

const nomina: NominaSemana = {
  dias: 480,
  comisiones: 151.19,
  propinas: 54.2,
  bonos: 24.7,
  descuentos: 56.83,
  neto: 163.91,
  pagos: 3,
  porTrabajador: [
    {
      nombre: 'NOHELIA MATILDE SOSA FLORES',
      cargo: 'COCINERA PRINCIPAL',
      neto: 90.02,
      pagos: 1,
      reciboUrl: 'https://api.ejemplo.com/uploads/payroll-proofs/abc/1.png',
    },
    { nombre: 'Mayer', cargo: 'MESONERO', neto: 73.89, pagos: 2 },
    { nombre: 'Sin nombre', neto: 0, pagos: 1, reciboUrl: 'https://x/2.png' },
  ],
};

const base: InformeSemanal = {
  semana: {
    desde: new Date('2026-09-15T10:00:00.000Z'),
    hasta: new Date('2026-09-22T10:00:00.000Z'),
    socio: 'Jonathan',
    estimado: true,
  },
  total: { bs: 0, usd: 0 },
  contado: { bs: 0, usd: 0 },
  credito: { bs: 0, usd: 0 },
  porKind: { INSUMOS: { bs: 0, usd: 0 }, GENERAL: { bs: 0, usd: 0 } },
  porCategoria: [],
  porSocio: [],
  gastos: [],
  porPagar: [],
  reembolsos: [],
  comprasWebSinOrigen: [],
  novedades: [],
  caja: {
    entroBanco: 1954.91,
    entroEfectivo: 59.1,
    entroTotal: 2014.01,
    propina: 36.65,
    metodos: [
      {
        clave: 'punto',
        etiqueta: 'Punto de Venta',
        bruto: 1069.47,
        propina: 20,
      },
      {
        clave: 'efectivo',
        etiqueta: 'Efectivo',
        bruto: 59.1,
        propina: 0,
        detalle: [
          { etiqueta: 'Divisa', monto: 56 },
          { etiqueta: 'Bolívares', monto: 3.1 },
        ],
      },
    ],
    gastosPagados: 768.15,
    nomina,
    quedaTotal: 592.61,
    quedaBanco: 533.51,
    quedaEfectivo: 59.1,
  },
};

describe('formatearInformeHtml', () => {
  it('el encabezado termina el lunes, no el martes de la jornada siguiente', () => {
    // `hasta` es el arranque del martes 6am; el ultimo dia del negocio es el 21.
    expect(formatearInformeHtml(base, OPERACION_DEFAULT)).toContain(
      '15/09/2026 → 21/09/2026',
    );
  });

  it('el numero grande es el total que entro, el mismo de la tarjeta del panel', () => {
    const html = formatearInformeHtml(base, OPERACION_DEFAULT);

    expect(html).toMatch(/class="grande">\s*\$ ?2\.014,01/);
  });

  it('el cierre reparte entre banco y gaveta', () => {
    const html = formatearInformeHtml(base, OPERACION_DEFAULT);

    expect(html).toContain('en el banco');
    expect(html).toContain('en la gaveta, en efectivo');
  });

  it('cada trabajador sale con su total y el enlace a su recibo', () => {
    const html = formatearInformeHtml(base, OPERACION_DEFAULT);

    expect(html).toContain('NOHELIA MATILDE SOSA FLORES');
    expect(html).toContain(
      '<a href="https://api.ejemplo.com/uploads/payroll-proofs/abc/1.png">ver recibo</a>',
    );
  });

  it('no abre el pago en sueldo, comision ni propina: solo el total', () => {
    const tabla = formatearInformeHtml(base, OPERACION_DEFAULT)
      .split('Pagado a cada trabajador')[1]
      .split('</section>')[0];

    expect(tabla).not.toContain('Comisiones');
    expect(tabla).not.toContain('Propinas');
    expect(tabla).toContain('Total pagado');
  });

  it('quien no tiene comprobante se dice, no se deja el hueco', () => {
    const html = formatearInformeHtml(base, OPERACION_DEFAULT);

    expect(html).toContain('sin recibo');
  });

  it('el total de la tabla es la suma de las filas', () => {
    const html = formatearInformeHtml(base, OPERACION_DEFAULT);

    // 90,02 + 73,89 + 0
    expect(html).toMatch(/sumatoria[\s\S]*?163,91/);
  });

  it('un informe sin caja (el resumen del dia) no revienta ni inventa secciones', () => {
    const html = formatearInformeHtml(
      { ...base, caja: undefined },
      OPERACION_DEFAULT,
    );

    expect(html).toContain('Informe de gastos');
    expect(html).not.toContain('Pagado a cada trabajador');
    expect(html).not.toContain('Entró en caja');
  });

  it('escapa lo que viene del usuario: un nombre con < no rompe la pagina', () => {
    const html = formatearInformeHtml(
      {
        ...base,
        caja: {
          ...base.caja!,
          nomina: {
            ...nomina,
            porTrabajador: [
              { nombre: '<script>alert(1)</script>', neto: 1, pagos: 1 },
            ],
          },
        },
      },
      OPERACION_DEFAULT,
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('formatearInformeHtml · saldo inicial y forma de pago', () => {
  const conSaldo = (saldoInicial?: number): string =>
    formatearInformeHtml(
      { ...base, caja: { ...base.caja!, saldoInicial } },
      OPERACION_DEFAULT,
    );

  it('imprime el saldo inicial cuando se cargo', () => {
    expect(conSaldo(533)).toContain('Saldo inicial en el banco');
  });

  it('lo omite cuando nadie lo cargo, en vez de imprimir un cero falso', () => {
    expect(conSaldo()).not.toContain('Saldo inicial');
  });

  it('aclara que el numero grande no incluye el saldo, para que nadie lo sume dos veces', () => {
    expect(conSaldo(533)).toContain('sin contar los');
  });

  it('separa el contado del credito en los gastos de la semana', () => {
    const html = formatearInformeHtml(
      {
        ...base,
        total: { bs: 110500, usd: 130 },
        contado: { bs: 85000, usd: 100 },
        credito: { bs: 25500, usd: 30 },
      },
      OPERACION_DEFAULT,
    );

    expect(html).toContain('Contado');
    expect(html).toContain('A crédito');
    expect(html).toContain('salió del banco');
    expect(html).toContain('queda debiendo');
  });
});
