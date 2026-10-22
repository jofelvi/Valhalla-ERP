import { OperacionConfig } from '@odin6/types';
import {
  diaDeNegocio,
  fechaCalendario,
  finDeJornada,
  inicioDeJornada,
  inicioDeJornadaDe,
} from '../../common/operacion/operacion.util';

/**
 * Jornada laboral del negocio, según `operacion` (zona horaria y hora de arranque de la
 * jornada). Usa la utilidad única de `common/operacion`: aquí no hay zona horaria propia.
 *
 * El bug que motivo esto (04/08/2026): el codigo usaba `new Date()` +
 * `setHours(0,0,0,0)`, o sea la medianoche del SERVIDOR. El VPS corre en otra zona, así que
 * el "día" cambiaba a una hora distinta de la de operación, en plena jornada. Quien fichaba
 * entrada a las 2 PM y salía a las 7 PM recibía "No hay registro de check-in para hoy".
 *
 * La jornada NO es el día calendario: arranca a la hora configurada (`businessDayStartHour`)
 * y termina a esa misma hora del día siguiente, para que un turno que cruza la medianoche
 * siga contando como el mismo día de trabajo.
 */

/**
 * Inicio de la jornada que contiene a `now`, en UTC.
 * Ej (arranque 6): 04/08 02:00 locales (madrugada) pertenece a la jornada del 03/08.
 */
export function businessDayStart(now: Date, op: OperacionConfig): Date {
  return inicioDeJornadaDe(now, op);
}

/** Fin de la jornada (inicio de la siguiente), en UTC. */
export function businessDayEnd(now: Date, op: OperacionConfig): Date {
  const fin = finDeJornada(diaDeNegocio(now, op), op);
  return new Date(fin.getTime() + 1);
}

/** Etiqueta de la jornada (YYYY-MM-DD) para agrupar y mostrar. */
export function businessDayLabel(now: Date, op: OperacionConfig): string {
  return diaDeNegocio(now, op);
}

/**
 * Rango de la jornada para una CONSULTA por fecha.
 *
 * El bug que motivo esto (05/08/2026): la app pide la asistencia del día mandando la
 * MEDIANOCHE local. Pasar esa medianoche por `businessDayStart` devuelve la jornada ANTERIOR,
 * porque la jornada arranca a una hora posterior a las 00:00. La ventana quedaba fuera del
 * registro de hoy, que se marca justo a la hora de arranque. El mesonero que acababa de fichar
 * no veía su entrada y quedaba atrapado sin poder marcar salida.
 *
 * Aquí el parámetro se lee como "el día D" y se devuelve la jornada que EMPIEZA ese día. Si D
 * es el día calendario de hoy, se devuelve la jornada vigente, que cubre la madrugada: a las
 * 2 AM del 5, lo que está corriendo es la jornada que arrancó el 4.
 */
export function businessDayRangeForQuery(
  fecha: Date,
  op: OperacionConfig,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const pedido = fechaCalendario(fecha, op);
  const hoy = fechaCalendario(now, op);

  // Comparar contra el día calendario y no contra la etiqueta de jornada es lo que salva la
  // madrugada: a las 2 AM del 5 el turno abierto pertenece a la jornada del 4, y devolver "la
  // jornada del 5" daría una ventana que aún no empezó.
  const start =
    pedido === hoy ? inicioDeJornadaDe(now, op) : inicioDeJornada(pedido, op);

  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
