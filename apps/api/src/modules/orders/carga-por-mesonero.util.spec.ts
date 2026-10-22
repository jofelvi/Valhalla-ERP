import {
  pipelineDeCargaPorMesonero,
  completarConCeros,
} from './carga-por-mesonero.util';

describe('pipelineDeCargaPorMesonero', () => {
  const desde = new Date('2026-09-21T10:00:00.000Z'); // 06:00 Caracas
  const hasta = new Date('2026-09-22T10:00:00.000Z');

  it('acota por rango con el final EXCLUSIVO', () => {
    // Con $lte, una orden creada exactamente a las 06:00:00.000 caeria en las
    // dos jornadas y se contaria dos veces.
    const match = (pipelineDeCargaPorMesonero(desde, hasta)[0] as { $match: unknown }).$match as {
      createdAt: { $gte: Date; $lt?: Date; $lte?: Date };
    };
    expect(match.createdAt.$gte).toEqual(desde);
    expect(match.createdAt.$lt).toEqual(hasta);
    expect(match.createdAt.$lte).toBeUndefined();
  });

  it('excluye las borradas y las que no tienen mesonero', () => {
    const match = (pipelineDeCargaPorMesonero(desde, hasta)[0] as { $match: unknown }).$match as Record<
      string,
      unknown
    >;
    expect(match.isDeleted).toEqual({ $ne: true });
    // Sin esto el $group devuelve una fila con _id null que no le toca a nadie.
    expect(match.waiterId).toEqual({ $nin: [null, ''] });
  });

  it('agrupa por waiterId y cuenta', () => {
    const p = pipelineDeCargaPorMesonero(desde, hasta);
    expect(p[1]).toEqual({
      $group: { _id: '$waiterId', ordenes: { $sum: 1 } },
    });
    expect(p[2]).toEqual({
      $project: { _id: 0, waiterId: '$_id', ordenes: 1 },
    });
  });
});

describe('completarConCeros', () => {
  it('el mesonero sin ordenes aparece en 0, no desaparece', () => {
    // Es el caso que decide el reparto: si el que arranca el turno no figura,
    // el round-robin no puede elegirlo y le sigue dando mesas al que ya tiene.
    const filas = completarConCeros([{ waiterId: 'a', ordenes: 3 }], [
      'a',
      'b',
    ]);
    expect(filas).toEqual([
      { waiterId: 'a', ordenes: 3 },
      { waiterId: 'b', ordenes: 0 },
    ]);
  });

  it('conserva el orden de la lista de mesoneros', () => {
    const filas = completarConCeros(
      [
        { waiterId: 'b', ordenes: 1 },
        { waiterId: 'a', ordenes: 2 },
      ],
      ['a', 'b', 'c'],
    );
    expect(filas.map((f) => f.waiterId)).toEqual(['a', 'b', 'c']);
    expect(filas.map((f) => f.ordenes)).toEqual([2, 1, 0]);
  });

  it('descarta filas de mesoneros que ya no estan activos', () => {
    const filas = completarConCeros(
      [
        { waiterId: 'viejo', ordenes: 9 },
        { waiterId: 'a', ordenes: 1 },
      ],
      ['a'],
    );
    expect(filas).toEqual([{ waiterId: 'a', ordenes: 1 }]);
  });

  it('sin mesoneros activos devuelve vacio', () => {
    expect(completarConCeros([{ waiterId: 'a', ordenes: 1 }], [])).toEqual([]);
  });
});
