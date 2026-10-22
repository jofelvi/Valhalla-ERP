/**
 * Acotar una consulta a un rango de fechas.
 *
 * Existe por la nomina: la pantalla se bajaba TODO el historico de pagos
 * (194 KB) y TODO el de comisiones (176 KB) para despues filtrar en el
 * navegador por la semana que se esta mirando. El filtro vive ahora en el
 * servidor, que es donde estan los datos.
 *
 * La regla importante esta en `parseDate`: una fecha ilegible NO filtra. Un
 * `Invalid Date` dentro de un `$gte` no da error — devuelve cero documentos, y
 * la nomina apareceria vacia sin que nadie sepa por que. Antes de mas.
 */

export type DateRangeFilter = Record<string, unknown>;

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const between = (from: Date, to: Date) => ({ $gte: from, $lte: to });

/** `{ campo: { $gte, $lte } }`, o `undefined` si el rango no sirve. */
export const dateRangeFilter = (
  field: string,
  from?: string,
  to?: string,
): DateRangeFilter | undefined => {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return undefined;
  return { [field]: between(start, end) };
};

/**
 * Igual, pero el documento entra si CUALQUIERA de varios campos cae en el
 * rango. Los pagos de comision viejos no tienen `fechaPago` y solo llevan
 * `createdAt`: mirar un solo campo dejaria fuera pagos reales de la semana.
 */
export const firstDateRangeFilter = (
  fields: readonly string[],
  from?: string,
  to?: string,
): DateRangeFilter | undefined => {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return undefined;
  return { $or: fields.map((field) => ({ [field]: between(start, end) })) };
};
