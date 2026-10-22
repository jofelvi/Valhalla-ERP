import { asRecord, bool, num, oneOf, str } from './util';

/**
 * Cómo se cobra el servicio (el porcentaje del mesonero):
 *  - `additional`: se suma a la cuenta (subtotal + servicio).
 *  - `included`: ya viene dentro de los precios; no se suma, solo se informa cuánto contiene.
 *  - `none`: no hay servicio.
 */
export const SERVICE_MODES = ['additional', 'included', 'none'] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export interface ImpuestoConfig {
  enabled: boolean;
  /** Fracción: 0.16 = 16 %. */
  rate: number;
  /** Etiqueta impresa ("IVA", "ITBIS", "Impuesto"). */
  label: string;
  /** true = los precios ya lo incluyen (se informa, no se suma). */
  includedInPrice: boolean;
  /** true = el servicio también paga impuesto. Decisión fiscal: por defecto no. */
  appliesToService: boolean;
}

export interface TarifasConfig {
  /** ISO 4217 de la moneda en que se fijan los precios. */
  baseCurrency: string;
  /** Moneda en la que también se cobra (ej. "VES"), o null si solo hay una. */
  secondaryCurrency: string | null;
  serviceMode: ServiceMode;
  /** Fracción: 0.10 = 10 %. */
  serviceRate: number;
  /** true = el servicio solo existe si la orden tiene mesonero (las órdenes de caja no lo llevan). */
  serviceOnlyWithWaiter: boolean;
  tax: ImpuestoConfig;
  /** Propinas sugeridas en porcentaje (ej. [10, 15, 20]). Vacío = sin sugerencias. */
  suggestedTipsPct: number[];
}

export const TARIFAS_DEFAULT: TarifasConfig = {
  baseCurrency: 'USD',
  secondaryCurrency: 'VES',
  serviceMode: 'additional',
  serviceRate: 0.1,
  serviceOnlyWithWaiter: true,
  tax: {
    enabled: false,
    rate: 0.16,
    label: 'IVA',
    includedInPrice: true,
    appliesToService: false,
  },
  suggestedTipsPct: [],
};

const iso4217 = (v: unknown): string | null =>
  typeof v === 'string' && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : null;

export function normalizeTarifas(raw: unknown): TarifasConfig {
  const r = asRecord(raw);
  const d = TARIFAS_DEFAULT;
  const t = asRecord(r.tax);
  const tips = Array.isArray(r.suggestedTipsPct)
    ? r.suggestedTipsPct
        .map((x) => num(x, NaN, 0, 100))
        .filter((x) => Number.isFinite(x))
        .slice(0, 6)
    : d.suggestedTipsPct;
  return {
    baseCurrency: iso4217(r.baseCurrency) ?? d.baseCurrency,
    secondaryCurrency:
      r.secondaryCurrency === null
        ? null
        : (iso4217(r.secondaryCurrency) ?? d.secondaryCurrency),
    serviceMode: oneOf(r.serviceMode, SERVICE_MODES, d.serviceMode),
    serviceRate: num(r.serviceRate, d.serviceRate, 0, 0.5),
    serviceOnlyWithWaiter: bool(
      r.serviceOnlyWithWaiter,
      d.serviceOnlyWithWaiter,
    ),
    tax: {
      enabled: bool(t.enabled, d.tax.enabled),
      rate: num(t.rate, d.tax.rate, 0, 0.5),
      label: str(t.label, d.tax.label, 20) || d.tax.label,
      includedInPrice: bool(t.includedInPrice, d.tax.includedInPrice),
      appliesToService: bool(t.appliesToService, d.tax.appliesToService),
    },
    suggestedTipsPct: tips,
  };
}
