import {
  computeCustomerDebt,
  resolveParentId,
  parentIdsOf,
} from './customer-debt';

const VIVA = [{ id: 'cons-1', status: 'pending' }];
const ANULADA = [{ id: 'cons-1', status: 'cancelled' }];

describe('resolveParentId', () => {
  it('acepta el id como texto', () => {
    expect(resolveParentId('cons-1')).toBe('cons-1');
  });

  it('saca el id anidado del formato viejo (documento completo)', () => {
    // Datos feb-may 2026: mergedIntoId guardo el documento entero.
    expect(
      resolveParentId({ invoiceNumber: 'UNI-X', amount: 49.22, id: 'cons-1' }),
    ).toBe('cons-1');
  });

  it('tambien resuelve si el anidado viene como _id', () => {
    expect(resolveParentId({ _id: 'cons-9' })).toBe('cons-9');
  });

  it('devuelve null cuando no hay nada util', () => {
    expect(resolveParentId(null)).toBeNull();
    expect(resolveParentId('')).toBeNull();
    expect(resolveParentId({ foo: 'bar' })).toBeNull();
  });
});

describe('computeCustomerDebt', () => {
  it('suma el saldo de las cuentas pendientes', () => {
    const d = computeCustomerDebt([
      { amount: 10, paidAmount: 0, status: 'pending' },
      { amount: 5, paidAmount: 0, status: 'pending' },
    ]);
    expect(d.total).toBe(15);
    expect(d.count).toBe(2);
  });

  it('resta lo ya abonado, no cuenta el total', () => {
    // Caso real: CONS-20260519-0017, $96.39 con $80.24 abonados.
    const d = computeCustomerDebt([
      { amount: 96.39, paidAmount: 80.24, status: 'partially_paid' },
    ]);
    expect(d.total).toBe(16.15);
  });

  it('ignora saldadas y anuladas', () => {
    const d = computeCustomerDebt([
      { amount: 50, paidAmount: 50, status: 'paid' },
      { amount: 30, paidAmount: 0, status: 'cancelled' },
      { amount: 20, paidAmount: 0, status: 'pending' },
    ]);
    expect(d.total).toBe(20);
  });

  it('NO cuenta las hijas de una consolidada VIVA: seria deuda duplicada', () => {
    const d = computeCustomerDebt(
      [
        { amount: 100, paidAmount: 0, status: 'pending' },
        {
          amount: 60,
          status: 'pending',
          isMerged: true,
          mergedIntoId: 'cons-1',
        },
        {
          amount: 40,
          status: 'pending',
          isMerged: true,
          mergedIntoId: 'cons-1',
        },
      ],
      VIVA,
    );
    expect(d.total).toBe(100);
    expect(d.orphanCount).toBe(0);
  });

  it('SI cuenta las hijas si la consolidada fue ANULADA', () => {
    // El fallo que costo $656 en produccion: la madre se anula y la deuda de
    // las hijas se hacia invisible aunque su orden siguiera sin pagar.
    const d = computeCustomerDebt(
      [
        {
          amount: 60,
          status: 'pending',
          isMerged: true,
          mergedIntoId: 'cons-1',
        },
        {
          amount: 40,
          status: 'pending',
          isMerged: true,
          mergedIntoId: 'cons-1',
        },
      ],
      ANULADA,
    );
    expect(d.total).toBe(100);
    expect(d.orphanCount).toBe(2);
  });

  it('SI cuenta las hijas si la consolidada ya no existe', () => {
    const d = computeCustomerDebt(
      [
        {
          amount: 25,
          status: 'pending',
          isMerged: true,
          mergedIntoId: 'se-borro',
        },
      ],
      [],
    );
    expect(d.total).toBe(25);
    expect(d.orphanCount).toBe(1);
  });

  it('resuelve la madre aunque mergedIntoId traiga el documento viejo', () => {
    const d = computeCustomerDebt(
      [
        {
          amount: 30,
          status: 'pending',
          isMerged: true,
          mergedIntoId: { invoiceNumber: 'UNI-X', id: 'cons-1' },
        },
      ],
      VIVA,
    );
    // Madre viva: no se cuenta, pese al formato raro.
    expect(d.total).toBe(0);
  });

  it('una consolidada con abono parcial aporta solo lo que falta', () => {
    const d = computeCustomerDebt(
      [
        { amount: 100, paidAmount: 75, status: 'partially_paid' },
        {
          amount: 60,
          status: 'pending',
          isMerged: true,
          mergedIntoId: 'cons-1',
        },
      ],
      VIVA,
    );
    expect(d.total).toBe(25);
  });

  it('no genera deuda fantasma por centavos de redondeo', () => {
    const d = computeCustomerDebt([
      { amount: 10, paidAmount: 9.999, status: 'pending' },
      { amount: 10, paidAmount: 10.5, status: 'pending' },
    ]);
    expect(d).toEqual({ count: 0, total: 0, orphanCount: 0 });
  });

  it('sin cuentas devuelve cero', () => {
    expect(computeCustomerDebt([])).toEqual({
      count: 0,
      total: 0,
      orphanCount: 0,
    });
  });
});

describe('parentIdsOf', () => {
  it('junta los ids a consultar, sin repetir y soportando el formato viejo', () => {
    expect(
      parentIdsOf([
        { isMerged: true, mergedIntoId: 'a' },
        { isMerged: true, mergedIntoId: 'a' },
        { isMerged: true, mergedIntoId: { id: 'b' } },
        { isMerged: false, mergedIntoId: 'c' },
        { status: 'pending' },
      ]),
    ).toEqual(['a', 'b']);
  });
});
