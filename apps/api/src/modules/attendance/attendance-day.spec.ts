import { OPERACION_DEFAULT } from '@odin6/types';
import * as dia from './attendance-day';

// Los casos se prueban con la operación por defecto (Caracas, jornada de 6 AM); la zona y la
// hora salen del contrato, no del código de la jornada.
const op = OPERACION_DEFAULT;
const businessDayStart = (now: Date) => dia.businessDayStart(now, op);
const businessDayEnd = (now: Date) => dia.businessDayEnd(now, op);
const businessDayLabel = (now: Date) => dia.businessDayLabel(now, op);
const businessDayRangeForQuery = (fecha: Date, now: Date) =>
  dia.businessDayRangeForQuery(fecha, op, now);

/**
 * Caso real del bug (04/08/2026): el pizzero ficho entrada a las 2:10 PM de
 * Caracas y a las 7:08 PM no pudo marcar salida — "No hay registro de
 * check-in para hoy". El VPS corre en Europe/Berlin, cuya medianoche cae a
 * las 6:00 PM de Caracas, asi que a esa hora el sistema ya creia que era otro
 * dia. Estas pruebas fijan el comportamiento correcto: entrada y salida del
 * mismo turno caen SIEMPRE en la misma jornada.
 */
describe('jornada laboral (hora de Caracas)', () => {
  // Helper: construye una fecha dando la hora de Caracas
  const caracas = (iso: string): Date =>
    new Date(new Date(`${iso}Z`).getTime() + 4 * 60 * 60 * 1000);

  it('entrada de la tarde y salida de la noche caen en la MISMA jornada', () => {
    const entrada = caracas('2026-08-04T14:10:00'); // 2:10 PM
    const salida = caracas('2026-08-04T19:08:00'); // 7:08 PM — antes fallaba
    expect(businessDayStart(entrada).getTime()).toBe(
      businessDayStart(salida).getTime(),
    );
  });

  it('la madrugada pertenece a la jornada del dia anterior', () => {
    const nocheDelViernes = caracas('2026-08-07T22:00:00');
    const madrugadaDelSabado = caracas('2026-08-08T01:30:00');
    expect(businessDayStart(madrugadaDelSabado).getTime()).toBe(
      businessDayStart(nocheDelViernes).getTime(),
    );
    expect(businessDayLabel(madrugadaDelSabado)).toBe('2026-08-07');
  });

  it('a las 6 AM empieza una jornada nueva', () => {
    const antes = caracas('2026-08-04T05:59:00');
    const despues = caracas('2026-08-04T06:01:00');
    expect(businessDayStart(antes).getTime()).not.toBe(
      businessDayStart(despues).getTime(),
    );
    expect(businessDayLabel(despues)).toBe('2026-08-04');
  });

  it('la jornada arranca a las 6 AM de Caracas (10:00 UTC)', () => {
    const start = businessDayStart(caracas('2026-08-04T14:10:00'));
    expect(start.toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });

  it('la jornada dura exactamente 24 horas', () => {
    const now = caracas('2026-08-04T14:10:00');
    expect(
      businessDayEnd(now).getTime() - businessDayStart(now).getTime(),
    ).toBe(24 * 60 * 60 * 1000);
  });

  it('NO depende de la zona del servidor (el bug original)', () => {
    // La medianoche de Berlin son las 6 PM de Caracas: con el codigo viejo,
    // estas dos horas caian en dias distintos. Con la jornada, no.
    const antesDelCorte = caracas('2026-08-04T17:59:00');
    const despuesDelCorte = caracas('2026-08-04T18:01:00');
    expect(businessDayStart(antesDelCorte).getTime()).toBe(
      businessDayStart(despuesDelCorte).getTime(),
    );
  });
});

/**
 * Caso real del bug (05/08/2026): dos mesoneros ficharon entrada a las 12:38 y
 * 12:43 PM de Caracas. Un minuto despues la app les seguia ofreciendo
 * "Registrar Entrada" y el servidor respondia "Ya existe un registro de
 * asistencia para hoy" — atrapados, sin poder marcar salida.
 *
 * La app consulta el dia mandando su MEDIANOCHE local. Como la jornada
 * arranca a las 6 AM, esa medianoche cae en la jornada ANTERIOR: la ventana
 * quedaba [ayer 6am, hoy 6am) y el registro de hoy (fechado 6am en punto)
 * quedaba fuera justo por el borde.
 */
describe('consulta de asistencia por fecha', () => {
  const caracas = (iso: string): Date =>
    new Date(new Date(`${iso}Z`).getTime() + 4 * 60 * 60 * 1000);

  it('la medianoche que manda la app devuelve la jornada de HOY, no la de ayer', () => {
    const medianoche = caracas('2026-08-05T00:00:00');
    const ahora = caracas('2026-08-05T12:44:00'); // hora de la foto del bug
    const { start, end } = businessDayRangeForQuery(medianoche, ahora);

    expect(start.toISOString()).toBe('2026-08-05T10:00:00.000Z'); // 6 AM del 5
    expect(end.toISOString()).toBe('2026-08-06T10:00:00.000Z');
  });

  it('el registro recien creado CAE dentro de la ventana consultada', () => {
    const ahora = caracas('2026-08-05T12:44:00');
    // Asi lo guarda checkIn: businessDayStart(ahora)
    const registro = businessDayStart(ahora);
    const { start, end } = businessDayRangeForQuery(
      caracas('2026-08-05T00:00:00'),
      ahora,
    );

    expect(registro.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(registro.getTime()).toBeLessThan(end.getTime());
  });

  it('en la madrugada devuelve la jornada VIGENTE (la que empezo ayer)', () => {
    // 2 AM del 5: el turno abierto pertenece a la jornada del 4.
    const ahora = caracas('2026-08-05T02:00:00');
    const { start } = businessDayRangeForQuery(
      caracas('2026-08-05T00:00:00'),
      ahora,
    );

    expect(start.toISOString()).toBe('2026-08-04T10:00:00.000Z'); // 6 AM del 4
    expect(start.getTime()).toBe(businessDayStart(ahora).getTime());
  });

  it('una fecha pasada devuelve la jornada que EMPIEZA ese dia', () => {
    const ahora = caracas('2026-08-05T12:44:00');
    const { start, end } = businessDayRangeForQuery(
      caracas('2026-08-01T00:00:00'),
      ahora,
    );

    expect(start.toISOString()).toBe('2026-08-01T10:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-02T10:00:00.000Z');
  });
});
