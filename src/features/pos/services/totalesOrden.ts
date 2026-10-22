import {
  computeOrderTotals,
  type LineaDeOrden,
  type NominaConfig,
  type ServiceMode,
  type TarifasConfig,
  type TotalesDeOrden,
} from '@odin6/types';

/**
 * Tasas con las que se guardó una orden. Un cambio de tarifa no reescribe las órdenes
 * ya cerradas, así que el total de una orden guardada se calcula con SUS tasas.
 */
export interface TasasGuardadas {
  tasaServicio: number;
  modoServicio: ServiceMode;
  tasaIva: number;
  ivaIncluido: boolean;
}

const MODOS: readonly ServiceMode[] = ['additional', 'included', 'none'];

/**
 * Lee las tasas guardadas de una orden (las escribe la API al cerrar el cálculo).
 * Devuelve undefined si la orden es nueva o no las trae: entonces rigen las vigentes.
 */
export function tasasGuardadasDe(orden: unknown): TasasGuardadas | undefined {
  if (typeof orden !== 'object' || orden === null) return undefined;
  const o = orden as Record<string, unknown>;
  const { tasaServicio, modoServicio, tasaIva, ivaIncluido } = o;
  if (
    typeof tasaServicio !== 'number' ||
    typeof tasaIva !== 'number' ||
    typeof ivaIncluido !== 'boolean' ||
    !MODOS.includes(modoServicio as ServiceMode)
  ) {
    return undefined;
  }
  return {
    tasaServicio,
    modoServicio: modoServicio as ServiceMode,
    tasaIva,
    ivaIncluido,
  };
}

/**
 * Tarifas efectivas para calcular una orden: las guardadas si existen, las vigentes si no.
 * `tasaIva = 0` significa que el impuesto no aplicaba a esa orden.
 */
export function tarifasDeOrden(
  vigentes: TarifasConfig,
  guardadas?: TasasGuardadas,
): TarifasConfig {
  if (!guardadas) return vigentes;
  return {
    ...vigentes,
    serviceMode: guardadas.modoServicio,
    serviceRate: guardadas.tasaServicio,
    tax: {
      ...vigentes.tax,
      enabled: guardadas.tasaIva > 0,
      rate: guardadas.tasaIva,
      includedInPrice: guardadas.ivaIncluido,
    },
  };
}

export interface EntradaTotales {
  items: LineaDeOrden[];
  tieneMesonero: boolean;
  tarifas: TarifasConfig;
  nomina: NominaConfig;
  guardadas?: TasasGuardadas;
}

/**
 * Totales de una orden en la web. Usa la misma función que la API (`computeOrderTotals`).
 * Si la API responde otros totales tras guardar, la pantalla debe mostrar esos.
 */
export function calcularTotalesOrden({
  items,
  tieneMesonero,
  tarifas,
  nomina,
  guardadas,
}: EntradaTotales): TotalesDeOrden {
  return computeOrderTotals(
    items,
    tieneMesonero,
    tarifasDeOrden(tarifas, guardadas),
    nomina,
  );
}
