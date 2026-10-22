import {
  pipelineDeResumenDeCaja,
  armarResumenDeCaja,
  FilaPorMetodo,
} from './resumen-de-caja.util';

const DESDE = new Date('2026-09-22T16:00:00.000Z');
const HASTA = new Date('2026-09-23T04:00:00.000Z');

function fila(parcial: Partial<FilaPorMetodo>): FilaPorMetodo {
  return {
    method: 'CASH_USD',
    count: 1,
    amount: 10,
    ordenes: ['o1'],
    ...parcial,
  };
}

describe('pipelineDeResumenDeCaja', () => {
  it('acota por la ventana de la sesion, con el final EXCLUSIVO', () => {
    const [match] = pipelineDeResumenDeCaja(DESDE, HASTA) as Array<{
      $match: { createdAt: { $gte: Date; $lt: Date } };
    }>;
    expect(match.$match.createdAt.$gte).toBe(DESDE);
    // $lt y no $lte: un pago que entra en el milisegundo exacto del cierre no
    // puede contarse en la sesion que cierra Y en la que abre.
    expect(match.$match.createdAt.$lt).toBe(HASTA);
    expect(
      (match.$match.createdAt as Record<string, unknown>).$lte,
    ).toBeUndefined();
  });

  it('agrupa leyendo los DOS nombres del campo de metodo', () => {
    // El arreglo del bug: el esquema guarda `method`, la pantalla leia
    // `paymentMethod`. De los 4.336 pagos de produccion, 4.294 tienen `method`
    // y 42 (legacy, marzo-abril 2026) tienen `paymentMethod`. Leer uno solo
    // deja fuera a los otros.
    const etapas = pipelineDeResumenDeCaja(DESDE, HASTA);
    const group = etapas.find((e) => '$group' in e) as {
      $group: { _id: { $ifNull: string[] } };
    };
    expect(group.$group._id).toEqual({
      $ifNull: ['$method', '$paymentMethod'],
    });
  });

  it('junta los ids de orden, que es lo que permite contar ordenes distintas', () => {
    const etapas = pipelineDeResumenDeCaja(DESDE, HASTA);
    const group = etapas.find((e) => '$group' in e) as {
      $group: { ordenes: unknown };
    };
    expect(group.$group.ordenes).toEqual({ $addToSet: '$orderId' });
  });
});

describe('armarResumenDeCaja', () => {
  it('suma el total en dolares', () => {
    const r = armarResumenDeCaja(
      [
        fila({ method: 'CASH_USD', amount: 10, ordenes: ['o1'] }),
        fila({ method: 'CARD', amount: 25.5, ordenes: ['o2'] }),
      ],
      DESDE,
      HASTA,
    );
    expect(r.totalAmount).toBe(35.5);
  });

  it('cuenta ordenes DISTINTAS, no la suma de los conteos', () => {
    // Una cuenta pagada mitad en efectivo y mitad por punto son DOS pagos y
    // UNA orden. Sumar los `count` diria 2 ordenes y el arqueo cerraria mal.
    const r = armarResumenDeCaja(
      [
        fila({ method: 'CASH_USD', count: 1, amount: 10, ordenes: ['o1'] }),
        fila({ method: 'CARD', count: 1, amount: 15, ordenes: ['o1'] }),
      ],
      DESDE,
      HASTA,
    );
    expect(r.totalOrders).toBe(1);
    expect(r.totalAmount).toBe(25);
  });

  it('una orden que aparece en tres metodos sigue siendo una', () => {
    const r = armarResumenDeCaja(
      [
        fila({ method: 'CASH_USD', ordenes: ['o1', 'o2'] }),
        fila({ method: 'CARD', ordenes: ['o2', 'o3'] }),
        fila({ method: 'PAGO_MOVIL', ordenes: ['o1', 'o3'] }),
      ],
      DESDE,
      HASTA,
    );
    expect(r.totalOrders).toBe(3);
  });

  it('ordena los metodos por monto, de mayor a menor', () => {
    const r = armarResumenDeCaja(
      [
        fila({ method: 'CASH_USD', amount: 5 }),
        fila({ method: 'CARD', amount: 100 }),
        fila({ method: 'PAGO_MOVIL', amount: 40 }),
      ],
      DESDE,
      HASTA,
    );
    expect(r.byPaymentMethod.map((m) => m.method)).toEqual([
      'CARD',
      'PAGO_MOVIL',
      'CASH_USD',
    ]);
  });

  it('redondea a centavos: el arqueo lo firma una persona', () => {
    // 0.1 + 0.2 en flotante da 0.30000000000000004. Sin redondeo eso termina
    // impreso en el papel que el cajero firma.
    const r = armarResumenDeCaja(
      [
        fila({ amount: 0.1, ordenes: ['o1'] }),
        fila({ amount: 0.2, ordenes: ['o2'] }),
      ],
      DESDE,
      HASTA,
    );
    expect(r.totalAmount).toBe(0.3);
  });

  it('redondea TAMBIEN el monto de cada metodo, no solo el total', () => {
    // Medido en PRE el 22/09/2026: CARD sumaba 9724.970326391925. Este
    // desglose se PERSISTE en la sesion al cerrar, asi que ese ruido quedaba
    // guardado en la base y salia impreso en el arqueo.
    const r = armarResumenDeCaja(
      [fila({ method: 'CARD', amount: 9724.970326391925 })],
      DESDE,
      HASTA,
    );
    expect(r.byPaymentMethod[0].amount).toBe(9724.97);
  });

  it('sin pagos: devuelve ceros, no rompe', () => {
    // Abrir caja y cerrarla sin vender es un caso real (turno que no arranco).
    const r = armarResumenDeCaja([], DESDE, HASTA);
    expect(r).toMatchObject({
      totalOrders: 0,
      totalAmount: 0,
      byPaymentMethod: [],
    });
  });

  it('ignora ordenes vacias o ausentes sin contarlas', () => {
    const r = armarResumenDeCaja(
      [fila({ ordenes: ['o1', '', 'o1'] }), fila({ ordenes: [] })],
      DESDE,
      HASTA,
    );
    expect(r.totalOrders).toBe(1);
  });

  it('devuelve la ventana que sumo, para que la pantalla pueda mostrarla', () => {
    // El cajero tiene que poder ver DESDE cuando se esta sumando. Antes el
    // filtro por `openedAt` ocurria en silencio dentro del telefono.
    const r = armarResumenDeCaja([], DESDE, HASTA);
    expect(r.desde).toBe(DESDE.toISOString());
    expect(r.hasta).toBe(HASTA.toISOString());
  });
});
