import { OperacionConfig } from '@odin6/types';
import { medianocheDeSemana } from '../../common/operacion/operacion.util';

export type BaseUnit = 'GR' | 'ML' | 'UND';
export type InventoryArea = 'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA';

// Mapa de entrada de usuario (Task 2 + Task 4): convierte kg/gr/l/ml/und a unidad base
export const INPUT_UNIT_FACTORS: Record<
  string,
  { base: 'GR' | 'ML' | 'UND'; factor: number }
> = {
  kg: { base: 'GR', factor: 1000 },
  gr: { base: 'GR', factor: 1 },
  l: { base: 'ML', factor: 1000 },
  ml: { base: 'ML', factor: 1 },
  und: { base: 'UND', factor: 1 },
};

export class IncompatibleUnitError extends Error {
  constructor(unit: string, targetBase: BaseUnit) {
    super(
      `Unidad incompatible: "${unit}" no puede convertirse a la unidad base ${targetBase}. Corrige la unidad en la receta o el insumo.`,
    );
    this.name = 'IncompatibleUnitError';
  }
}

// Normalización tolerante: acepta valores del enum ("Kilogramo") y alias
// comunes ("kg", "gr", "ml") que aparecen en datos históricos.
const UNIT_DEFS: Record<string, { base: BaseUnit; factor: number }> = {
  kilogramo: { base: 'GR', factor: 1000 },
  kg: { base: 'GR', factor: 1000 },
  miligramo: { base: 'GR', factor: 0.001 },
  mg: { base: 'GR', factor: 0.001 },
  gramo: { base: 'GR', factor: 1 },
  gr: { base: 'GR', factor: 1 },
  g: { base: 'GR', factor: 1 },
  litro: { base: 'ML', factor: 1000 },
  l: { base: 'ML', factor: 1000 },
  mililitro: { base: 'ML', factor: 1 },
  ml: { base: 'ML', factor: 1 },
  galon: { base: 'ML', factor: 3785.41 },
  // El enum del front lo guarda con tilde; sin esta clave caía en UND×1
  galón: { base: 'ML', factor: 3785.41 },
  docena: { base: 'UND', factor: 12 },
  'media docena': { base: 'UND', factor: 6 },
  unidad: { base: 'UND', factor: 1 },
  und: { base: 'UND', factor: 1 },
  botella: { base: 'UND', factor: 1 },
  lata: { base: 'UND', factor: 1 },
  caja: { base: 'UND', factor: 1 },
  bolsa: { base: 'UND', factor: 1 },
  bulto: { base: 'UND', factor: 1 },
  paquete: { base: 'UND', factor: 1 },
  envase: { base: 'UND', factor: 1 },
  frasco: { base: 'UND', factor: 1 },
  rollo: { base: 'UND', factor: 1 },
  plato: { base: 'UND', factor: 1 },
};

function normalize(unit: string): { base: BaseUnit; factor: number } {
  const key = (unit ?? '').trim().toLowerCase();
  // Default seguro: lo desconocido se trata como contable ×1
  return UNIT_DEFS[key] ?? { base: 'UND', factor: 1 };
}

export function baseUnitOf(presentation: string): BaseUnit {
  return normalize(presentation).base;
}

/**
 * Factores propios de un insumo para cruzar familias de unidad (peso, volumen,
 * contable). Son DATOS DEL INSUMO, no de la receta: la leche en polvo no pesa
 * lo mismo por ml que el aceite, y un huevo no pesa lo mismo que una lata.
 *  - gramsPerMl: gramos del insumo por cada ml de la receta.
 *  - gramsPerUnit: gramos de UNA unidad del insumo.
 *  - mlPerUnit: ml de UNA unidad del insumo (una lata de 355 ml).
 * Sin el factor la conversión no se inventa: lanza IncompatibleUnitError.
 */
export interface UnitConversion {
  gramsPerMl?: number | null;
  gramsPerUnit?: number | null;
  mlPerUnit?: number | null;
}

/** Solo los factores de conversión de un insumo (acepta null/undefined). */
export function conversionOf(
  p: UnitConversion | null | undefined,
): UnitConversion {
  return {
    gramsPerMl: p?.gramsPerMl,
    gramsPerUnit: p?.gramsPerUnit,
    mlPerUnit: p?.mlPerUnit,
  };
}

/** Qué dato del insumo haría falta para cruzar de una familia a otra. */
export type MissingConversion = 'gramsPerMl' | 'gramsPerUnit' | 'mlPerUnit';

function factorValido(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Qué factor falta (o null si la conversión es posible). */
export function missingConversion(
  from: BaseUnit,
  to: BaseUnit,
  conv?: UnitConversion,
): MissingConversion | null {
  if (from === to) return null;
  const par = [from, to].sort().join('-');
  if (par === 'GR-ML')
    return factorValido(conv?.gramsPerMl) ? null : 'gramsPerMl';
  if (par === 'GR-UND') {
    return factorValido(conv?.gramsPerUnit) ? null : 'gramsPerUnit';
  }
  // ML-UND: directo con ml por unidad, o pasando por gramos con los otros dos
  if (factorValido(conv?.mlPerUnit)) return null;
  if (factorValido(conv?.gramsPerMl) && factorValido(conv?.gramsPerUnit)) {
    return null;
  }
  return 'mlPerUnit';
}

/**
 * Convierte una cantidad en `unit` a la unidad base `targetBase`.
 * Misma familia: factor fijo (kg→g, mg→g, l→ml). Otra familia: usa los
 * factores del insumo. Sin factor, lanza IncompatibleUnitError.
 */
export function convertQty(
  quantity: number,
  unit: string,
  targetBase: BaseUnit,
  conv?: UnitConversion,
): number {
  const def = normalize(unit);
  const enBase = quantity * def.factor;
  if (def.base === targetBase) return enBase;
  if (missingConversion(def.base, targetBase, conv)) {
    throw new IncompatibleUnitError(unit, targetBase);
  }
  const gpMl = conv?.gramsPerMl as number;
  const gpU = conv?.gramsPerUnit as number;
  const mlU = conv?.mlPerUnit as number;
  const pair = `${def.base}>${targetBase}`;
  switch (pair) {
    case 'GR>ML':
      return enBase / gpMl;
    case 'ML>GR':
      return enBase * gpMl;
    case 'GR>UND':
      return enBase / gpU;
    case 'UND>GR':
      return enBase * gpU;
    case 'ML>UND':
      return factorValido(mlU) ? enBase / mlU : (enBase * gpMl) / gpU;
    default: // UND>ML
      return factorValido(mlU) ? enBase * mlU : (enBase * gpU) / gpMl;
  }
}

export function toBaseQty(
  quantity: number,
  unit: string,
  targetBase: BaseUnit,
  conv?: UnitConversion,
): number {
  return convertQty(quantity, unit, targetBase, conv);
}

/**
 * Costo por unidad base (GR/ML/UND) a partir del encoding actual del catálogo:
 * cost = precio de la unidad de compra completa (saco/lata/cartón),
 * presentationQuantity = contenido en `presentation`.
 * Ej: harina cost=42.44, presentation=Kilogramo, presentationQuantity=45
 *     → 42.44/45 = 0.943 por kg → /1000 = 0.000943 por GR.
 */
export function costPerBaseUnit(
  cost: number | undefined,
  presentation: string,
  presentationQuantity: number | undefined,
): number {
  const qty = presentationQuantity || 0;
  if (!cost || cost <= 0 || qty <= 0) return 0;
  const def = normalize(presentation);
  return cost / qty / def.factor;
}

export function roundQty(n: number): number {
  // 3 decimales en unidad base: suficiente para GR/ML y evita ruido flotante
  return Math.round(n * 1000) / 1000;
}

export function roundMoney(n: number): number {
  return Math.round(n * 10000) / 10000; // costos unitarios pequeños (por gr)
}

export function roundUnitCost(n: number): number {
  // Costos por unidad base pueden ser muy pequeños (~0.0009/gr):
  // 8 decimales preservan la reconstruibilidad del ledger (qty × unitCost ≈ totalCost)
  return Math.round(n * 100000000) / 100000000;
}

/**
 * Inicio de la semana de negocio (medianoche del primer día, según `operacion`) que contiene
 * `date`. Es la clave de los informes y listas semanales: ver `medianocheDeSemana`.
 */
export function weekStartOf(date: Date, op: OperacionConfig): Date {
  return medianocheDeSemana(date, op);
}
