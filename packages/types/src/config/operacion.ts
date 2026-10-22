import { asRecord, num, str } from './util';

export interface OperacionConfig {
  /** ISO 3166-1 alfa-2. */
  country: string;
  /** IANA (ej. "America/Caracas"). Fuente única de zona horaria del sistema. */
  timezone: string;
  /** Locale para formatear fechas y números (ej. "es-VE"). */
  locale: string;
  /** Prefijo telefónico sin "+" (ej. "58"). */
  phonePrefix: string;
  /** Hora (0-23) en que empieza la jornada: lo vendido antes cuenta para el día anterior. */
  businessDayStartHour: number;
  /** Día en que empieza la semana de negocio: 0 = domingo … 6 = sábado. */
  weekStartsOn: number;
}

export const OPERACION_DEFAULT: OperacionConfig = {
  country: 'VE',
  timezone: 'America/Caracas',
  locale: 'es-VE',
  phonePrefix: '58',
  businessDayStartHour: 6,
  weekStartsOn: 1,
};

const isTimezone = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 60) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: v });
    return true;
  } catch {
    return false;
  }
};

export function normalizeOperacion(raw: unknown): OperacionConfig {
  const r = asRecord(raw);
  const d = OPERACION_DEFAULT;
  const country = str(r.country, d.country, 2).toUpperCase();
  const locale = str(r.locale, d.locale, 15);
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : d.country,
    timezone: isTimezone(r.timezone) ? r.timezone : d.timezone,
    locale: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale) ? locale : d.locale,
    phonePrefix: /^\d{1,4}$/.test(String(r.phonePrefix ?? ''))
      ? String(r.phonePrefix)
      : d.phonePrefix,
    businessDayStartHour: Math.round(
      num(r.businessDayStartHour, d.businessDayStartHour, 0, 23),
    ),
    weekStartsOn: Math.round(num(r.weekStartsOn, d.weekStartsOn, 0, 6)),
  };
}
