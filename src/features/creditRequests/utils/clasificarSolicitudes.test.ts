import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { OrderWithCreditRequest } from '@odin6/types';
import {
  agruparPorCliente,
  diasDeAntiguedad,
  esPorDecidir,
  estadoDeCobro,
  fechaDeSolicitud,
} from './clasificarSolicitudes.ts';

const solicitud = (
  extra: Partial<OrderWithCreditRequest>,
): OrderWithCreditRequest => ({
  id: 'o1',
  customerId: 'c1',
  customerName: 'Shania Abreu',
  waiterId: 'w1',
  waiterName: 'Abril',
  items: [],
  total: 8.05,
  createdAt: '2026-08-29T20:00:00.000Z',
  creditRequest: {
    status: 'REQUESTED',
    requestedBy: 'w1',
    requestedAt: '2026-08-30T20:00:00.000Z',
  },
  ...extra,
});

describe('estadoDeCobro', () => {
  test('pagada por completo: no hay nada que autorizar', () => {
    assert.deepEqual(estadoDeCobro(solicitud({ paymentStatus: 'paid' })), {
      tipo: 'cobrada',
      pagado: 8.05,
      falta: 0,
    });
  });

  test('pagada aunque la orden no traiga paidAmount (ordenes viejas)', () => {
    assert.equal(
      estadoDeCobro(solicitud({ paymentStatus: 'paid', paidAmount: null }))
        .tipo,
      'cobrada',
    );
  });

  test('lo pagado cubre el total aunque el estado diga otra cosa', () => {
    assert.equal(
      estadoDeCobro(solicitud({ paymentStatus: 'partial', paidAmount: 8.05 }))
        .tipo,
      'cobrada',
    );
  });

  test('pagada en parte: dice cuanto falta', () => {
    assert.deepEqual(
      estadoDeCobro(solicitud({ paymentStatus: 'partial', paidAmount: 6.59 })),
      { tipo: 'parcial', pagado: 6.59, falta: 1.46 },
    );
  });

  test('sin cobrar', () => {
    assert.deepEqual(
      estadoDeCobro(solicitud({ paymentStatus: 'pending', paidAmount: 0 })),
      { tipo: 'sinCobrar', pagado: 0, falta: 8.05 },
    );
  });

  test('una orden en $0 no tiene nada que fiar', () => {
    assert.equal(
      estadoDeCobro(solicitud({ total: 0, paymentStatus: 'paid' })).tipo,
      'enCero',
    );
  });
});

describe('fecha y antiguedad', () => {
  test('la fecha es la de la solicitud, no la de la orden', () => {
    assert.equal(
      fechaDeSolicitud(solicitud({})).toISOString(),
      '2026-08-30T20:00:00.000Z',
    );
  });

  test('sin fecha de solicitud cae a la de la orden', () => {
    const s = solicitud({});
    s.creditRequest = { ...s.creditRequest, requestedAt: '' };
    assert.equal(fechaDeSolicitud(s).toISOString(), '2026-08-29T20:00:00.000Z');
  });

  test('cuenta dias de calendario', () => {
    assert.equal(
      diasDeAntiguedad(
        new Date('2026-09-25T23:00:00'),
        new Date('2026-09-26T08:00:00'),
      ),
      1,
    );
    assert.equal(
      diasDeAntiguedad(
        new Date('2026-09-26T01:00:00'),
        new Date('2026-09-26T23:00:00'),
      ),
      0,
    );
  });
});

describe('agruparPorCliente', () => {
  const ahora = new Date('2026-09-26T12:00:00Z');
  const lista = [
    solicitud({
      id: 'a',
      customerId: 'c1',
      paymentStatus: 'paid',
      creditRequest: {
        status: 'REQUESTED',
        requestedBy: 'w',
        requestedAt: '2026-07-20T16:00:00Z',
      },
    }),
    solicitud({
      id: 'b',
      customerId: 'c2',
      customerName: 'Luis Castellanos',
      total: 7.2,
      paymentStatus: 'pending',
      creditRequest: {
        status: 'REQUESTED',
        requestedBy: 'w',
        requestedAt: '2026-09-09T00:00:00Z',
      },
    }),
    solicitud({
      id: 'c',
      customerId: 'c1',
      total: 3.85,
      paymentStatus: 'pending',
      creditRequest: {
        status: 'REQUESTED',
        requestedBy: 'w',
        requestedAt: '2026-09-08T00:00:00Z',
      },
    }),
  ];

  test('junta las solicitudes del mismo cliente y suma lo que falta', () => {
    const grupos = agruparPorCliente(lista, ahora);
    const shania = grupos.find((g) => g.clave === 'c1');
    assert.ok(shania);
    assert.deepEqual(
      shania.filas.map((f) => f.solicitud.id),
      ['c', 'a'],
      'dentro del grupo, la mas reciente primero',
    );
    assert.equal(shania.porCobrar, 3.85, 'lo ya cobrado no suma');
    assert.equal(shania.cobradas, 1);
    assert.equal(shania.diasMasVieja, 68);
  });

  test('primero los grupos con algo por decidir, luego los ya cobrados', () => {
    const soloCobrada = agruparPorCliente(
      [
        solicitud({ id: 'x', customerId: 'c9', paymentStatus: 'paid' }),
        solicitud({ id: 'y', customerId: 'c8', paymentStatus: 'pending' }),
      ],
      ahora,
    );
    assert.deepEqual(
      soloCobrada.map((g) => g.clave),
      ['c8', 'c9'],
    );
  });

  test('sin customerId agrupa por nombre', () => {
    const grupos = agruparPorCliente(
      [
        solicitud({ id: 'p', customerId: '', customerName: 'Abby Cabeza' }),
        solicitud({ id: 'q', customerId: '', customerName: 'Abby Cabeza' }),
      ],
      ahora,
    );
    assert.equal(grupos.length, 1);
  });
});

describe('esPorDecidir', () => {
  test('solo lo sin cobrar o a medio cobrar pide decision', () => {
    assert.equal(esPorDecidir(solicitud({ paymentStatus: 'pending' })), true);
    assert.equal(
      esPorDecidir(solicitud({ paymentStatus: 'partial', paidAmount: 1 })),
      true,
    );
    assert.equal(esPorDecidir(solicitud({ paymentStatus: 'paid' })), false);
    assert.equal(esPorDecidir(solicitud({ total: 0 })), false);
  });
});
