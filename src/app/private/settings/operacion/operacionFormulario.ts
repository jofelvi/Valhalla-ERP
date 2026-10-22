import * as yup from 'yup';
import type { OperacionConfig } from '@odin6/types';
import { esZonaValida } from '../lib/zonasHorarias';

export interface OperacionFormulario {
  country: string;
  timezone: string;
  locale: string;
  phonePrefix: string;
  businessDayStartHour: number;
  weekStartsOn: number;
}

export function aFormulario(o: OperacionConfig): OperacionFormulario {
  return {
    country: o.country,
    timezone: o.timezone,
    locale: o.locale,
    phonePrefix: o.phonePrefix,
    businessDayStartHour: o.businessDayStartHour,
    weekStartsOn: o.weekStartsOn,
  };
}

export function aValor(f: OperacionFormulario): OperacionConfig {
  return {
    country: f.country.trim().toUpperCase(),
    timezone: f.timezone.trim(),
    locale: f.locale.trim(),
    phonePrefix: f.phonePrefix.trim(),
    businessDayStartHour: f.businessDayStartHour,
    weekStartsOn: f.weekStartsOn,
  };
}

export const operacionEsquema = yup.object({
  country: yup
    .string()
    .defined()
    .trim()
    .matches(/^[A-Za-z]{2}$/, 'Use el código de 2 letras del país (ej. VE).'),
  timezone: yup
    .string()
    .defined()
    .trim()
    .test(
      'zona',
      'Esa zona horaria no existe. Elíjala de la lista (ej. America/Caracas).',
      (v) => esZonaValida(v ?? ''),
    ),
  locale: yup
    .string()
    .defined()
    .trim()
    .matches(
      /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
      'Use el formato de idioma, ej. es-VE.',
    ),
  phonePrefix: yup
    .string()
    .defined()
    .trim()
    .matches(
      /^\d{1,4}$/,
      'El prefijo son solo números, sin el signo +. Ej. 58.',
    ),
  businessDayStartHour: yup
    .number()
    .typeError('Elija una hora.')
    .integer()
    .min(0)
    .max(23)
    .required('Elija una hora.'),
  weekStartsOn: yup
    .number()
    .typeError('Elija un día.')
    .integer()
    .min(0)
    .max(6)
    .required('Elija un día.'),
});
