import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { MovementsService } from './movements.service';
import { WarehousesService } from './warehouses.service';
import {
  baseUnitOf,
  toBaseQty,
  costPerBaseUnit,
  IncompatibleUnitError,
  InventoryArea,
} from './units';
import { expandRecipeIngredients } from './recipe-cost.helper';

export interface OrderItemForInventory {
  productId: string;
  quantity: number;
  station?: string | null;
  cancelledAt?: Date | null;
  // _id del item en la orden — viaja al kardex como refItemId para rastrear
  // qué entrega/pago emitió cada movimiento.
  itemId?: string;
  customizations?: {
    removedIngredients?: string[];
  } | null;
}

// Entrada del descuento "en vivo": lo que una estación entregó (o devolvió)
// de un item concreto, en el momento en que lo escaneó.
export interface DeliveredConsumptionEntry {
  itemId: string;
  productId: string;
  station?: string | null;
  qty: number; // unidades del item (siempre positivas; la dirección va aparte)
  customizations?: {
    removedIngredients?: string[];
  } | null;
}

export interface OrderLikeForInventory {
  id: string;
  items: OrderItemForInventory[];
}

interface ProductLean {
  _id: string;
  name: string;
  /** Naturaleza: BASE (insumo), COMPUESTO (preparado) o SERVICIO. */
  type?: string;
  cost?: number;
  presentation?: string;
  presentationQuantity?: number;
  isForInventory?: boolean;
  inventoryArea?: InventoryArea;
  ingredients?: Array<{
    productId: string;
    quantity: number;
    unit: string;
    wastePercentage?: number;
  }> | null;
}

@Injectable()
export class ConsumptionService {
  private readonly logger = new Logger('InventarioConsumo');

  constructor(
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    private readonly movementsService: MovementsService,
    private readonly warehousesService: WarehousesService,
  ) {}

  private areaFor(
    item: { station?: string | null },
    product: ProductLean,
  ): InventoryArea {
    if (item.station === 'BAR') return 'BARRA';
    if (product.inventoryArea === 'PIZZERIA') return 'PIZZERIA';
    return 'COCINA';
  }

  // Contexto compartido de un lote de consumos: mapa de productos (con sus
  // ingredientes de receta, batch-fetch sin N+1) + resolución de almacén por
  // área con caché.
  private async prepararContexto(productIds: string[]): Promise<{
    productById: Map<string, ProductLean>;
    resolveWarehouse: (area: InventoryArea) => Promise<string | null>;
  }> {
    const uniques = Array.from(new Set(productIds.filter(Boolean)));
    const products = (await this.productModel
      .find({ _id: { $in: uniques } })
      .lean()) as ProductLean[];
    const productById = new Map(products.map((p) => [String(p._id), p]));

    const ingredientIds = Array.from(
      new Set(
        products.flatMap((p) => (p.ingredients ?? []).map((i) => i.productId)),
      ),
    ).filter((id) => !productById.has(id));
    if (ingredientIds.length > 0) {
      const insumos = (await this.productModel
        .find({ _id: { $in: ingredientIds } })
        .lean()) as ProductLean[];
      for (const ins of insumos) productById.set(String(ins._id), ins);
    }

    const warehouseCache = new Map<InventoryArea, string | null>();
    const resolveWarehouse = async (
      area: InventoryArea,
    ): Promise<string | null> => {
      if (!warehouseCache.has(area)) {
        const w =
          (await this.warehousesService.findDefaultForArea(area)) ??
          (await this.warehousesService.findDefaultForArea('GENERAL'));
        warehouseCache.set(area, w?.id ?? null);
      }
      return warehouseCache.get(area) ?? null;
    };

    return { productById, resolveWarehouse };
  }

  // Emite los movimientos de UN item (receta expandida o insumo directo).
  // direction -1 = consumo (entrega/venta), +1 = reposición (devolución).
  private async emitirConsumoDeItem(opts: {
    orderId: string;
    refItemId?: string;
    item: {
      productId: string;
      quantity: number;
      station?: string | null;
      customizations?: { removedIngredients?: string[] } | null;
    };
    product: ProductLean;
    productById: Map<string, ProductLean>;
    resolveWarehouse: (area: InventoryArea) => Promise<string | null>;
    unmapped: string[];
    userId: string;
    direction: -1 | 1;
    notes?: string;
  }): Promise<number> {
    const { item, product } = opts;
    let emitted = 0;

    const area = this.areaFor(item, product);
    const warehouseId = await opts.resolveWarehouse(area);
    if (!warehouseId) {
      // Sin almacén configurado: no bloquear la venta, reportar
      opts.unmapped.push(`sin-almacen:${area}:${product._id}`);
      return 0;
    }

    // Expansión de receta (centralizada en recipe-cost.helper)
    const result = expandRecipeIngredients(
      product,
      opts.productById,
      this.logger,
    );
    if (result.expanded.length > 0 || result.errors.length > 0) {
      // Producto con receta: emitir movimiento por cada ingrediente válido que NO haya sido removido
      const removedList = (item.customizations?.removedIngredients ?? []).map(
        (r) => String(r).toLowerCase().trim(),
      );
      for (const exp of result.expanded) {
        const insumo = opts.productById.get(exp.insumoId);
        const isRemoved = removedList.some(
          (r) =>
            r === exp.insumoId.toLowerCase() ||
            (insumo?.name && insumo.name.toLowerCase().includes(r)) ||
            (r.length > 2 && insumo?.name && r.includes(insumo.name.toLowerCase())),
        );
        if (isRemoved) {
          this.logger.log(
            `[Personalización] Ingrediente omitido de consumo: "${insumo?.name ?? exp.insumoId}" en orden ${opts.orderId}`,
          );
          continue;
        }

        const ing = product.ingredients!.find(
          (i) => i.productId === exp.insumoId,
        );
        const waste = 1 + (ing?.wastePercentage ?? 0) / 100;
        const totalQty = exp.qtyBase * item.quantity * waste;
        await this.movementsService.emit({
          type: 'CONSUMO_VENTA',
          warehouseId,
          productId: exp.insumoId,
          qty: opts.direction * totalQty,
          baseUnit: exp.baseUnit,
          unitCost: exp.costPerBase,
          refType: 'order',
          refId: opts.orderId,
          refItemId: opts.refItemId,
          notes: opts.notes,
          userId: opts.userId,
        });
        emitted++;
      }
      // Reportar errores de ingredientes (incluso si no hay expandidos)
      for (const err of result.errors) {
        opts.unmapped.push(err.reason);
      }
    } else if (product.isForInventory) {
      // Venta directa del insumo (lata, botella): 1 vendido = 1 UND.
      // presentationQuantity es contenido de la UNIDAD DE COMPRA (caja),
      // NO multiplica la venta.
      await this.movementsService.emit({
        type: 'CONSUMO_VENTA',
        warehouseId,
        productId: product._id,
        qty: opts.direction * item.quantity,
        baseUnit: baseUnitOf(product.presentation ?? 'Unidad'),
        unitCost: costPerBaseUnit(
          product.cost,
          product.presentation ?? 'Unidad',
          product.presentationQuantity ?? 1,
        ),
        refType: 'order',
        refId: opts.orderId,
        refItemId: opts.refItemId,
        notes: opts.notes,
        userId: opts.userId,
      });
      emitted++;
    } else if (String(product.type ?? '') === 'SERVICIO') {
      // Servicio (alquiler del salón, animador, entrada): no toca inventario A
      // PROPÓSITO. No es un fallo ni un pendiente: se calla y no ensucia la
      // auditoría, que es donde hay que ver lo que SÍ está mal.
      this.logger.debug(
        `"${product.name}" es un servicio: no descuenta inventario (correcto)`,
      );
    } else {
      // Naturaleza sin decidir: se vendió y NO salió nada del almacén. Antes
      // esto era un push mudo a una lista que nadie leía; por ahí se fueron 62
      // productos y $1.657 en 30 días sin que apareciera en ningún sitio.
      this.logger.warn(
        `VENTA SIN DESCUENTO: "${product.name}" (${product._id}) x${item.quantity} ` +
          'no tiene receta ni es insumo. Defínelo en /private/recipes.',
      );
      opts.unmapped.push(`sin-naturaleza:${product._id}`);
    }
    return emitted;
  }

  /**
   * Procesa el consumo de inventario de una orden pagada.
   * NO es idempotente por sí sola: el caller reclama la orden con el flag
   * inventoryProcessed antes de llamar (ver orders.service) y le pasa las
   * cantidades RESTANTES (quantity − inventoryConsumedQty) cuando el descuento
   * en vivo ya consumió parte al entregar.
   */
  async processOrderPaid(
    order: OrderLikeForInventory,
  ): Promise<{ movements: number; unmapped: string[] }> {
    let emitted = 0;
    const unmapped: string[] = [];

    const activos = (order.items ?? []).filter(
      (i) => !i.cancelledAt && i.productId && i.quantity > 0,
    );
    const { productById, resolveWarehouse } = await this.prepararContexto(
      activos.map((i) => i.productId),
    );

    for (const item of activos) {
      const product = productById.get(item.productId) ?? null;
      if (!product) {
        unmapped.push(item.productId);
        continue;
      }
      emitted += await this.emitirConsumoDeItem({
        orderId: order.id,
        refItemId: item.itemId,
        item,
        product,
        productById,
        resolveWarehouse,
        unmapped,
        userId: 'sistema',
        direction: -1,
      });
    }

    if (unmapped.length > 0) {
      this.logger.warn(
        `Orden ${order.id}: ${unmapped.length} item(s) sin mapear a inventario: ${unmapped.join(', ')}`,
      );
    }
    return { movements: emitted, unmapped };
  }

  /**
   * Descuento "en vivo": consume (o repone, direction +1) el inventario de lo
   * que una estación acaba de entregar escaneando la ficha. Mismas reglas de
   * expansión que el pago (recetas + isForInventory), pero por la cantidad
   * entregada y con refItemId para rastrear en el kardex.
   * La idempotencia (no pasar de quantity) la garantiza el caller con el
   * contador inventoryConsumedQty del item.
   */
  async processItemsDelivered(
    orderId: string,
    entries: DeliveredConsumptionEntry[],
    userId: string,
    direction: -1 | 1 = -1,
    notes?: string,
  ): Promise<{ movements: number; unmapped: string[] }> {
    let emitted = 0;
    const unmapped: string[] = [];

    const validas = entries.filter((e) => e.productId && e.qty > 0);
    if (validas.length === 0) return { movements: 0, unmapped };

    const { productById, resolveWarehouse } = await this.prepararContexto(
      validas.map((e) => e.productId),
    );

    for (const entry of validas) {
      const product = productById.get(entry.productId) ?? null;
      if (!product) {
        unmapped.push(entry.productId);
        continue;
      }
      emitted += await this.emitirConsumoDeItem({
        orderId,
        refItemId: entry.itemId,
        item: {
          productId: entry.productId,
          quantity: entry.qty,
          station: entry.station,
          customizations: entry.customizations,
        },
        product,
        productById,
        resolveWarehouse,
        unmapped,
        userId,
        direction,
        notes,
      });
    }

    if (unmapped.length > 0) {
      this.logger.warn(
        `Orden ${orderId} (entrega en vivo): ${unmapped.length} item(s) sin mapear: ${unmapped.join(', ')}`,
      );
    }
    return { movements: emitted, unmapped };
  }

  /** Reversa: anula todos los CONSUMO_VENTA de una orden (cancelación/reembolso). */
  async reverseOrder(orderId: string, userId: string): Promise<number> {
    const moves = await this.movementsService.list({
      refId: orderId,
      type: 'CONSUMO_VENTA',
      limit: 1000,
    });
    let annulled = 0;
    for (const m of moves) {
      try {
        await this.movementsService.annul(
          m.id,
          userId,
          `reversa de orden ${orderId}`,
        );
        annulled++;
      } catch {
        // ya anulado — idempotencia suave
      }
    }
    return annulled;
  }
}
