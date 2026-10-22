import { SERVICE_MODES, TarifasConfig } from '../shared/contrato';

/** Campos que cada orden guarda con las tarifas con las que se calculó. */
export interface TarifasGuardadasEnOrden {
  tasaServicio?: number | null;
  modoServicio?: string | null;
  tasaIva?: number | null;
  ivaIncluido?: boolean | null;
}

/**
 * Tarifas con las que hay que MOSTRAR una orden ya existente: las que se guardaron al
 * crearla (el servidor manda). Lo que la orden no trae cae a las vigentes. Así, cambiar
 * una tarifa no reescribe las cuentas abiertas ni las cerradas.
 */
export function tarifasDeOrden(
  orden: TarifasGuardadasEnOrden | null | undefined,
  vigentes: TarifasConfig,
): TarifasConfig {
  if (!orden) return vigentes;
  const modo = SERVICE_MODES.find((m) => m === orden.modoServicio);
  const tasaServicio =
    typeof orden.tasaServicio === 'number' &&
    Number.isFinite(orden.tasaServicio)
      ? orden.tasaServicio
      : vigentes.serviceRate;
  const tasaIva = typeof orden.tasaIva === 'number' ? orden.tasaIva : null;
  return {
    ...vigentes,
    serviceMode: modo ?? vigentes.serviceMode,
    serviceRate: tasaServicio,
    tax: {
      ...vigentes.tax,
      enabled: tasaIva !== null ? tasaIva > 0 : vigentes.tax.enabled,
      rate: tasaIva !== null && tasaIva > 0 ? tasaIva : vigentes.tax.rate,
      includedInPrice:
        typeof orden.ivaIncluido === 'boolean'
          ? orden.ivaIncluido
          : vigentes.tax.includedInPrice,
    },
  };
}
