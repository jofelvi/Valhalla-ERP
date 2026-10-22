import { OPERACION_DEFAULT } from '@odin6/types';
import { inicioDeJornadaDe } from '../../../common/operacion/operacion.util';
import * as rango from './panel-rango.util';
import { IntervaloPanel, esIntervaloValido } from './panel-rango.util';

// Se prueba con la operación por defecto (Caracas, jornada de 6 AM).
const op = OPERACION_DEFAULT;
const inicioDeJornada = (instante: Date) => inicioDeJornadaDe(instante, op);
const inicioDeSemana = (instante: Date) => rango.inicioDeSemana(instante, op);
const inicioDeMes = (instante: Date, desplazamiento?: number) =>
  rango.inicioDeMes(instante, op, desplazamiento);
const etiquetaDeJornada = (instante: Date) =>
  rango.etiquetaDeJornada(instante, op);
const rangoDe = (intervalo: IntervaloPanel, ahora: Date) =>
  rango.rangoDe(intervalo, op, ahora);

/** Instante UTC a partir de una hora de pared de Caracas (UTC-4). */
const caracas = (texto: string): Date =>
  new Date(`${texto.replace(' ', 'T')}:00.000-04:00`);

/** Hora de pared de Caracas de un instante, para leer los asserts. */
const comoCaracas = (d: Date): string =>
  new Date(d.getTime() - 4 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');

describe('panel-rango.util', () => {
  describe('inicioDeJornada', () => {
    it('a media tarde, la jornada arranco hoy a las 6 AM', () => {
      expect(comoCaracas(inicioDeJornada(caracas('2026-09-18 15:30')))).toBe(
        '2026-09-18 06:00',
      );
    });

    it('a las 2 AM todavia corre la jornada de AYER', () => {
      // El bug que esto evita: cortar a medianoche le regala al dia siguiente
      // la mitad de la venta de la noche.
      expect(comoCaracas(inicioDeJornada(caracas('2026-09-19 02:00')))).toBe(
        '2026-09-18 06:00',
      );
    });

    it('a las 6:00 en punto ya es la jornada nueva', () => {
      expect(comoCaracas(inicioDeJornada(caracas('2026-09-19 06:00')))).toBe(
        '2026-09-19 06:00',
      );
    });

    it('a las 5:59 todavia es la anterior', () => {
      expect(comoCaracas(inicioDeJornada(caracas('2026-09-19 05:59')))).toBe(
        '2026-09-18 06:00',
      );
    });

    it('NO depende de la zona horaria del servidor', () => {
      // El mismo instante, escrito en UTC: 2026-09-19 03:00 Caracas.
      const mismoInstante = new Date('2026-09-19T07:00:00.000Z');
      expect(comoCaracas(inicioDeJornada(mismoInstante))).toBe(
        '2026-09-18 06:00',
      );
    });
  });

  describe('inicioDeSemana', () => {
    it('el viernes devuelve el lunes de esa semana', () => {
      // 2026-09-18 es viernes.
      expect(comoCaracas(inicioDeSemana(caracas('2026-09-18 20:00')))).toBe(
        '2026-09-14 06:00',
      );
    });

    it('el lunes a las 7 AM devuelve ese mismo lunes', () => {
      expect(comoCaracas(inicioDeSemana(caracas('2026-09-14 07:00')))).toBe(
        '2026-09-14 06:00',
      );
    });

    it('la madrugada del lunes pertenece a la semana ANTERIOR', () => {
      // Lo vendido el lunes a la 1 AM es venta del domingo.
      expect(comoCaracas(inicioDeSemana(caracas('2026-09-14 01:00')))).toBe(
        '2026-09-07 06:00',
      );
    });

    it('la madrugada del domingo sigue siendo la semana del sabado', () => {
      expect(comoCaracas(inicioDeSemana(caracas('2026-09-20 03:00')))).toBe(
        '2026-09-14 06:00',
      );
    });
  });

  describe('inicioDeMes', () => {
    it('devuelve el dia 1 a las 6 AM', () => {
      expect(comoCaracas(inicioDeMes(caracas('2026-09-18 15:00')))).toBe(
        '2026-09-01 06:00',
      );
    });

    it('la madrugada del dia 1 pertenece al mes ANTERIOR', () => {
      expect(comoCaracas(inicioDeMes(caracas('2026-09-01 02:00')))).toBe(
        '2026-08-01 06:00',
      );
    });

    it('cruza el fin de año sin romperse', () => {
      expect(comoCaracas(inicioDeMes(caracas('2026-01-15 12:00'), -1))).toBe(
        '2025-12-01 06:00',
      );
    });
  });

  describe('rangoDe', () => {
    const ahora = caracas('2026-09-18 15:00'); // viernes

    it('HOY es una jornada completa de 24 h', () => {
      const r = rangoDe(IntervaloPanel.HOY, ahora);
      expect(comoCaracas(r.start)).toBe('2026-09-18 06:00');
      expect(comoCaracas(r.end)).toBe('2026-09-19 06:00');
      expect(r.end.getTime() - r.start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('AYER termina exactamente donde empieza HOY, sin hueco ni solape', () => {
      const ayer = rangoDe(IntervaloPanel.AYER, ahora);
      const hoy = rangoDe(IntervaloPanel.HOY, ahora);
      expect(ayer.end.getTime()).toBe(hoy.start.getTime());
    });

    it('la semana actual son 7 jornadas', () => {
      const r = rangoDe(IntervaloPanel.SEMANA_ACTUAL, ahora);
      expect(comoCaracas(r.start)).toBe('2026-09-14 06:00');
      expect(comoCaracas(r.end)).toBe('2026-09-21 06:00');
    });

    it('la semana anterior pega con la actual', () => {
      const previa = rangoDe(IntervaloPanel.SEMANA_ANTERIOR, ahora);
      const actual = rangoDe(IntervaloPanel.SEMANA_ACTUAL, ahora);
      expect(previa.end.getTime()).toBe(actual.start.getTime());
    });

    it('el mes actual va del 1 al 1 del siguiente', () => {
      const r = rangoDe(IntervaloPanel.MES_ACTUAL, ahora);
      expect(comoCaracas(r.start)).toBe('2026-09-01 06:00');
      expect(comoCaracas(r.end)).toBe('2026-10-01 06:00');
    });

    it('trae con que comparar cuando tiene sentido', () => {
      expect(rangoDe(IntervaloPanel.HOY, ahora).comparaCon).toBe(
        IntervaloPanel.AYER,
      );
      expect(rangoDe(IntervaloPanel.HOY, ahora).etiquetaComparacion).toBe(
        'vs ayer',
      );
    });

    it('no compara AYER contra nada: no habria con que', () => {
      expect(rangoDe(IntervaloPanel.AYER, ahora).comparaCon).toBeNull();
    });

    it('los seis intervalos producen un rango no vacio', () => {
      for (const intervalo of Object.values(IntervaloPanel)) {
        const r = rangoDe(intervalo, ahora);
        expect(r.end.getTime()).toBeGreaterThan(r.start.getTime());
        expect(r.etiqueta).toBeTruthy();
      }
    });
  });

  describe('etiquetaDeJornada', () => {
    it('la madrugada se imputa al dia anterior', () => {
      expect(etiquetaDeJornada(caracas('2026-09-19 02:00'))).toBe('2026-09-18');
      expect(etiquetaDeJornada(caracas('2026-09-19 18:00'))).toBe('2026-09-19');
    });
  });

  describe('esIntervaloValido', () => {
    it('acepta los del enum y rechaza el resto', () => {
      expect(esIntervaloValido('today')).toBe(true);
      expect(esIntervaloValido('currentWeek')).toBe(true);
      expect(esIntervaloValido('siempre')).toBe(false);
      expect(esIntervaloValido(undefined)).toBe(false);
      expect(esIntervaloValido(7)).toBe(false);
    });
  });
});
