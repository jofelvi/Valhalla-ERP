import * as yup from 'yup';
import {
  SERVICE_MODES,
  type ServiceMode,
  type TarifasConfig,
} from '@odin6/types';
import {
  aFraccion,
  aPorcentaje,
  parsearPorcentajes,
  validarListaPorcentajes,
} from '../lib/porcentaje';

export interface TarifasFormulario {
  baseCurrency: string;
  secondaryCurrency: string;
  serviceMode: ServiceMode;
  servicePct: number;
  serviceOnlyWithWaiter: boolean;
  impuestoActivo: boolean;
  taxPct: number;
  taxLabel: string;
  impuestoIncluido: boolean;
  impuestoSobreServicio: boolean;
  /** Porcentajes separados por coma: "10, 15, 20". */
  propinas: string;
}

export function aFormulario(t: TarifasConfig): TarifasFormulario {
  return {
    baseCurrency: t.baseCurrency,
    secondaryCurrency: t.secondaryCurrency ?? '',
    serviceMode: t.serviceMode,
    servicePct: aPorcentaje(t.serviceRate),
    serviceOnlyWithWaiter: t.serviceOnlyWithWaiter,
    impuestoActivo: t.tax.enabled,
    taxPct: aPorcentaje(t.tax.rate),
    taxLabel: t.tax.label,
    impuestoIncluido: t.tax.includedInPrice,
    impuestoSobreServicio: t.tax.appliesToService,
    propinas: t.suggestedTipsPct.join(', '),
  };
}

export function aValor(f: TarifasFormulario): TarifasConfig {
  const secundaria = f.secondaryCurrency.trim().toUpperCase();
  return {
    baseCurrency: f.baseCurrency.trim().toUpperCase(),
    secondaryCurrency: secundaria === '' ? null : secundaria,
    serviceMode: f.serviceMode,
    serviceRate: aFraccion(f.servicePct),
    serviceOnlyWithWaiter: f.serviceOnlyWithWaiter,
    tax: {
      enabled: f.impuestoActivo,
      rate: aFraccion(f.taxPct),
      label: f.taxLabel.trim(),
      includedInPrice: f.impuestoIncluido,
      appliesToService: f.impuestoSobreServicio,
    },
    suggestedTipsPct: parsearPorcentajes(f.propinas).slice(0, 6),
  };
}

const MONEDA = /^[A-Za-z]{3}$/;

export const tarifasEsquema = yup.object({
  baseCurrency: yup
    .string()
    .defined()
    .trim()
    .matches(MONEDA, 'Use el código de 3 letras de la moneda (ej. USD).'),
  secondaryCurrency: yup
    .string()
    .defined()
    .trim()
    .test(
      'moneda2',
      'Use el código de 3 letras (ej. VES) o deje el campo vacío.',
      (v) => !v || MONEDA.test(v),
    ),
  serviceMode: yup
    .mixed<ServiceMode>()
    .oneOf([...SERVICE_MODES], 'Elija una opción de la lista.')
    .defined(),
  servicePct: yup
    .number()
    .typeError('Escriba un número, ej. 10.')
    .required('Escriba el porcentaje del servicio.')
    .min(0, 'El porcentaje no puede ser negativo.')
    .max(50, 'El porcentaje del servicio no puede pasar de 50.'),
  serviceOnlyWithWaiter: yup.boolean().defined(),
  impuestoActivo: yup.boolean().defined(),
  taxPct: yup
    .number()
    .typeError('Escriba un número, ej. 16.')
    .required('Escriba la tasa del impuesto.')
    .min(0, 'La tasa no puede ser negativa.')
    .max(50, 'La tasa del impuesto no puede pasar de 50.'),
  taxLabel: yup
    .string()
    .defined()
    .trim()
    .when('impuestoActivo', {
      is: true,
      then: (s) =>
        s
          .required('Escriba cómo se llama el impuesto (ej. IVA).')
          .max(20, 'Máximo 20 caracteres.'),
    }),
  impuestoIncluido: yup.boolean().defined(),
  impuestoSobreServicio: yup.boolean().defined(),
  propinas: yup
    .string()
    .defined()
    .test(
      'propinas',
      'Escriba hasta 6 porcentajes entre 0 y 100, separados por coma.',
      (v) => validarListaPorcentajes(v ?? '', 6) === true,
    ),
});
