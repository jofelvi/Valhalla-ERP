import * as yup from 'yup';
import {
  COMMISSION_BASES,
  type CommissionBasis,
  type NominaConfig,
} from '@odin6/types';
import { aFraccion, aPorcentaje } from '../lib/porcentaje';

export interface RetencionFormulario {
  etiqueta: string;
  porcentaje: number;
}

export interface NominaFormulario {
  comisionPct: number;
  baseComision: CommissionBasis;
  excluirCortesias: boolean;
  descuentoEmpleadosPct: number;
  retenciones: RetencionFormulario[];
}

export function aFormulario(n: NominaConfig): NominaFormulario {
  return {
    comisionPct: aPorcentaje(n.commissionRate),
    baseComision: n.commissionBasis,
    excluirCortesias: n.excludeComplimentaryFromCommission,
    descuentoEmpleadosPct: aPorcentaje(n.employeeDiscountRate),
    retenciones: n.deductions.map((d) => ({
      etiqueta: d.label,
      porcentaje: aPorcentaje(d.rate),
    })),
  };
}

export function aValor(f: NominaFormulario): NominaConfig {
  return {
    commissionRate: aFraccion(f.comisionPct),
    commissionBasis: f.baseComision,
    excludeComplimentaryFromCommission: f.excluirCortesias,
    employeeDiscountRate: aFraccion(f.descuentoEmpleadosPct),
    deductions: f.retenciones.map((r) => ({
      label: r.etiqueta.trim(),
      rate: aFraccion(r.porcentaje),
    })),
  };
}

export const MAX_RETENCIONES = 8;

const porcentaje = (mensaje: string) =>
  yup
    .number()
    .typeError(mensaje)
    .required(mensaje)
    .min(0, 'El porcentaje no puede ser negativo.')
    .max(100, 'El porcentaje no puede pasar de 100.');

export const nominaEsquema = yup.object({
  comisionPct: porcentaje('Escriba el porcentaje de comisión, ej. 7.'),
  baseComision: yup
    .mixed<CommissionBasis>()
    .oneOf([...COMMISSION_BASES], 'Elija sobre qué se paga la comisión.')
    .defined(),
  excluirCortesias: yup.boolean().defined(),
  descuentoEmpleadosPct: porcentaje(
    'Escriba el descuento a empleados, ej. 10.',
  ),
  retenciones: yup
    .array()
    .of(
      yup.object({
        etiqueta: yup
          .string()
          .defined()
          .trim()
          .required('Escriba el nombre de la retención (ej. ISLR).')
          .max(40, 'El nombre no puede pasar de 40 caracteres.'),
        porcentaje: yup
          .number()
          .typeError('Escriba un porcentaje, ej. 3.')
          .required('Escriba el porcentaje de la retención.')
          .moreThan(0, 'El porcentaje debe ser mayor que cero.')
          .max(50, 'Una retención no puede pasar de 50 %.'),
      }),
    )
    .max(MAX_RETENCIONES, `Puede poner hasta ${MAX_RETENCIONES} retenciones.`)
    .defined(),
});
