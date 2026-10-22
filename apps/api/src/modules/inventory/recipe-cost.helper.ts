import { Logger } from '@nestjs/common';
import {
  baseUnitOf,
  toBaseQty,
  missingConversion,
  costPerBaseUnit,
  IncompatibleUnitError,
  BaseUnit,
  MissingConversion,
} from './units';

/**
 * Interfaz lean de Producto para cálculo de costos
 */
export interface ProductForRecipeCost {
  _id: string;
  name: string;
  cost?: number;
  presentation?: string;
  presentationQuantity?: number;
  /** Gramos del insumo por cada ml de la receta (cruza peso ↔ volumen). */
  gramsPerMl?: number | null;
  /** Gramos de UNA unidad del insumo (cruza peso ↔ contable). */
  gramsPerUnit?: number | null;
  /** ml de UNA unidad del insumo (cruza volumen ↔ contable). */
  mlPerUnit?: number | null;
  isForInventory?: boolean;
  ingredients?: Array<{
    productId: string;
    quantity: number;
    unit: string;
    wastePercentage?: number;
  }> | null;
}

/**
 * Resultado de la expansión de un ingrediente en una receta
 */
export interface ExpandedIngredient {
  insumoId: string;
  insumo: ProductForRecipeCost;
  qtyBase: number;
  baseUnit: BaseUnit;
  costPerBase: number;
}

/**
 * Una línea de receta que no se pudo costear/descontar, o que cuesta 0.
 * Es la versión tipada de `errors`: la UI la muestra tal cual, sin parsear
 * strings. `sin-costo` es solo un aviso (no bloquea el cálculo).
 */
export interface RecipeLineIssue {
  kind: 'insumo-inexistente' | 'unidad-incompatible' | 'sin-costo';
  ingredientId: string;
  insumoName?: string;
  /** Unidad en que la receta pide el ingrediente. */
  unit?: string;
  /** Unidad base del insumo (la de su presentación). */
  baseUnit?: BaseUnit;
  /** Qué dato del insumo permitiría convertir la unidad. */
  falta?: MissingConversion;
  mensaje: string;
}

/**
 * Resultado de la expansión de una receta completa
 */
export interface ExpandRecipeResult {
  expanded: ExpandedIngredient[]; // Ingredientes que se pudieron expandir
  errors: Array<{ productId?: string; reason: string }>; // Errores encontrados
  issues: RecipeLineIssue[]; // Lo mismo, tipado, más avisos que no bloquean
}

const BASE_LABEL: Record<BaseUnit, string> = {
  GR: 'gramos',
  ML: 'mililitros',
  UND: 'unidades',
};

function mensajeIncompatible(
  insumo: string,
  unit: string,
  baseUnit: BaseUnit,
  falta: MissingConversion | null,
): string {
  const base = `"${insumo}" se maneja en ${BASE_LABEL[baseUnit]} y la receta lo pide en "${unit}"`;
  if (falta === 'gramsPerMl') {
    return `${base}: carga en el insumo cuántos gramos hay por ml`;
  }
  if (falta === 'gramsPerUnit') {
    return `${base}: carga en el insumo cuánto pesa una unidad`;
  }
  if (falta === 'mlPerUnit') {
    return `${base}: carga en el insumo cuántos ml tiene una unidad`;
  }
  return `${base}: usa una unidad compatible`;
}

/**
 * Expande los ingredientes de una receta.
 * Función base reutilizada por computeTheoreticalUnitCost y consumption.service.
 *
 * Para una receta con N ingredientes:
 * - Retorna los ingredientes que se pueden expandir correctamente
 * - Reporta los errores (ingrediente inexistente, unidad incompatible) sin fallar la expansión
 * - Si no hay receta, retorna {expanded: [], errors: []}
 *
 * El caller decide si rejechar la receta completa (computeTheoreticalUnitCost)
 * o procesar solo los ingredientes válidos (consumption.service).
 *
 * @param product Producto con receta (ingredients) o insumo directo (isForInventory)
 * @param productById Mapa de todos los productos para lookup de ingredientes
 * @param logger Logger opcional para warnings
 * @returns ExpandRecipeResult con ingredientes válidos y errores encontrados
 */
export function expandRecipeIngredients(
  product: ProductForRecipeCost,
  productById: Map<string, ProductForRecipeCost>,
  logger?: Logger,
): ExpandRecipeResult {
  const result: ExpandRecipeResult = { expanded: [], errors: [], issues: [] };

  if (!product || !product.ingredients?.length) {
    return result; // Sin receta, retorna arrays vacíos
  }

  for (const ing of product.ingredients) {
    const insumo = productById.get(ing.productId);
    if (!insumo) {
      logger?.warn(
        `Receta de "${product.name}": ingrediente ${ing.productId} no encontrado`,
      );
      result.errors.push({
        productId: ing.productId,
        // El id va en el reason: es lo que llega al string de unmapped_sales (auditoria)
        reason: `insumo-inexistente:${ing.productId}`,
      });
      result.issues.push({
        kind: 'insumo-inexistente',
        ingredientId: ing.productId,
        unit: ing.unit,
        mensaje: `El insumo ${ing.productId} ya no existe en el catálogo`,
      });
      continue;
    }

    const baseUnit = baseUnitOf(insumo.presentation ?? 'Unidad');
    let qtyBase: number;

    try {
      qtyBase = toBaseQty(ing.quantity, ing.unit, baseUnit, insumo);
    } catch (err) {
      if (err instanceof IncompatibleUnitError) {
        logger?.warn(
          `Receta de "${product.name}": ingrediente "${insumo.name}" unidad incompatible (${ing.unit}->${baseUnit})`,
        );
        result.errors.push({
          productId: String(insumo._id),
          reason: `unidad-incompatible:${product._id}>${insumo._id}(${ing.unit}->${baseUnit})`,
        });
        const falta = missingConversion(baseUnitOf(ing.unit), baseUnit, insumo);
        result.issues.push({
          kind: 'unidad-incompatible',
          ingredientId: String(insumo._id),
          insumoName: insumo.name,
          unit: ing.unit,
          baseUnit,
          ...(falta ? { falta } : {}),
          mensaje: mensajeIncompatible(insumo.name, ing.unit, baseUnit, falta),
        });
        continue;
      }
      throw err;
    }

    const costPerBase = costPerBaseUnit(
      insumo.cost,
      insumo.presentation ?? 'Unidad',
      insumo.presentationQuantity ?? 1,
    );

    if (!(costPerBase > 0)) {
      result.issues.push({
        kind: 'sin-costo',
        ingredientId: String(insumo._id),
        insumoName: insumo.name,
        unit: ing.unit,
        baseUnit,
        mensaje: `"${insumo.name}" no tiene costo o contenido cargado: cuesta 0 en este plato`,
      });
    }

    result.expanded.push({
      insumoId: String(insumo._id),
      insumo,
      qtyBase,
      baseUnit,
      costPerBase,
    });
  }

  return result;
}

/**
 * Calcula el costo teórico de una receta expandida.
 * Reutiliza la lógica de consumption.service.ts para garantizar consistencia.
 *
 * Comportamiento: si hay CUALQUIER error en la expansión (ingrediente faltante, unidad incompatible),
 * rechaza la receta completa y retorna null (todo-o-nada).
 *
 * @param product Producto con receta (ingredients) o insumo directo (isForInventory)
 * @param qty Cantidad vendida del producto
 * @param productById Mapa de todos los productos para lookup de ingredientes
 * @param logger Logger opcional para warnings
 * @returns Costo total teórico, o null si no tiene receta válida ni es isForInventory
 */
export function computeTheoreticalUnitCost(
  product: ProductForRecipeCost,
  qty: number,
  productById: Map<string, ProductForRecipeCost>,
  logger?: Logger,
): number | null {
  if (!product) return null;

  // Caso 1: Producto con receta
  const result = expandRecipeIngredients(product, productById, logger);
  if (result.expanded.length > 0) {
    // Solo calcula si no hay errores (rechazo todo-o-nada)
    if (result.errors.length > 0) {
      return null;
    }

    let totalCost = 0;
    for (const exp of result.expanded) {
      const ing = product.ingredients?.find(
        (i) => i.productId === exp.insumoId,
      );
      const wasteFactor = 1 + (ing?.wastePercentage ?? 0) / 100;
      const totalQty = exp.qtyBase * qty * wasteFactor;
      totalCost += totalQty * exp.costPerBase;
    }
    return totalCost;
  }

  // Caso 2: Insumo directo (lata, botella, etc.)
  if (product.isForInventory) {
    const unitCost = costPerBaseUnit(
      product.cost,
      product.presentation ?? 'Unidad',
      product.presentationQuantity ?? 1,
    );
    return qty * unitCost;
  }

  // Caso 3: Ni receta ni insumo directo
  return null;
}
