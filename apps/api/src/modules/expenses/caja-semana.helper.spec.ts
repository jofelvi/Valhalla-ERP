import { armarCaja, CobroPorMetodo, NominaSemana } from './caja-semana.helper';

const metodos: CobroPorMetodo[] = [
  { clave: 'pagoMovil', etiqueta: 'Pago Móvil', bruto: 953.88, propina: 30.1 },
  { clave: 'punto', etiqueta: 'Punto de Venta', bruto: 1105.84, propina: 40.2 },
  { clave: 'efectivo', etiqueta: 'Efectivo', bruto: 90.83, propina: 1.5 },
];

const nomina: NominaSemana = {
  dias: 480,
  comisiones: 151.19,
  propinas: 54.2,
  bonos: 24.7,
  descuentos: 56.83,
  neto: 653.25,
  pagos: 12,
  porTrabajador: [
    {
      nombre: 'NOHELIA MATILDE SOSA FLORES',
      cargo: 'COCINERA',
      neto: 90.02,
      pagos: 1,
      reciboUrl: 'https://api.ejemplo.com/uploads/payroll-proofs/a/1.png',
    },
    { nombre: 'Mayer', cargo: 'MESONERO', neto: 73.89, pagos: 1 },
  ],
};

describe('armarCaja', () => {
  it('el banco es punto de venta + pago movil + transferencia, nunca el efectivo', () => {
    const caja = armarCaja({ metodos, gastosPagados: 713.66, nomina });

    expect(caja.entroBanco).toBe(2059.72);
    expect(caja.entroEfectivo).toBe(90.83);
    expect(caja.entroTotal).toBe(2150.55);
  });

  it('la transferencia va al banco (casi no se usa, pero cuando entra es plata en cuenta)', () => {
    const caja = armarCaja({
      metodos: [
        ...metodos,
        {
          clave: 'transferencia',
          etiqueta: 'Transferencia',
          bruto: 40,
          propina: 0,
        },
      ],
      gastosPagados: 0,
      nomina: { ...nomina, neto: 0 },
    });

    expect(caja.entroBanco).toBe(2099.72);
  });

  it('descuenta del banco los gastos pagados Y la nomina, que no pasa por el libro de egresos', () => {
    const caja = armarCaja({ metodos, gastosPagados: 713.66, nomina });

    // 2059.72 − 713.66 − 653.25
    expect(caja.quedaBanco).toBe(692.81);
  });

  it('el total y el desglose son los mismos que muestra el panel web', () => {
    const caja = armarCaja({ metodos, gastosPagados: 713.66, nomina });

    // La tarjeta "Entró en caja" suma los tres metodos; el informe tiene que
    // dar ese MISMO numero o los socios ven dos cifras para lo mismo.
    expect(caja.entroTotal).toBeCloseTo(
      metodos.reduce((a, m) => a + m.bruto, 0),
      2,
    );
    expect(caja.metodos).toEqual(metodos);
  });

  it('el cierre total reparte entre banco y gaveta sin perder un centavo', () => {
    const caja = armarCaja({ metodos, gastosPagados: 713.66, nomina });

    // 2150,55 que entro − 713,66 de gastos − 653,25 de nomina
    expect(caja.quedaTotal).toBe(783.64);
    expect(caja.quedaBanco + caja.quedaEfectivo).toBeCloseTo(
      caja.quedaTotal,
      2,
    );
  });

  it('al efectivo no se le resta nada: se arquea contra la gaveta', () => {
    const caja = armarCaja({ metodos, gastosPagados: 713.66, nomina });

    expect(caja.quedaEfectivo).toBe(caja.entroEfectivo);
  });

  it('la propina se informa pero no se descuenta: entra por el banco y sale por la nomina', () => {
    const caja = armarCaja({
      metodos,
      gastosPagados: 0,
      nomina: { ...nomina, neto: 0 },
    });

    expect(caja.propina).toBe(71.8);
    expect(caja.quedaBanco).toBe(caja.entroBanco);
  });

  it('el desglose de la nomina cierra contra lo que se transfirio', () => {
    const { dias, comisiones, propinas, bonos, descuentos, neto } = nomina;

    expect(dias + comisiones + propinas + bonos - descuentos).toBeCloseTo(
      neto,
      1,
    );
  });

  it('una semana sin nada no inventa numeros', () => {
    const caja = armarCaja({
      metodos: [],
      gastosPagados: 0,
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

    expect(caja.entroTotal).toBe(0);
    expect(caja.quedaBanco).toBe(0);
    expect(caja.quedaEfectivo).toBe(0);
  });

  it('si se gasto mas de lo que entro el numero queda en rojo, no en cero', () => {
    const caja = armarCaja({
      metodos: [
        { clave: 'punto', etiqueta: 'Punto de Venta', bruto: 100, propina: 0 },
      ],
      gastosPagados: 300,
      nomina: { ...nomina, neto: 0 },
    });

    expect(caja.quedaBanco).toBe(-200);
  });
});

describe('armarCaja · saldo inicial', () => {
  it('sin saldo cargado no inventa un cero: la semana arranca donde arrancaba', () => {
    const caja = armarCaja({ metodos, gastosPagados: 713.66, nomina });

    expect(caja.saldoInicial).toBeUndefined();
    // 2150.55 − 713.66 − 653.25
    expect(caja.quedaTotal).toBe(783.64);
  });

  it('el saldo inicial se suma al cierre: es plata que ya estaba', () => {
    const caja = armarCaja({
      metodos,
      gastosPagados: 713.66,
      nomina,
      saldoInicial: 533,
    });

    expect(caja.saldoInicial).toBe(533);
    expect(caja.quedaTotal).toBe(1316.64);
  });

  it('entra por el banco, no por la gaveta: el efectivo se arquea contra si mismo', () => {
    const caja = armarCaja({
      metodos,
      gastosPagados: 713.66,
      nomina,
      saldoInicial: 533,
    });

    // 533 + 2059.72 − 713.66 − 653.25
    expect(caja.quedaBanco).toBe(1225.81);
    expect(caja.quedaEfectivo).toBe(90.83);
    expect(caja.quedaBanco + caja.quedaEfectivo).toBeCloseTo(
      caja.quedaTotal,
      2,
    );
  });

  it('no toca lo que entro: el saldo inicial no es un cobro de la semana', () => {
    const caja = armarCaja({
      metodos,
      gastosPagados: 0,
      nomina: { ...nomina, neto: 0 },
      saldoInicial: 533,
    });

    expect(caja.entroTotal).toBe(2150.55);
    expect(caja.entroBanco).toBe(2059.72);
  });

  it('un saldo en cero es un dato, no un dato faltante, y se muestra', () => {
    const caja = armarCaja({
      metodos,
      gastosPagados: 713.66,
      nomina,
      saldoInicial: 0,
    });

    expect(caja.saldoInicial).toBe(0);
    expect(caja.quedaTotal).toBe(783.64);
  });
});
