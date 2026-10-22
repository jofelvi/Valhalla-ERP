import { PeriodoDelPanel } from '@odin6/types';

/**
 * Como se escribe el rango que esta mirando el usuario.
 *
 * El panel viejo solo decia "Hoy" y el selector quedaba arriba, fuera de
 * pantalla al bajar: con once tarjetas debajo, no habia forma de saber que
 * periodo estabas viendo sin volver a subir. Y "Hoy" tampoco dice que la
 * jornada arranca a las 6 AM, que es justo lo que hace que el panel no cuadre
 * contra la caja si uno asume medianoche.
 */

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Caracas es UTC-4 todo el año. El rango se lee en hora del local, no del navegador. */
const OFFSET_MS = 4 * 60 * 60 * 1000;

const pared = (iso: string): Date =>
  new Date(new Date(iso).getTime() - OFFSET_MS);

const dia = (d: Date): string =>
  `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;

/**
 * "vie 19 sep 6:00 am → sáb 20 sep 6:00 am", o el rango largo para semanas y
 * meses. `hasta` es EXCLUSIVO, asi que para rangos de varios dias se muestra
 * el ultimo dia incluido, no el siguiente.
 */
export function formatearPeriodo(periodo: PeriodoDelPanel): string {
  const desde = pared(periodo.desde);
  const hasta = pared(periodo.hasta);
  const dias = Math.round(
    (hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dias <= 1) {
    return `${dia(desde)}, 6:00 am → 6:00 am`;
  }

  const ultimoDia = new Date(hasta.getTime() - 24 * 60 * 60 * 1000);
  return `${dia(desde)} → ${dia(ultimoDia)}`;
}

/** Cuántas jornadas cubre el período. Sirve para saber si el gráfico tiene sentido. */
export function diasDelPeriodo(periodo: PeriodoDelPanel): number {
  return Math.round(
    (new Date(periodo.hasta).getTime() - new Date(periodo.desde).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}
