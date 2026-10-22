/**
 * Jornada de trabajo (business day) del negocio.
 *
 * El restaurante factura y cobra pasada la medianoche: en los datos reales no
 * hay NI una orden NI un pago entre las 02:00 y las 10:00. Cortar por
 * calendario (00:00) parte la noche en dos y le regala al dia siguiente la
 * mitad de la venta — por eso el dashboard nunca cuadraba contra la caja
 * (ej. 08/08/2026: de $1257 en "ventas", $1125 se habian cobrado ya el 09).
 *
 * La jornada del dia D va de D 06:00 a D+1 05:59:59.999, hora local.
 * Venezuela no aplica horario de verano, asi que basta con la hora local.
 */
export const BUSINESS_DAY_START_HOUR = 6;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Inicio (06:00) de la jornada a la que pertenece `date`. */
export function getBusinessDayStart(date: Date): Date {
  const start = new Date(date);
  if (start.getHours() < BUSINESS_DAY_START_HOUR) {
    start.setDate(start.getDate() - 1);
  }
  start.setHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
  return start;
}

/** Fin inclusivo (05:59:59.999 del dia siguiente) de la jornada `start`. */
export function getBusinessDayEnd(start: Date): Date {
  const end = addDays(start, 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

/**
 * Lunes 06:00 de la semana a la que pertenece `date`, contando por jornada:
 * lo vendido el domingo a las 01:00 sigue siendo del sabado.
 */
export function getBusinessWeekStart(date: Date): Date {
  const day = getBusinessDayStart(date);
  const dayOfWeek = day.getDay();
  return addDays(day, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
}

/** Dia 1 a las 06:00 del mes al que pertenece `date`, contando por jornada. */
export function getBusinessMonthStart(date: Date, monthOffset = 0): Date {
  const day = getBusinessDayStart(date);
  return new Date(
    day.getFullYear(),
    day.getMonth() + monthOffset,
    1,
    BUSINESS_DAY_START_HOUR,
    0,
    0,
    0,
  );
}

export { addDays as addBusinessDays };
