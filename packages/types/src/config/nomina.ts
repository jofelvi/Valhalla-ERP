import { asRecord, bool, num, oneOf, str } from './util';

/**
 * Sobre qué se paga la comisión del mesonero:
 *  - `sales`: porcentaje del consumo (ventas atribuibles al mesonero).
 *  - `service`: porcentaje del servicio cobrado o incluido (el mesonero se lleva parte del servicio).
 */
export const COMMISSION_BASES = ['sales', 'service'] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

export interface DeduccionNomina {
  label: string;
  /** Fracción del sueldo: 0.04 = 4 %. */
  rate: number;
}

export interface NominaConfig {
  /**
   * Fracción de la base de comisión que gana el mesonero. Con `commissionBasis='sales'`,
   * 0.07 = 7 % de las ventas; con `'service'`, 0.7 = 70 % del servicio.
   */
  commissionRate: number;
  commissionBasis: CommissionBasis;
  /** true = una cortesía (la casa invita) no genera comisión. */
  excludeComplimentaryFromCommission: boolean;
  /** Descuento sobre lo que el empleado consume (fracción). */
  employeeDiscountRate: number;
  /** Retenciones de ley que se descuentan del pago (ISLR, seguro social…). Vacío = ninguna. */
  deductions: DeduccionNomina[];
}

export const NOMINA_DEFAULT: NominaConfig = {
  commissionRate: 0.07,
  commissionBasis: 'sales',
  excludeComplimentaryFromCommission: true,
  employeeDiscountRate: 0.1,
  deductions: [],
};

export function normalizeNomina(raw: unknown): NominaConfig {
  const r = asRecord(raw);
  const d = NOMINA_DEFAULT;
  const deductions = Array.isArray(r.deductions)
    ? r.deductions
        .map((x) => {
          const o = asRecord(x);
          return { label: str(o.label, '', 40), rate: num(o.rate, 0, 0, 0.5) };
        })
        .filter((x) => x.label !== '' && x.rate > 0)
        .slice(0, 8)
    : d.deductions;
  return {
    commissionRate: num(r.commissionRate, d.commissionRate, 0, 1),
    commissionBasis: oneOf(r.commissionBasis, COMMISSION_BASES, d.commissionBasis),
    excludeComplimentaryFromCommission: bool(
      r.excludeComplimentaryFromCommission,
      d.excludeComplimentaryFromCommission,
    ),
    employeeDiscountRate: num(
      r.employeeDiscountRate,
      d.employeeDiscountRate,
      0,
      1,
    ),
    deductions,
  };
}
