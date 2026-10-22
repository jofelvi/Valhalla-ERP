import { OPERACION_DEFAULT } from '@odin6/types';
import { reportesVencidos } from './scheduler.helper';

const cfg = {
  weeklyReportHourVe: 8,
  weeklyReportMinuteVe: 0,
  dailySummaryHourVe: 23,
};
// El disparo real desde el 29/09/2026: lunes 11:59 pm. Con el diario apagado,
// porque cae en la misma hora y aqui lo que se mide es el semanal.
const tarde = {
  weeklyReportHourVe: 23,
  weeklyReportMinuteVe: 59,
  dailySummaryHourVe: null,
};

describe('reportesVencidos', () => {
  it('lunes 8:00-8:59 VE toca el semanal', () => {
    // lunes 7 sep 2026 08:10 VE = 12:10Z
    expect(
      reportesVencidos(
        new Date('2026-09-07T12:10:00.000Z'),
        cfg,
        OPERACION_DEFAULT,
      ),
    ).toEqual([{ id: 'weekly:2026-09-07', kind: 'weekly' }]);
  });
  it('antes de la hora no lo devuelve', () => {
    // lunes 7:30 VE
    expect(
      reportesVencidos(
        new Date('2026-09-07T11:30:00.000Z'),
        cfg,
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });
  it('pasado el margen de dos horas ya no lo devuelve', () => {
    // lunes 10:30 VE, dos horas y media despues de las 8
    expect(
      reportesVencidos(
        new Date('2026-09-07T14:30:00.000Z'),
        cfg,
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });
  it('martes 8:00 VE no manda semanal', () => {
    expect(
      reportesVencidos(
        new Date('2026-09-08T12:10:00.000Z'),
        cfg,
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });
  it('a las 23 VE toca el diario de ese dia VE', () => {
    // 23:05 VE del 3 sep = 03:05Z del 4 sep
    expect(
      reportesVencidos(
        new Date('2026-09-04T03:05:00.000Z'),
        cfg,
        OPERACION_DEFAULT,
      ),
    ).toEqual([{ id: 'daily:2026-09-03', kind: 'daily' }]);
  });
  it('con diario apagado no lo devuelve', () => {
    expect(
      reportesVencidos(
        new Date('2026-09-04T03:05:00.000Z'),
        { ...cfg, dailySummaryHourVe: null },
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });
});

describe('reportesVencidos · disparo a las 23:59 del lunes', () => {
  it('sale en el primer tick pasadas las 23:59', () => {
    // lunes 28 sep 2026 23:59 VE = 29 sep 03:59Z
    expect(
      reportesVencidos(
        new Date('2026-09-29T03:59:30.000Z'),
        tarde,
        OPERACION_DEFAULT,
      ),
    ).toEqual([{ id: 'weekly:2026-09-28', kind: 'weekly' }]);
  });

  it('el tick que cae ya el martes sigue mandando el informe DEL LUNES', () => {
    // martes 00:30 VE: el tick de 5 minutos cayo del otro lado de la medianoche.
    // Es el mismo id, asi que si ya salio no se repite.
    expect(
      reportesVencidos(
        new Date('2026-09-29T04:30:00.000Z'),
        tarde,
        OPERACION_DEFAULT,
      ),
    ).toEqual([{ id: 'weekly:2026-09-28', kind: 'weekly' }]);
  });

  it('a las 23:50 del lunes todavia no toca', () => {
    expect(
      reportesVencidos(
        new Date('2026-09-29T03:50:00.000Z'),
        tarde,
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });

  it('el martes a las 2:30 de la madrugada ya paso el margen', () => {
    expect(
      reportesVencidos(
        new Date('2026-09-29T06:30:00.000Z'),
        tarde,
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });

  it('el domingo a las 23:59 no manda el semanal: es del lunes', () => {
    // domingo 27 sep 23:59 VE = 28 sep 03:59Z
    expect(
      reportesVencidos(
        new Date('2026-09-28T03:59:30.000Z'),
        tarde,
        OPERACION_DEFAULT,
      ),
    ).toEqual([]);
  });

  it('sin minuto configurado se comporta como antes, en punto', () => {
    const sinMinuto = {
      weeklyReportHourVe: 8,
      dailySummaryHourVe: null,
    } as unknown as typeof cfg;
    expect(
      reportesVencidos(
        new Date('2026-09-07T12:10:00.000Z'),
        sinMinuto,
        OPERACION_DEFAULT,
      ),
    ).toEqual([{ id: 'weekly:2026-09-07', kind: 'weekly' }]);
  });
});
