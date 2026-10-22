import { InventoryBaseUnit } from '@odin6/types';

/**
 * Format quantity to friendly display (e.g., 1500 ml -> "1,5 L")
 */
export function formatQuantity(
  qty: number,
  baseUnit: InventoryBaseUnit | undefined,
): string {
  if (!baseUnit) {
    return qty.toLocaleString('es-VE', { maximumFractionDigits: 2 });
  }

  if (baseUnit === 'GR' && qty >= 1000) {
    const kg = qty / 1000;
    return `${kg.toLocaleString('es-VE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} kg`;
  }

  if (baseUnit === 'ML' && qty >= 1000) {
    const l = qty / 1000;
    return `${l.toLocaleString('es-VE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} L`;
  }

  if (baseUnit === 'UND') {
    return `${qty.toLocaleString('es-VE')} und`;
  }

  // Default: show with 2 decimals
  return `${qty.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${baseUnit.toLowerCase()}`;
}

// Espejo de la tabla de normalización del backend (apps/api inventory/units.ts):
// presentationQuantity está expresado en `presentation` (ej: 45 Kilogramo),
// mientras qty del stock viene en unidad base (GR/ML/UND).
const PRESENTATION_DEFS: Record<
  string,
  { base: InventoryBaseUnit; factor: number }
> = {
  kilogramo: { base: 'GR', factor: 1000 },
  kg: { base: 'GR', factor: 1000 },
  gramo: { base: 'GR', factor: 1 },
  gr: { base: 'GR', factor: 1 },
  g: { base: 'GR', factor: 1 },
  litro: { base: 'ML', factor: 1000 },
  l: { base: 'ML', factor: 1000 },
  mililitro: { base: 'ML', factor: 1 },
  ml: { base: 'ML', factor: 1 },
  galon: { base: 'ML', factor: 3785.41 },
  docena: { base: 'UND', factor: 12 },
  'media docena': { base: 'UND', factor: 6 },
};

function normalizePresentation(presentation: string | null | undefined): {
  base: InventoryBaseUnit;
  factor: number;
} {
  const key = (presentation ?? '').trim().toLowerCase();
  return PRESENTATION_DEFS[key] ?? { base: 'UND', factor: 1 };
}

/**
 * Unidad base de un insumo derivada de su presentación (espejo del backend).
 * Útil cuando el API no envía baseUnit (ej: items de conteos).
 */
export function baseUnitFromPresentation(
  presentation: string | null | undefined,
): InventoryBaseUnit {
  return normalizePresentation(presentation).base;
}

/**
 * Valorización: qty (en unidad base) × costo por unidad base, donde
 * costo por unidad base = cost / presentationQuantity / factor(presentation→base).
 * Ej: harina cost=$42.44, 45 Kilogramo → 42.44/45/1000 = $0.000943/gr.
 * Si la presentación no es compatible con la unidad base del stock se
 * devuelve '—' (nunca multiplicar crudo — regla del bug de los $177).
 */
export function calculateValorization(
  qtyBase: number,
  cost: number | undefined,
  presentationQuantity: number | undefined,
  baseUnit: InventoryBaseUnit,
  presentation: string | null | undefined,
): string {
  if (!cost || !presentationQuantity) {
    return '—';
  }

  const def = normalizePresentation(presentation);
  if (def.base !== baseUnit) {
    return '—';
  }

  const costPerBaseUnit = cost / presentationQuantity / def.factor;
  const totalCost = qtyBase * costPerBaseUnit;

  return `$${totalCost.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a signed quantity with color indication
 */
export function formatSignedQty(
  qty: number,
  baseUnit: InventoryBaseUnit,
): { text: string; isNegative: boolean } {
  const formatted = formatQuantity(Math.abs(qty), baseUnit);
  return {
    text: qty < 0 ? `-${formatted}` : `+${formatted}`,
    isNegative: qty < 0,
  };
}

/**
 * Get badge variant by movement type
 */
export type BadgeVariantType =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

export function getMovementTypeBadge(type: string): {
  variant: BadgeVariantType;
  label: string;
} {
  const typeMap: Record<string, { variant: BadgeVariantType; label: string }> =
    {
      COMPRA: { variant: 'success', label: 'Compra' },
      CONSUMO_VENTA: { variant: 'info', label: 'Consumo (Venta)' },
      TRASLADO: { variant: 'info', label: 'Traslado' },
      MERMA_DECLARADA: { variant: 'destructive', label: 'Merma Declarada' },
      CONTEO_AJUSTE: { variant: 'warning', label: 'Ajuste por Conteo' },
      CONTEO_INICIAL: { variant: 'secondary', label: 'Conteo Inicial' },
      ANULACION: { variant: 'secondary', label: 'Anulación' },
    };

  return typeMap[type] || { variant: 'secondary', label: type };
}
