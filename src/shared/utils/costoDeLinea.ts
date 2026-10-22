/**
 * Costo de UNA línea de receta, con la misma aritmética que el servidor
 * (`apps/api/src/modules/inventory/units.ts` + `recipe-cost.helper.ts`).
 *
 * Existe porque la pantalla calculaba el costo de la línea con otra función que
 * ante una unidad incompatible devolvía 0 en silencio: la receta parecía costar
 * menos y nadie se enteraba de que la línea no sumaba. Aquí cada línea devuelve
 * su ESTADO, para poder pintarla en rojo y decir qué dato falta.
 *
 * Funciones puras, sin React: se prueban con `npm run test:unit`.
 */

export type BaseUnit = 'GR' | 'ML' | 'UND';

/** Equivalencias propias de un insumo para cruzar peso ↔ volumen ↔ unidad. */
export interface Equivalencias {
  /** Gramos del insumo por cada ml de la receta. */
  gramsPerMl?: number | null;
  /** Gramos que pesa UNA unidad del insumo. */
  gramsPerUnit?: number | null;
  /** ml que tiene UNA unidad del insumo. */
  mlPerUnit?: number | null;
}

export type FactorFaltante = 'gramsPerMl' | 'gramsPerUnit' | 'mlPerUnit';

export interface InsumoParaCosto extends Equivalencias {
  name?: string | null;
  cost?: number | null;
  presentation?: string | null;
  presentationQuantity?: number | null;
}

// Mismo mapa que UNIT_DEFS del servidor (nombres del enum y alias históricos).
const UNIT_DEFS: Record<string, { base: BaseUnit; factor: number }> = {
  kilogramo: { base: 'GR', factor: 1000 },
  kg: { base: 'GR', factor: 1000 },
  gramo: { base: 'GR', factor: 1 },
  gr: { base: 'GR', factor: 1 },
  g: { base: 'GR', factor: 1 },
  miligramo: { base: 'GR', factor: 0.001 },
  mg: { base: 'GR', factor: 0.001 },
  litro: { base: 'ML', factor: 1000 },
  l: { base: 'ML', factor: 1000 },
  mililitro: { base: 'ML', factor: 1 },
  ml: { base: 'ML', factor: 1 },
  galon: { base: 'ML', factor: 3785.41 },
  galón: { base: 'ML', factor: 3785.41 },
  docena: { base: 'UND', factor: 12 },
  'media docena': { base: 'UND', factor: 6 },
};

function defDe(unit: string | null | undefined): {
  base: BaseUnit;
  factor: number;
} {
  const key = String(unit ?? '')
    .trim()
    .toLowerCase();
  // Lo desconocido (Caja, Lata, Frasco…) es contable ×1, igual que el servidor.
  return UNIT_DEFS[key] ?? { base: 'UND', factor: 1 };
}

export function baseDeUnidad(unit: string | null | undefined): BaseUnit {
  return defDe(unit).base;
}

const valido = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Qué dato del insumo falta para pasar de `from` a `to` (null = se puede). */
export function factorFaltante(
  from: BaseUnit,
  to: BaseUnit,
  eq: Equivalencias | null | undefined,
): FactorFaltante | null {
  if (from === to) return null;
  const par = [from, to].sort().join('-');
  if (par === 'GR-ML') return valido(eq?.gramsPerMl) ? null : 'gramsPerMl';
  if (par === 'GR-UND') return valido(eq?.gramsPerUnit) ? null : 'gramsPerUnit';
  if (valido(eq?.mlPerUnit)) return null;
  if (valido(eq?.gramsPerMl) && valido(eq?.gramsPerUnit)) return null;
  return 'mlPerUnit';
}

/** Cantidad en la unidad base del insumo, o null si no hay cómo convertirla. */
export function convertirABase(
  quantity: number,
  unit: string | null | undefined,
  destino: BaseUnit,
  eq?: Equivalencias | null,
): number | null {
  const def = defDe(unit);
  const enBase = quantity * def.factor;
  if (def.base === destino) return enBase;
  if (factorFaltante(def.base, destino, eq)) return null;
  const gpMl = eq?.gramsPerMl as number;
  const gpU = eq?.gramsPerUnit as number;
  const mlU = eq?.mlPerUnit as number;
  switch (`${def.base}>${destino}`) {
    case 'GR>ML':
      return enBase / gpMl;
    case 'ML>GR':
      return enBase * gpMl;
    case 'GR>UND':
      return enBase / gpU;
    case 'UND>GR':
      return enBase * gpU;
    case 'ML>UND':
      return valido(mlU) ? enBase / mlU : (enBase * gpMl) / gpU;
    default:
      return valido(mlU) ? enBase * mlU : (enBase * gpU) / gpMl;
  }
}

/** Costo por unidad base (g, ml o unidad) con el encoding del catálogo. */
export function costoPorUnidadBase(insumo: InsumoParaCosto): number {
  const cost = Number(insumo.cost ?? 0);
  const contenido = Number(insumo.presentationQuantity ?? 0);
  if (!(cost > 0) || !(contenido > 0)) return 0;
  return cost / contenido / defDe(insumo.presentation ?? 'Unidad').factor;
}

export type EstadoLinea = 'ok' | 'incompatible' | 'sin-costo';

export interface CostoDeLinea {
  estado: EstadoLinea;
  /** 0 cuando la línea no se pudo costear. */
  costo: number;
  /** Cuando es incompatible: qué dato cargar en el insumo (si lo hay). */
  falta?: FactorFaltante;
  mensaje?: string;
}

const NOMBRE_BASE: Record<BaseUnit, string> = {
  GR: 'gramos',
  ML: 'mililitros',
  UND: 'unidades',
};

export const PEDIR_FACTOR: Record<FactorFaltante, string> = {
  gramsPerMl: 'cuántos gramos hay por ml',
  gramsPerUnit: 'cuánto pesa una unidad',
  mlPerUnit: 'cuántos ml tiene una unidad',
};

export function costoDeLinea(
  insumo: InsumoParaCosto,
  quantity: number,
  unit: string | null | undefined,
  wastePercentage = 0,
): CostoDeLinea {
  const base = baseDeUnidad(insumo.presentation ?? 'Unidad');
  const qtyBase = convertirABase(quantity, unit, base, insumo);
  if (qtyBase === null) {
    const falta = factorFaltante(baseDeUnidad(unit), base, insumo) ?? undefined;
    const nombre = insumo.name ?? 'El insumo';
    return {
      estado: 'incompatible',
      costo: 0,
      falta,
      mensaje:
        `${nombre} se maneja en ${NOMBRE_BASE[base]} y esta línea está en ` +
        `${unit ?? 'otra unidad'}: no suma al costo` +
        (falta ? `. Carga en el insumo ${PEDIR_FACTOR[falta]}.` : '.'),
    };
  }
  const porBase = costoPorUnidadBase(insumo);
  if (!(porBase > 0)) {
    return {
      estado: 'sin-costo',
      costo: 0,
      mensaje: `${insumo.name ?? 'El insumo'} no tiene costo o contenido cargado: esta línea cuesta 0.`,
    };
  }
  return {
    estado: 'ok',
    costo: qtyBase * porBase * (1 + (wastePercentage || 0) / 100),
  };
}

/**
 * Unidades que se pueden elegir en una línea de receta: las de la familia del
 * insumo, más las de otra familia SI el insumo trae la equivalencia.
 */
export function medidasDisponibles(
  presentation: string | null | undefined,
  eq?: Equivalencias | null,
): string[] {
  const base = baseDeUnidad(presentation);
  const FAMILIA: Record<BaseUnit, string[]> = {
    GR: ['Gramo', 'Kilogramo', 'Miligramo'],
    ML: ['Mililitro', 'Litro'],
    UND: ['Unidad', 'Docena'],
  };
  const propias = [...FAMILIA[base]];
  for (const otra of ['GR', 'ML', 'UND'] as const) {
    if (otra !== base && factorFaltante(otra, base, eq) === null) {
      propias.push(...FAMILIA[otra]);
    }
  }
  return propias;
}
