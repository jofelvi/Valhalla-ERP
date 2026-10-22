import {
  calcularComision,
  computeOrderTotals,
  type NominaConfig,
  type TarifasConfig,
} from '@odin6/types';

/**
 * Ejemplos vivos: calculan con la MISMA fórmula que la API (`computeOrderTotals`),
 * así que lo que ve el dueño en Ajustes es lo que después cobra la caja.
 */

export interface EjemploServicio {
  cuenta: number;
  /** Lo que paga el cliente con mesonero (incluye servicio sumado e impuesto sumado). */
  pagaConMesonero: number;
  /** Servicio que se suma a la cuenta (modo adicional). */
  servicio: number;
  /** Servicio que ya viene dentro del precio (modo incluido). */
  incluido: number;
  impuesto: number;
  /** Lo que paga sin mesonero (venta en caja). */
  pagaSinMesonero: number;
}

export function ejemploServicio(
  cuenta: number,
  tarifas: TarifasConfig,
): EjemploServicio {
  const conMesonero = computeOrderTotals([{ total: cuenta }], true, tarifas);
  const sinMesonero = computeOrderTotals([{ total: cuenta }], false, tarifas);
  return {
    cuenta,
    pagaConMesonero: conMesonero.total,
    servicio: conMesonero.serviceCharge,
    incluido: conMesonero.servicioIncluido,
    impuesto: conMesonero.tax,
    pagaSinMesonero: sinMesonero.total,
  };
}

export interface EjemploComision {
  cuenta: number;
  cortesia: number;
  /** Base sobre la que se calcula la comisión (ventas o servicio, según la nómina). */
  comisionBase: number;
  comision: number;
}

/** Una cuenta con mesonero y, si se quiere ver el efecto, una cortesía. */
export function ejemploComision(
  nomina: NominaConfig,
  tarifas: TarifasConfig,
  cuenta = 100,
  cortesia = 20,
): EjemploComision {
  const totales = computeOrderTotals(
    [{ total: cuenta }, { total: cortesia, noCharge: true }],
    true,
    tarifas,
    nomina,
  );
  return {
    cuenta,
    cortesia,
    comisionBase: totales.comisionBase,
    comision: calcularComision(totales.comisionBase, nomina),
  };
}
