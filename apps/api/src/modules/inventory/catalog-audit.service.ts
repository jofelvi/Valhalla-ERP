import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { baseUnitOf, toBaseQty } from './units';

interface OrderItemLean {
  productId: string;
  quantity: number;
  cancelledAt?: Date | null;
  deliveredQty?: number;
  total?: number;
  totalPrice?: number;
}

interface SoldProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

interface RecipeIssue {
  productId: string;
  name: string;
  issues: string[];
}

interface IncompleteInsumo {
  productId: string;
  name: string;
  missing: ('barcode' | 'foto' | 'costo' | 'contenido')[];
}

interface LegacyService {
  productId: string;
  name: string;
}

interface CatalogAuditResponse {
  coveragePct: number;
  soldWithoutRecipe: SoldProduct[];
  recipesWithIssues: RecipeIssue[];
  insumosIncomplete: IncompleteInsumo[];
  legacyBaseServices: LegacyService[];
}

@Injectable()
export class CatalogAuditService {
  private readonly logger = new Logger(CatalogAuditService.name);

  constructor(
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
  ) {}

  async getAudit(days: number): Promise<CatalogAuditResponse> {
    // Validar rango de días
    const clampedDays = Math.max(1, Math.min(days, 90));

    // Calcular rango de fechas
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - clampedDays * 24 * 60 * 60 * 1000,
    );

    // Obtener órdenes pagadas del período
    const orders = await this.orderModel
      .find({
        paymentStatus: 'paid',
        createdAt: { $gte: startDate, $lt: endDate },
        isDeleted: { $ne: true },
      })
      .lean();

    // Agregar items por productId
    const itemsByProductId = new Map<
      string,
      { quantity: number; revenue: number }
    >();
    let totalUnitsSold = 0;
    let unitsWithCoverageTracking = 0;

    for (const order of orders) {
      for (const item of order.items || []) {
        // Skip cancelled items
        if (item.cancelledAt && item.deliveredQty === 0) {
          continue;
        }

        totalUnitsSold += item.quantity;

        const key = item.productId;
        const existing = itemsByProductId.get(key) || {
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += item.quantity;
        // Fallback: total (new) o totalPrice (legacy dual-shape)
        const itemRevenue =
          (item as OrderItemLean).total ??
          (item as OrderItemLean).totalPrice ??
          0;
        existing.revenue += itemRevenue;
        itemsByProductId.set(key, existing);
      }
    }

    // Obtener todos los productos necesarios
    const productIds = Array.from(itemsByProductId.keys());
    const productsMap = new Map<string, ProductDocument>();

    if (productIds.length > 0) {
      const products = await this.productModel
        .find({ _id: { $in: productIds } })
        .lean();
      (products as Array<Record<string, unknown> & { _id: string }>).forEach(
        (p) => productsMap.set(p._id, p as unknown as ProductDocument),
      );
    }

    const insumosMap = new Map<string, ProductDocument>();
    // Cualquier producto activo puede ser ingrediente: los semielaborados
    // (Masa de Pizza, Salsa de Pizza) son COMPUESTO y el filtro viejo por
    // isForInventory los excluía, así que las 24 recetas que los usan salían
    // con "el insumo no existe en el catálogo".
    const insumos = await this.productModel
      .find({ isActive: { $ne: false } })
      .lean();
    (insumos as Array<Record<string, unknown> & { _id: string }>).forEach((p) =>
      insumosMap.set(p._id, p as unknown as ProductDocument),
    );

    // 1. Productos vendidos SIN receta Y SIN isForInventory
    const soldWithoutRecipe: SoldProduct[] = [];
    for (const [productId, { quantity, revenue }] of itemsByProductId) {
      const product = productsMap.get(productId);
      if (!product) continue;

      const hasRecipe = product.ingredients && product.ingredients.length > 0;
      const isForInventory = product.isForInventory === true;

      if (!hasRecipe && !isForInventory) {
        soldWithoutRecipe.push({
          productId,
          name: product.name,
          unitsSold: quantity,
          revenue,
        });
      } else if (hasRecipe || isForInventory) {
        unitsWithCoverageTracking += quantity;
      }
    }

    // Ordenar desc por unidades, top 50
    soldWithoutRecipe.sort((a, b) => b.unitsSold - a.unitsSold);
    const soldWithoutRecipeTop50 = soldWithoutRecipe.slice(0, 50);

    // 2. Recetas con problemas
    const recipesWithIssues: RecipeIssue[] = [];
    for (const [productId, { quantity }] of itemsByProductId) {
      const product = productsMap.get(productId);
      if (!product) continue;

      const hasRecipe = product.ingredients && product.ingredients.length > 0;
      if (!hasRecipe) continue;

      const issues: string[] = [];
      for (const ingredient of product.ingredients || []) {
        const insumo = insumosMap.get(ingredient.productId);

        // Verificar si existe
        if (!insumo) {
          issues.push(
            `Insumo "${ingredient.productId}" no existe en el catálogo`,
          );
          continue;
        }

        // Verificar costo > 0
        if (!insumo.cost || insumo.cost <= 0) {
          issues.push(`Insumo "${insumo.name}" sin costo asignado`);
          continue;
        }

        // ── Compatibilidad de unidades ──
        // Se usa toBaseQty, LA MISMA conversión que hace el consumo: si aquí
        // pasa, allí descuenta. Antes se comparaba contra INPUT_UNIT_FACTORS
        // (que solo conoce kg/gr/l/ml/und), así que los 788 ingredientes
        // guardados como "Gramo" salían "incompatibles con base GR" — 73
        // recetas marcadas como rotas cuando solo 6 lo estaban de verdad, y
        // las de verdad quedaban enterradas.
        try {
          toBaseQty(
            ingredient.quantity,
            ingredient.unit,
            baseUnitOf(insumo.presentation || ''),
            insumo,
          );
        } catch (err) {
          issues.push(
            `"${insumo.name}" se compra por ${insumo.presentation || 'sin presentación'}: ` +
              `la receta lo pide en "${ingredient.unit}" y nunca descuenta ` +
              `(carga en el insumo los gramos por ml o por unidad para convertirlo)`,
          );
        }
      }

      if (issues.length > 0) {
        recipesWithIssues.push({
          productId,
          name: product.name,
          issues,
        });
      }
    }

    // 3. Insumos incompletos
    const insumosIncomplete: IncompleteInsumo[] = [];
    for (const insumo of insumos) {
      const missing: ('barcode' | 'foto' | 'costo' | 'contenido')[] = [];

      if (!insumo.barcode) {
        missing.push('barcode');
      }
      if (!insumo.imageUrl) {
        missing.push('foto');
      }
      if (!insumo.cost || insumo.cost <= 0) {
        missing.push('costo');
      }
      // 'contenido' solo aplica si la presentación es de MEDIDA (no UND)
      if (baseUnitOf(insumo.presentation || '') !== 'UND') {
        if (!insumo.presentationQuantity || insumo.presentationQuantity <= 0) {
          missing.push('contenido');
        }
      }

      if (missing.length > 0) {
        insumosIncomplete.push({
          productId: insumo._id,
          name: insumo.name,
          missing,
        });
      }
    }

    // 4. Servicios legacy BASE con isForInventory: false explícito
    const legacyBaseServices: LegacyService[] = [];
    const baseServices = await this.productModel
      .find({
        type: 'BASE',
        isForInventory: false,
      })
      .lean();

    baseServices.forEach((p) => {
      legacyBaseServices.push({
        productId: p._id,
        name: p.name,
      });
    });

    // 5. Cobertura: unidades con tracking ÷ total × 100
    const coveragePct =
      totalUnitsSold > 0
        ? Math.round((unitsWithCoverageTracking / totalUnitsSold) * 10000) / 100
        : 0;

    return {
      coveragePct,
      soldWithoutRecipe: soldWithoutRecipeTop50,
      recipesWithIssues,
      insumosIncomplete,
      legacyBaseServices,
    };
  }
}
