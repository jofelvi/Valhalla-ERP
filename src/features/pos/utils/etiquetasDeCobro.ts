import type { NominaConfig, TarifasConfig } from '@odin6/types';

/**
 * Textos de servicio, impuesto y comisión que se muestran en cobro, recibo y ticket.
 * Todo sale de la configuración: ningún texto lleva un porcentaje ni un nombre de impuesto escrito a mano.
 */

/** Tasa en fracción → texto: 0.1 → "10%", 0.075 → "7.5%". */
export function porcentaje(tasa: number): string {
  return `${Number((tasa * 100).toFixed(2))}%`;
}

/** Línea de servicio según el modo. null = el negocio no cobra servicio (no se muestra). */
export function etiquetaServicio(tarifas: TarifasConfig): string | null {
  if (tarifas.serviceMode === 'none') return null;
  const pct = porcentaje(tarifas.serviceRate);
  return tarifas.serviceMode === 'included'
    ? `Servicio incluido (${pct})`
    : `Servicio (${pct})`;
}

/** Línea de impuesto. null = impuesto apagado (no se muestra). */
export function etiquetaImpuesto(tarifas: TarifasConfig): string | null {
  if (!tarifas.tax.enabled) return null;
  const modo = tarifas.tax.includedInPrice ? 'incluido' : 'sumado';
  return `${tarifas.tax.label} (${porcentaje(tarifas.tax.rate)}) ${modo}`;
}

/** Texto de la comisión del mesonero, con la base que dice la nómina. */
export function etiquetaComision(nomina: NominaConfig): string {
  const base =
    nomina.commissionBasis === 'service' ? 'del servicio' : 'del consumo';
  return `Comisión · ${porcentaje(nomina.commissionRate)} ${base}`;
}
