import { buildOrdersQuery } from './build-orders-query.util';
import { OrderStatusEnum } from '@odin6/types';

describe('buildOrdersQuery', () => {
  it('sin filtros: solo excluye soft-deleted', () => {
    expect(buildOrdersQuery(undefined)).toEqual({ isDeleted: { $ne: true } });
    expect(buildOrdersQuery({})).toEqual({ isDeleted: { $ne: true } });
  });

  it('includeDeleted quita el filtro isDeleted', () => {
    expect(buildOrdersQuery({ includeDeleted: true })).toEqual({});
  });

  it('transferPendingFor arma $and de transferRequest', () => {
    const q = buildOrdersQuery({ transferPendingFor: 'w1' });
    expect(q.$and).toEqual([
      { 'transferRequest.status': 'REQUESTED' },
      { 'transferRequest.toWaiterId': 'w1' },
    ]);
  });

  it('creditRequested pone creditRequest.status', () => {
    const q = buildOrdersQuery({ creditRequested: true });
    expect(q['creditRequest.status']).toBe('REQUESTED');
  });

  it('rango from/to valido arma $or por createdAt/updatedAt', () => {
    const q = buildOrdersQuery({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
    });
    expect(Array.isArray(q.$or)).toBe(true);
    const or = q.$or as Array<Record<string, unknown>>;
    expect(or).toHaveLength(2);
    expect((or[0].createdAt as { $gte: Date }).$gte).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
  });

  it('rango invalido no agrega $or', () => {
    const q = buildOrdersQuery({ from: 'no-fecha', to: 'no-fecha' });
    expect(q.$or).toBeUndefined();
  });

  it('status, paymentStatus, tableId, orderType directos', () => {
    const q = buildOrdersQuery({
      status: 'pending',
      paymentStatus: 'paid',
      tableId: 't1',
      orderType: 'dine_in',
    });
    expect(q.status).toBe('pending');
    expect(q.paymentStatus).toBe('paid');
    expect(q.tableId).toBe('t1');
    expect(q.orderType).toBe('dine_in');
  });

  it('waiterId se aplica cuando NO hay comisionPendiente', () => {
    const q = buildOrdersQuery({ waiterId: 'w1' });
    expect(q.waiterId).toBe('w1');
  });

  it('ids arma $in', () => {
    const q = buildOrdersQuery({ ids: ['a', 'b'] });
    expect(q._id).toEqual({ $in: ['a', 'b'] });
  });

  it('active:true pisa status con los estados activos', () => {
    const q = buildOrdersQuery({ status: 'pending', active: true });
    expect(q.status).toEqual({
      $in: [
        OrderStatusEnum.PENDING,
        OrderStatusEnum.IN_PROGRESS,
        OrderStatusEnum.READY,
      ],
    });
  });

  it('active:false no toca status', () => {
    const q = buildOrdersQuery({ status: 'pending', active: false });
    expect(q.status).toBe('pending');
  });

  it('comisionPendiente sin waiterId: paid + comisionBase/tip + comisionPagada', () => {
    const q = buildOrdersQuery({ comisionPendiente: true });
    expect(q.$and).toEqual([
      { paymentStatus: 'paid' },
      { $or: [{ comisionBase: { $gt: 0 } }, { tipAmount: { $gt: 0 } }] },
      { comisionPagada: { $ne: true } },
    ]);
    // no aplica waiterId plano
    expect(q.waiterId).toBeUndefined();
  });

  it('comisionPendiente con waiterId: rama share-aware y NO waiterId plano', () => {
    const q = buildOrdersQuery({ comisionPendiente: true, waiterId: 'w1' });
    const and = q.$and as Array<Record<string, unknown>>;
    expect(and[0]).toEqual({ paymentStatus: 'paid' });
    expect(and[2].$or).toBeDefined();
    expect(q.waiterId).toBeUndefined();
  });
  describe('rango de fechas: from y to son independientes', () => {
    // El 21/09/2026 se midio en produccion que `?from=2026-09-21` devolvia
    // 1.558.989 bytes —el historico entero— contra los 80.620 de mandar los
    // dos extremos. La condicion era `if (from && to)`: con uno solo no
    // filtraba nada y no avisaba.
    it('solo from: acota por el extremo inferior', () => {
      const q = buildOrdersQuery({ from: '2026-09-21T00:00:00.000Z' });
      const or = q.$or as Array<Record<string, { $gte?: Date; $lte?: Date }>>;
      expect(or).toHaveLength(2);
      expect(or[0].createdAt.$gte).toEqual(new Date('2026-09-21T00:00:00.000Z'));
      expect(or[0].createdAt.$lte).toBeUndefined();
      expect(or[1].updatedAt.$gte).toEqual(new Date('2026-09-21T00:00:00.000Z'));
    });

    it('solo to: acota por el extremo superior', () => {
      const q = buildOrdersQuery({ to: '2026-09-22T00:00:00.000Z' });
      const or = q.$or as Array<Record<string, { $gte?: Date; $lte?: Date }>>;
      expect(or[0].createdAt.$lte).toEqual(new Date('2026-09-22T00:00:00.000Z'));
      expect(or[0].createdAt.$gte).toBeUndefined();
    });

    it('los dos: se conserva el comportamiento de siempre', () => {
      const q = buildOrdersQuery({
        from: '2026-09-21T00:00:00.000Z',
        to: '2026-09-22T00:00:00.000Z',
      });
      const or = q.$or as Array<Record<string, { $gte?: Date; $lte?: Date }>>;
      expect(or[0].createdAt.$gte).toEqual(new Date('2026-09-21T00:00:00.000Z'));
      expect(or[0].createdAt.$lte).toEqual(new Date('2026-09-22T00:00:00.000Z'));
    });

    it('ninguno: no mete $or de fechas', () => {
      const q = buildOrdersQuery({ status: 'pending' });
      expect(q.$or).toBeUndefined();
    });

    it('fecha basura: se ignora, no rompe la consulta', () => {
      const q = buildOrdersQuery({ from: 'no-soy-una-fecha' });
      expect(q.$or).toBeUndefined();
    });
  });

  describe('status y paymentStatus aceptan varios valores', () => {
    // `?paymentStatus=pending,partial` devolvia [] (buscaba la cadena literal),
    // asi que la caja no podia pedir "las pendientes de cobro" —tres estados—
    // y se bajaba las 4.766 ordenes para filtrarlas en el telefono.
    it('varios: $in', () => {
      const q = buildOrdersQuery({ paymentStatus: 'pending,pending_verification,partial' });
      expect(q.paymentStatus).toEqual({
        $in: ['pending', 'pending_verification', 'partial'],
      });
    });

    it('uno solo: sigue siendo el valor plano (no rompe a nadie)', () => {
      expect(buildOrdersQuery({ paymentStatus: 'pending' }).paymentStatus).toBe('pending');
      expect(buildOrdersQuery({ status: 'DELIVERED' }).status).toBe('DELIVERED');
    });

    it('espacios alrededor de las comas', () => {
      const q = buildOrdersQuery({ status: 'PENDING , READY' });
      expect(q.status).toEqual({ $in: ['PENDING', 'READY'] });
    });

    it('comas de mas no meten un vacio en el $in', () => {
      // Un '' dentro del $in no matchea nada y dejaria la consulta muda.
      expect(buildOrdersQuery({ status: 'PENDING,,READY' }).status).toEqual({
        $in: ['PENDING', 'READY'],
      });
      expect(buildOrdersQuery({ status: 'PENDING,' }).status).toBe('PENDING');
    });
  });
});
