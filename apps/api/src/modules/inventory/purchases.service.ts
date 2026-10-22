import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Purchase, PurchaseDocument } from './schemas/purchase.schema';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  Supplier,
  SupplierDocument,
} from '../suppliers/schemas/supplier.schema';
import {
  MovementsService,
  EmitMovementInput,
  InventoryMovementLean,
} from './movements.service';
import { PriceHistoryService } from './price-history.service';
import { CostPropagationService } from '../products/cost-propagation.service';
import { AlertaMargen, CambioDeCosto } from '../products/cost-propagation.util';
import { PurchaseAliasesService } from './purchase-aliases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import {
  baseUnitOf,
  toBaseQty,
  costPerBaseUnit,
  roundQty,
  roundMoney,
  roundUnitCost,
  BaseUnit,
  IncompatibleUnitError,
  INPUT_UNIT_FACTORS,
} from './units';
import {
  normalizePurchaseItem,
  convertPurchaseItemByRate,
} from './purchases.util';

// Interfaz que Task 4 implementa; opcional para que esta task compile sola.
export interface ShoppingListMarker {
  markPurchased(
    productIds: string[],
    purchaseId: string,
  ): Promise<{ marked: number; listId?: string }>;
}
export const SHOPPING_LIST_MARKER = 'SHOPPING_LIST_MARKER';

export interface PurchaseListResponse {
  _id: string;
  placeId: string;
  placeName: string;
  date: Date;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
    baseQty: number;
    baseUnit: string;
    costPerBaseUnit: number;
    unitCostBs?: number;
    subtotalBs?: number;
  }>;
  invoiceUrls: string[];
  total: number;
  currency: string;
  exchangeRate?: number;
  totalBs?: number;
  warehouseId: string;
  alerts: Array<{
    productId: string;
    productName: string;
    prevCostPerBase: number;
    newCostPerBase: number;
    variationPct: number;
  }>;
  createdBy: string;
  createdAt: Date;
}

export interface CreatePurchaseResponse {
  _id: string;
  id: string;
  placeId: string;
  placeName: string;
  date: Date;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
    baseQty: number;
    baseUnit: string;
    costPerBaseUnit: number;
    unitCostBs?: number;
    subtotalBs?: number;
  }>;
  invoiceUrls: string[];
  total: number;
  currency: string;
  exchangeRate?: number;
  totalBs?: number;
  warehouseId: string;
  alerts: Array<{
    productId: string;
    productName: string;
    prevCostPerBase: number;
    newCostPerBase: number;
    variationPct: number;
  }>;
  createdBy: string;
  createdAt: Date;
  bestPlaceHints: unknown;
  listItemsMarked: number;
  /** Platos cuyo costo subio (o bajo) por esta compra. */
  costosRecalculados: CambioDeCosto[];
  /**
   * Lo que hay que ver ANTES de cerrar la compra: si este precio deja algun
   * producto vendiendose por debajo del margen minimo, aqui esta la lista.
   */
  alertasMargen: AlertaMargen[];
}

interface ResolvedItem {
  item: {
    productId: string;
    quantity: number;
    unit: string;
    unitCost: number;
    unitCostBs?: number;
    unitCostUsd: number;
  };
  product: Pick<
    Product,
    '_id' | 'name' | 'presentation' | 'presentationQuantity' | 'cost'
  >;
  baseUnit: BaseUnit;
  baseQty: number;
  costPerBase: number;
  newProductCost: number;
  /** Contenido de la unidad de compra que la factura corrige en el catalogo. */
  newPresentationQuantity?: number;
  prev: { unitCost: number; placeId: string; date: Date } | null;
  variationPct: number;
}

interface PurchasesQueryFilters {
  from?: Date;
  to?: Date;
  placeId?: string;
  limit?: number;
}

interface MappedPurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  baseQty: number;
  baseUnit: BaseUnit;
  costPerBaseUnit: number;
  unitCostBs?: number;
  subtotalBs?: number;
}

/** Ultima compra de un producto, para proponerla en la siguiente. */
export interface UltimaCompraDeProducto {
  date: Date;
  placeName: string | null;
  quantity: number;
  unit: string;
  /** USD por la unidad ingresada (asi lo guarda la compra). */
  unitCostUsd: number;
  /** Bs por la unidad ingresada, solo si la factura se cargo en Bs. */
  unitCostBs: number | null;
  /** Tasa BCV del dia de esa compra, solo si fue en Bs. */
  exchangeRate: number | null;
}

@Injectable()
export class PurchasesService {
  constructor(
    @InjectModel(Purchase.name)
    private purchaseModel: Model<PurchaseDocument>,
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Supplier.name)
    private supplierModel: Model<SupplierDocument>,
    private movements: MovementsService,
    private priceHistory: PriceHistoryService,
    private readonly costPropagation: CostPropagationService,
    private aliases: PurchaseAliasesService,
    @Optional()
    @Inject(SHOPPING_LIST_MARKER)
    private listMarker?: ShoppingListMarker,
  ) {}

  /** Sugeridas de arranque: sin esto el primer usuario ve un selector vacio. */
  private static readonly CATEGORIAS_BASE = [
    'Insumos de cocina',
    'Bebidas',
    'Carnes y pollo',
    'Charcuteria y quesos',
    'Frutas y verduras',
    'Limpieza',
    'Desechables y empaques',
    'Mantenimiento',
    'Gas y servicios',
    'Otros',
  ];

  /**
   * Lo que se pago la ULTIMA vez por este producto, tal como se cargo: la
   * cantidad y su unidad, el costo en USD y —si la factura fue en Bs— lo que
   * costo en Bs con la tasa de ESE dia. Comprar sin ese dato es comprar a
   * ciegas: en Bs el mismo bulto parece otro precio cada semana solo por la
   * tasa.
   */
  async lastPurchaseOf(productId: string): Promise<UltimaCompraDeProducto | null> {
    const doc = await this.purchaseModel
      .findOne({ 'items.productId': productId })
      .sort({ date: -1 })
      .lean()
      .exec();
    if (!doc) return null;
    const item = doc.items?.find((i) => i.productId === productId);
    if (!item) return null;
    return {
      date: doc.date,
      placeName: doc.placeName ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unitCostUsd: item.unitCost,
      unitCostBs: item.unitCostBs ?? null,
      exchangeRate: doc.exchangeRate ?? null,
    };
  }

  /** Categorias ya usadas + las base, sin repetir y ordenadas. */
  async listCategories(): Promise<string[]> {
    const usadas = (await this.purchaseModel
      .distinct('category')
      .exec()) as unknown as Array<string | null>;

    const limpias = usadas
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());

    return Array.from(
      new Set([...limpias, ...PurchasesService.CATEGORIAS_BASE]),
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }

  async create(
    dto: CreatePurchaseDto,
    userId: string,
  ): Promise<CreatePurchaseResponse> {
    // Idempotencia: si viene clientRequestId, buscar compra existente.
    if (dto.clientRequestId) {
      const existing = await this.purchaseModel
        .findOne({ clientRequestId: dto.clientRequestId })
        .lean();
      if (existing) {
        return {
          ...existing,
          id: existing._id,
        } as unknown as CreatePurchaseResponse;
      }
    }

    const place = await this.supplierModel.findOne({ _id: dto.placeId }).lean();
    if (!place) {
      throw new NotFoundException('Lugar de compra no encontrado');
    }

    const warehouseId =
      dto.warehouseId ?? (await this.defaultGeneralWarehouseId());
    const warehouse = await this.warehouseModel
      .findOne({ _id: warehouseId, isActive: { $ne: false } })
      .lean();
    if (!warehouse) {
      throw new BadRequestException(
        'Almacén destino no existe o está inactivo',
      );
    }

    // 0. Validar y convertir moneda BS → USD
    const currency = dto.currency ?? 'USD';
    const bcvRate = dto.bcvRate;
    if (currency === 'BS' && (!bcvRate || bcvRate <= 0)) {
      throw new BadRequestException(
        'bcvRate es obligatoria para compras en Bs',
      );
    }
    // Normalizar items: derivar unitCost de lineTotal, purchaseUnit del producto, etc.
    const normalizedItems = dto.items.map((item) =>
      normalizePurchaseItem(item, item.productId),
    );

    // Convertir según moneda
    const convertedItems = normalizedItems.map((item) =>
      convertPurchaseItemByRate(item, currency, bcvRate),
    );

    // 1. VALIDAR Y CONVERTIR TODO antes de persistir nada
    const alertPct = Number(process.env.INVENTORY_PRICE_ALERT_PCT ?? 10);
    const resolved: Array<ResolvedItem> = [];
    for (const convertedItem of convertedItems) {
      const product = await this.productModel
        .findOne({ _id: convertedItem.productId })
        .lean();
      if (!product) {
        throw new NotFoundException(
          `Insumo ${convertedItem.productId} no encontrado`,
        );
      }
      const baseUnit = baseUnitOf(product.presentation ?? 'Unidad');
      let baseQty: number;
      let costPerBase: number;
      let newProductCost: number;
      /** Contenido que la factura corrige en el catalogo (undefined = no cambia). */
      let nuevoContenido: number | undefined;
      if (convertedItem.unit === 'unidad-compra') {
        // La FACTURA manda sobre el catalogo: "SOLERA LIGHT RET 222Mlx36UN 5 C
        // 23,01" son 5 cajas de 36 botellas a 23,01 la caja. Ese x36 es lo que
        // realmente se compro; `presentationQuantity` es solo el valor por
        // defecto del producto, y en las bebidas esta casi siempre en 1 — asi
        // 5 cajas entraban como 5 botellas a $23,01 cada una.
        const contenidoDeLaFactura =
          convertedItem.unitsPerPack && convertedItem.unitsPerPack > 0
            ? convertedItem.unitsPerPack
            : null;
        const content = contenidoDeLaFactura ?? product.presentationQuantity ?? 0;
        if (content <= 0) {
          throw new BadRequestException(
            `"${product.name}" no tiene contenido de unidad de compra (presentationQuantity) — regístralo suelto o completa el insumo`,
          );
        }
        // El costo guardado es el de la unidad de compra COMPLETA: sin corregir
        // tambien el contenido, el catalogo diria que una botella cuesta lo que
        // cuesta la caja entera.
        if (contenidoDeLaFactura && contenidoDeLaFactura !== product.presentationQuantity) {
          nuevoContenido = contenidoDeLaFactura;
        }
        baseQty = toBaseQty(
          convertedItem.quantity * content,
          product.presentation ?? 'Unidad',
          baseUnit,
        );
        costPerBase = costPerBaseUnit(
          convertedItem.unitCostUsd,
          product.presentation ?? 'Unidad',
          content,
        );
        newProductCost = convertedItem.unitCostUsd; // precio de la unidad de compra completa en USD (encoding vigente)
      } else {
        const def = INPUT_UNIT_FACTORS[convertedItem.unit];
        if (!def || def.base !== baseUnit) {
          throw new BadRequestException(
            `Unidad "${convertedItem.unit}" incompatible con ${product.name} (base ${baseUnit})`,
          );
        }
        baseQty = roundQty(convertedItem.quantity * def.factor);
        costPerBase = roundUnitCost(convertedItem.unitCostUsd / def.factor);
        // En el camino "suelto" (kg/gr/l/ml/und), si presentationQuantity falta o ≤0,
        // usa 1 unidad de presentation como contenido para recalcular product.cost.
        // Este es el encoding real de insumos simples por Unidad.
        const contentFactor = toBaseQty(
          product.presentationQuantity && product.presentationQuantity > 0
            ? product.presentationQuantity
            : 1,
          product.presentation ?? 'Unidad',
          baseUnit,
        );
        newProductCost = roundMoney(costPerBase * contentFactor);
      }
      const prev = await this.priceHistory.lastCost(convertedItem.productId);
      // Indicador visual a 1 decimal: cambio porcentual de costPerBase respecto a histórico.
      // NO es cifra contable, solo para alertas.
      const variationPct =
        prev && prev.unitCost > 0
          ? Math.round(
              (((costPerBase - prev.unitCost) / prev.unitCost) * 1000) / 10,
            ) / 10
          : 0;
      resolved.push({
        item: convertedItem,
        product,
        baseUnit,
        baseQty,
        costPerBase,
        newProductCost,
        newPresentationQuantity: nuevoContenido,
        prev,
        variationPct,
      });
    }

    // 2. Persistir compra
    const mappedItems: MappedPurchaseItem[] = resolved.map((r) => {
      const itemBase: MappedPurchaseItem = {
        productId: r.item.productId,
        productName: r.product.name,
        quantity: r.item.quantity,
        unit: r.item.unit,
        unitCost: r.item.unitCostUsd, // SIEMPRE en USD después de conversión
        subtotal: roundMoney(r.item.quantity * r.item.unitCostUsd), // USD
        baseQty: r.baseQty,
        baseUnit: r.baseUnit,
        costPerBaseUnit: r.costPerBase,
      };
      // Agregar campos BS si aplica
      if (currency === 'BS' && bcvRate && r.item.unitCostBs !== undefined) {
        return {
          ...itemBase,
          unitCostBs: r.item.unitCostBs,
          subtotalBs: roundMoney(r.item.quantity * r.item.unitCostBs),
        };
      }
      return itemBase;
    });

    const totalAmount = roundMoney(
      mappedItems.reduce((sum, item) => sum + item.subtotal, 0),
    );

    const totalAmountBs =
      currency === 'BS' && bcvRate
        ? roundMoney(
            mappedItems.reduce((sum, item) => sum + (item.subtotalBs || 0), 0),
          )
        : undefined;

    const alerts = resolved
      .filter((r) => Math.abs(r.variationPct) > alertPct && r.prev)
      .map((r) => ({
        productId: r.item.productId,
        productName: r.product.name,
        prevCostPerBase: r.prev!.unitCost,
        newCostPerBase: r.costPerBase,
        variationPct: r.variationPct,
      }));

    const purchase = await this.purchaseModel.create({
      placeId: dto.placeId,
      placeName: place.name,
      // Texto libre normalizado: 'bebidas' y 'Bebidas ' son la misma categoria.
      category: dto.category?.trim() || undefined,
      date: dto.date ? new Date(dto.date) : new Date(),
      items: mappedItems,
      invoiceUrls: dto.invoiceUrls ?? [],
      total: totalAmount,
      currency,
      exchangeRate: currency === 'BS' ? bcvRate : undefined,
      totalBs: totalAmountBs,
      warehouseId,
      alerts,
      createdBy: userId,
      clientRequestId: dto.clientRequestId,
    });

    // 3. Efectos por item: movimiento + price_history + costo del producto
    // Con compensación ante fallo: si algo falla, anula movimientos emitidos y borra la compra
    const emittedMovementIds: string[] = [];
    try {
      for (const r of resolved) {
        const movement = await this.movements.emit({
          type: 'COMPRA',
          warehouseId,
          productId: r.item.productId,
          qty: r.baseQty,
          baseUnit: r.baseUnit,
          unitCost: r.costPerBase,
          refType: 'purchase',
          refId: purchase._id,
          notes: `Compra en ${place.name}`,
          userId,
        });
        emittedMovementIds.push(movement.id);

        await this.priceHistory.record({
          productId: r.item.productId,
          unitCost: r.costPerBase,
          placeId: dto.placeId,
          purchaseId: purchase._id,
          date: purchase.date,
        });
        await this.productModel.updateOne(
          { _id: r.item.productId },
          {
            $set: {
              cost: r.newProductCost,
              // El contenido va JUNTO al costo: `cost` es el precio de la
              // unidad de compra completa, y sin el contenido correcto el
              // catalogo diria que una botella vale lo que vale la caja.
              ...(r.newPresentationQuantity
                ? { presentationQuantity: r.newPresentationQuantity }
                : {}),
            },
          },
        );
      }
    } catch (error) {
      // Compensación: anular movimientos emitidos y borrar compra
      for (const movementId of emittedMovementIds) {
        try {
          await this.movements.annul(
            movementId,
            userId,
            'compensación: compra fallida',
          );
        } catch (_) {
          // Si la anulación falla, continuar con las demás
        }
      }
      await this.purchaseModel.deleteOne({ _id: purchase._id });
      throw error;
    }

    // 3.5 Aprender como factura este proveedor. Va DESPUES de que la compra
    // quedo firme y nunca la hace fallar: el alias es comodidad, no dato.
    const paraAprender = dto.items
      .filter((it) => it.invoiceText)
      .map((it) => ({
        invoiceText: it.invoiceText as string,
        productId: it.productId,
        unitsPerPack: it.unitsPerPack ?? null,
      }));
    if (paraAprender.length > 0) {
      await this.aliases.learn(dto.placeId, paraAprender, userId);
    }

    // 4. Marcar lista de compras activa (si Task 4 está integrada)
    const marked = this.listMarker
      ? await this.listMarker.markPurchased(
          resolved.map((r) => r.item.productId),
          purchase._id,
        )
      : { marked: 0 };

    // 5. Hints de mejor lugar (informativo)
    const bestPlaceHints = await this.priceHistory.bestPlaces(
      resolved.map((r) => r.item.productId),
    );

    // 6. El costo del insumo ya cambio arriba: ahora sube con el el de todo lo
    // que lo lleva, y se revisa que ningun plato quede vendiendose por debajo
    // del margen minimo. Va DESPUES de que la compra quedo firme y no puede
    // tumbarla (el servicio nunca lanza): el stock y el dinero ya se movieron.
    // Las alertas viajan en la respuesta para poder avisar en la misma
    // pantalla, antes de que el usuario cierre la compra.
    const { cambios, alertas } = await this.costPropagation.propagarCosto(
      resolved.map((r) => r.item.productId),
      'compra',
    );

    return {
      ...purchase.toObject(),
      id: purchase._id,
      alerts: purchase.alerts,
      bestPlaceHints,
      listItemsMarked: marked.marked,
      costosRecalculados: cambios,
      alertasMargen: alertas,
    };
  }

  async list(filters: PurchasesQueryFilters): Promise<PurchaseListResponse[]> {
    const query: Record<string, unknown> = {};
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from)
        (query.date as Record<string, Date>).$gte = filters.from;
      if (filters.to) (query.date as Record<string, Date>).$lte = filters.to;
    }
    if (filters.placeId) query.placeId = filters.placeId;

    return this.purchaseModel
      .find(query)
      .sort({ date: -1 })
      .limit(Math.min(filters.limit ?? 50, 500))
      .lean() as Promise<PurchaseListResponse[]>;
  }

  async getById(id: string): Promise<PurchaseListResponse> {
    const purchase = (await this.purchaseModel
      .findOne({ _id: id })
      .lean()) as PurchaseListResponse | null;
    if (!purchase) {
      throw new NotFoundException(`Compra ${id} no encontrada`);
    }
    return purchase;
  }

  private async defaultGeneralWarehouseId(): Promise<string> {
    const warehouse = await this.warehouseModel
      .findOne({ area: 'GENERAL', isDefault: true })
      .lean();
    if (!warehouse) {
      throw new BadRequestException(
        'No hay almacén default configurado en el área GENERAL',
      );
    }
    return warehouse._id;
  }
}
