import type { BaseUnit } from './units';
import {
  expandRecipeIngredients,
  type ProductForRecipeCost,
} from './recipe-cost.helper';

/**
 * Qué mover cuando una estación declara que elaboró algo.
 *
 * Producir NO es recibir: la masa que sale del horno consumió harina que ya
 * estaba en el inventario. Aquí se arma el plan (qué entra y qué sale) sin
 * tocar la base de datos, para poder probar el cálculo y para poder MOSTRARLE
 * a gerencia lo que va a pasar antes de que apruebe.
 */

export interface ProductionConsumption {
  productId: string;
  productName: string;
  qtyBase: number;
  baseUnit: BaseUnit;
  costPerBase: number;
  /** Stock que queda tras descontar; negativo = falta cargar una compra. */
  resultingStock?: number;
}

export interface ProductionPlan {
  /** Elaborado que entra al almacén de la estación. */
  output: {
    productId: string;
    productName: string;
    qty: number;
    baseUnit: BaseUnit;
    /** Costo unitario calculado a partir del crudo consumido. */
    unitCost: number;
  };
  /** Crudo que sale. Vacío solo si el producto no lleva receta. */
  consumptions: ProductionConsumption[];
  /** Motivos por los que NO se puede producir (bloquean la aprobación). */
  blockers: string[];
  /** Cosas que gerencia debe saber pero no impiden aprobar. */
  warnings: string[];
}

/** Un insumo sin `criticality` cargada se trata como MEDIA. */
export const DEFAULT_CRITICALITY = 'MEDIA';

/**
 * Arma el plan de producción.
 *
 * Regla de negocio (decidida con el dueño, 05/08/2026): un elaborado SIEMPRE
 * descuenta su receta. Si no tiene receta cargada no se puede producir — y el
 * mensaje dice qué falta, porque "error al aprobar" no le sirve a nadie.
 *
 * @param product     el elaborado (masa, salsa, porción...)
 * @param productById catálogo para resolver los ingredientes
 * @param qty         cuánto se elaboró, ya convertido a unidad base
 * @param baseUnit    unidad base del elaborado (la trae la solicitud)
 * @param stockByProductId stock actual, para avisar de negativos (opcional)
 */
export function planProduction(
  product: ProductForRecipeCost | undefined,
  productById: Map<string, ProductForRecipeCost>,
  qty: number,
  baseUnit: BaseUnit = 'UND',
  stockByProductId?: Map<string, number>,
): ProductionPlan {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!product) {
    return {
      output: {
        productId: '',
        productName: '',
        qty: 0,
        baseUnit: 'UND',
        unitCost: 0,
      },
      consumptions: [],
      blockers: ['El producto a elaborar no existe en el catálogo'],
      warnings,
    };
  }

  const nombre = product.name ?? 'Producto';

  if (!Number.isFinite(qty) || qty <= 0) {
    blockers.push('La cantidad elaborada debe ser mayor que cero');
  }

  if (!product.ingredients?.length) {
    blockers.push(
      `"${nombre}" no tiene receta cargada, así que no se puede saber qué descontar. ` +
        'Pídele a un administrador que la cargue antes de registrar la producción.',
    );
  }

  const { expanded, errors } = expandRecipeIngredients(product, productById);
  for (const e of errors) {
    blockers.push(`Receta de "${nombre}": ${e.reason}`);
  }

  const consumptions: ProductionConsumption[] = expanded.map((ing) => {
    const total = ing.qtyBase * qty;
    const stockActual = stockByProductId?.get(ing.insumoId);
    const resultingStock =
      stockActual === undefined ? undefined : stockActual - total;
    if (resultingStock !== undefined && resultingStock < 0) {
      warnings.push(
        `${ing.insumo.name ?? ing.insumoId} queda en ${resultingStock.toFixed(2)} ${ing.baseUnit}: ` +
          'falta registrar una compra.',
      );
    }
    return {
      productId: ing.insumoId,
      productName: ing.insumo.name ?? ing.insumoId,
      qtyBase: total,
      baseUnit: ing.baseUnit,
      costPerBase: ing.costPerBase,
      resultingStock,
    };
  });

  // El elaborado vale lo que costó el crudo que se le fue.
  const costoTotal = consumptions.reduce(
    (s, c) => s + c.qtyBase * c.costPerBase,
    0,
  );
  const unitCost = qty > 0 ? costoTotal / qty : 0;

  return {
    output: {
      productId: String(product._id ?? ''),
      productName: nombre,
      qty,
      baseUnit,
      unitCost: Math.round(unitCost * 10000) / 10000,
    },
    consumptions,
    blockers,
    warnings,
  };
}
