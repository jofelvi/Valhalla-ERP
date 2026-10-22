import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ShoppingList,
  ShoppingListDocument,
} from './schemas/shopping-list.schema';
import {
  InventoryMovement,
  InventoryMovementDocument,
} from './schemas/inventory-movement.schema';
import { WarehouseStock } from './schemas/warehouse-stock.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import {
  Supplier,
  SupplierDocument,
} from '../suppliers/schemas/supplier.schema';
import { PriceHistoryService } from './price-history.service';
import { MovementsService, InventoryMovementLean } from './movements.service';
import { DeepseekService } from './deepseek.service';
import {
  BaseUnit,
  baseUnitOf,
  toBaseQty,
  costPerBaseUnit,
  roundQty,
  INPUT_UNIT_FACTORS,
  weekStartOf,
} from './units';
import { ConfigsService } from '../configs/configs.service';
import { ProposeItemsDto } from './dto/propose-items.dto';
import { ShoppingListMarker, SHOPPING_LIST_MARKER } from './purchases.service';

interface SuggestedItem {
  productId: string;
  productName: string;
  suggestedQty: number;
  unit: BaseUnit;
  reason: 'CONSUMO_PROMEDIO' | 'BAJO_MINIMO' | 'MANUAL';
  lastCost?: number;
}

interface ConsumptionByWeek {
  weekStart: Date;
  totalQty: number;
}

@Injectable()
export class ShoppingListsService implements ShoppingListMarker {
  private readonly logger = new Logger(ShoppingListsService.name);
  private readonly WEEKS_LOOKBACK = 4; // Ventana de 4 semanas completas anteriores

  constructor(
    @InjectModel(ShoppingList.name)
    private shoppingListModel: Model<ShoppingListDocument>,
    @InjectModel(InventoryMovement.name)
    private movementModel: Model<InventoryMovementDocument>,
    @InjectModel(WarehouseStock.name)
    private stockModel: Model<WarehouseStock>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
    @InjectModel(Supplier.name)
    private supplierModel: Model<SupplierDocument>,
    private priceHistory: PriceHistoryService,
    private movements: MovementsService,
    private deepseek: DeepseekService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Sugiere items de compra basado en consumo histórico y stock mínimo.
   * @param area Área a filtrar (GENERAL, COCINA, PIZZERIA, BARRA). Si undefined, todas.
   */
  async suggest(area?: string): Promise<SuggestedItem[]> {
    const op = await this.configs.obtener('operacion');
    const today = new Date();
    const weekStart = weekStartOf(today, op);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    // 1. Resolver warehouses del área (si aplica)
    let warehouseIds: string[] = [];
    if (area) {
      const warehouses = await this.warehouseModel.find({ area }).lean();
      warehouseIds = warehouses.map((w) => w._id);
    }

    // 2. Aggregation: consumo por producto por semana (últimas WEEKS_LOOKBACK semanas COMPLETAS, sin la actual)
    const fourWeeksAgo = new Date(
      weekStart.getTime() - this.WEEKS_LOOKBACK * 7 * 24 * 3600 * 1000,
    );

    // Obtener todos los movimientos CONSUMO_VENTA en el período (excluyendo la semana actual)
    const baseQuery = {
      type: 'CONSUMO_VENTA',
      createdAt: { $gte: fourWeeksAgo, $lt: weekStart },
    };

    let allMovements: InventoryMovementLean[] = [];
    if (warehouseIds.length > 0) {
      allMovements = (await this.movementModel
        .find({
          ...baseQuery,
          warehouseId: { $in: warehouseIds },
        })
        .lean()) as InventoryMovementLean[];
    } else {
      allMovements = (await this.movementModel
        .find(baseQuery)
        .lean()) as InventoryMovementLean[];
    }

    const movementsList = allMovements;

    // Agrupar por productId y semana
    const consumptionByProduct: Record<string, ConsumptionByWeek[]> = {};
    for (const move of movementsList) {
      const moveWeekStart = weekStartOf(move.createdAt!, op);
      const productId = move.productId;

      if (!consumptionByProduct[productId]) {
        consumptionByProduct[productId] = [];
      }

      // Buscar si ya existe entrada para esta semana
      const existing = consumptionByProduct[productId].find(
        (w) => w.weekStart.getTime() === moveWeekStart.getTime(),
      );
      if (existing) {
        existing.totalQty += Math.abs(move.qty); // qty es negativo en CONSUMO_VENTA
      } else {
        consumptionByProduct[productId].push({
          weekStart: moveWeekStart,
          totalQty: Math.abs(move.qty),
        });
      }
    }

    // 3. Productos únicos de consumo + minStock
    const allProductIds = new Set<string>();
    Object.keys(consumptionByProduct).forEach((id) => allProductIds.add(id));

    // Agregar productos con minStock > 0 — SOLO insumos de inventario.
    // El catálogo tiene servicios legacy con type BASE + isForInventory:false
    // explícito (Animador, Sonido, alquileres) que NO van en la lista.
    const minStockProducts = await this.productModel
      .find({
        minStock: { $gt: 0 },
        isActive: { $ne: false },
        isForInventory: { $ne: false },
        $or: [{ isForInventory: true }, { type: 'BASE' }],
      })
      .lean();
    minStockProducts.forEach((p) => allProductIds.add(p._id));

    // 4. Cargar productos + stock actual
    const products = await this.productModel
      .find({ _id: { $in: Array.from(allProductIds) } })
      .lean();

    const suggested: SuggestedItem[] = [];

    for (const product of products) {
      const baseUnit = baseUnitOf(product.presentation ?? 'Unidad');
      const stockQuery: Record<string, unknown> = { productId: product._id };
      if (warehouseIds.length > 0) {
        stockQuery.warehouseId = { $in: warehouseIds };
      }
      const stocksByWarehouse = await this.stockModel
        .find(stockQuery, { qty: 1 })
        .lean();

      const totalStock = stocksByWarehouse.reduce(
        (sum, s) => sum + (s.qty ?? 0),
        0,
      );

      // Consumo promedio ponderado
      const consumption = consumptionByProduct[product._id];
      let suggestedQty = 0;
      let reason: 'CONSUMO_PROMEDIO' | 'BAJO_MINIMO' | 'MANUAL' =
        'CONSUMO_PROMEDIO';

      if (consumption && consumption.length > 0) {
        // Ordenar por semana MÁS RECIENTE primero (orden cronológico descendente)
        const sorted = consumption.sort(
          (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
        );

        // Media ponderada 4,3,2,1: la semana completa más reciente pesa 4 y la más vieja 1
        // (índice 0 es la más reciente de las últimas WEEKS_LOOKBACK, índice 3 es la más vieja)
        // Lo reciente predice mejor la próxima semana. Normalización por suma de pesos usados.
        const weights = [4, 3, 2, 1];
        let totalConsumption = 0;
        let totalWeight = 0;
        for (let i = 0; i < Math.min(sorted.length, this.WEEKS_LOOKBACK); i++) {
          totalConsumption += sorted[i].totalQty * weights[i];
          totalWeight += weights[i];
        }

        const consumoPromedio = totalConsumption / totalWeight;
        const colchon =
          Number(process.env.INVENTORY_LIST_CUSHION_PCT ?? 15) / 100;
        suggestedQty = roundQty(consumoPromedio * (1 + colchon) - totalStock);
      }

      // Si no hay consumo pero hay minStock
      if (consumption && consumption.length === 0 && product.minStock) {
        const minStockInBaseUnit = product.minStock; // supuesto: minStock está en unidad base
        if (totalStock < minStockInBaseUnit) {
          suggestedQty = minStockInBaseUnit - totalStock;
          reason = 'BAJO_MINIMO';
        }
      } else if (!consumption && product.minStock) {
        // Sin consumo histórico pero con minStock
        const minStockInBaseUnit = product.minStock;
        if (totalStock < minStockInBaseUnit) {
          suggestedQty = minStockInBaseUnit - totalStock;
          reason = 'BAJO_MINIMO';
        }
      }

      // No incluir si qty ≤ 0 (salvo BAJO_MINIMO que siempre aparece si aplica)
      if (suggestedQty <= 0 && reason !== 'BAJO_MINIMO') {
        continue;
      }

      // lastCost
      let lastCost: number | undefined;
      try {
        const priceRecord = await this.priceHistory.lastCost(product._id);
        if (priceRecord) {
          lastCost = priceRecord.unitCost;
        }
      } catch (error) {
        // fallback a costPerBaseUnit
        if (error instanceof Error) {
          this.logger.warn(
            `No se pudo obtener histórico de precios para ${product._id}: ${error.message}`,
          );
        }
      }
      if (!lastCost) {
        lastCost = costPerBaseUnit(
          product.cost,
          product.presentation ?? 'Unidad',
          product.presentationQuantity,
        );
      }

      suggested.push({
        productId: product._id,
        productName: product.name,
        suggestedQty: Math.max(suggestedQty, 0),
        unit: baseUnit,
        reason,
        lastCost,
      });
    }

    return suggested;
  }

  /**
   * Propone items para la lista de la semana actual.
   * Consolida propuestas por producto, convierte a unidad base.
   */
  async propose(dto: ProposeItemsDto, userId: string): Promise<ShoppingList> {
    const op = await this.configs.obtener('operacion');
    const today = new Date();
    const weekStart = weekStartOf(today, op);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    // Buscar o crear lista de esta semana
    let list = await this.shoppingListModel.findOne({ weekStart }).exec();
    if (!list) {
      list = await this.shoppingListModel.create({
        weekStart,
        weekEnd,
        status: 'PROPUESTA',
        items: [],
        proposedBy: [userId],
      });
    } else if (!list.proposedBy.includes(userId)) {
      list.proposedBy.push(userId);
    }

    // Procesar items propuestos: consolidar por productId
    const proposedMap = new Map<string, { qty: number; station?: string }>();

    for (const item of dto.items) {
      // Tolerante a mayúsculas: suggest devuelve unidades base (GR/ML/UND)
      // y las UI pueden reenviarlas tal cual al proponer.
      const def = INPUT_UNIT_FACTORS[item.unit.toLowerCase()];
      if (!def) {
        throw new BadRequestException(`Unidad "${item.unit}" no válida`);
      }

      const product = await this.productModel
        .findOne({ _id: item.productId })
        .lean();
      if (!product) {
        throw new NotFoundException(`Insumo ${item.productId} no encontrado`);
      }

      const baseUnit = baseUnitOf(product.presentation ?? 'Unidad');
      if (def.base !== baseUnit) {
        throw new BadRequestException(
          `Unidad "${item.unit}" incompatible con ${product.name} (base ${baseUnit})`,
        );
      }

      const baseQty = roundQty(item.quantity * def.factor);

      const key = item.productId;
      const existing = proposedMap.get(key);
      if (existing) {
        existing.qty += baseQty;
        // Mantener la estación del primer propositor
      } else {
        proposedMap.set(key, { qty: baseQty, station: dto.station });
      }
    }

    // Fusionar con items existentes o agregar nuevos
    for (const [productId, { qty, station }] of proposedMap) {
      const product = await this.productModel
        .findOne({ _id: productId })
        .lean();
      if (!product) continue;

      const baseUnit = baseUnitOf(product.presentation ?? 'Unidad');
      let lastCost: number | undefined;
      try {
        const priceRecord = await this.priceHistory.lastCost(productId);
        if (priceRecord) lastCost = priceRecord.unitCost;
      } catch (error) {
        // fallback
        if (error instanceof Error) {
          this.logger.warn(
            `No se pudo obtener histórico de precios para ${productId}: ${error.message}`,
          );
        }
      }
      if (!lastCost) {
        lastCost = costPerBaseUnit(
          product.cost,
          product.presentation ?? 'Unidad',
          product.presentationQuantity,
        );
      }

      const existingItemIndex = list.items.findIndex(
        (i) => i.productId === productId,
      );
      if (existingItemIndex >= 0) {
        // Consolidar: sumar cantidades
        list.items[existingItemIndex].suggestedQty += qty;
        if (!list.items[existingItemIndex].proposedByStation && station) {
          list.items[existingItemIndex].proposedByStation = station;
        }
      } else {
        // Nuevo item
        const newItem: SuggestedItem & {
          purchased: boolean;
          discarded: boolean;
          proposedByStation?: string;
        } = {
          productId,
          productName: product.name,
          suggestedQty: qty,
          unit: baseUnit,
          reason: 'MANUAL',
          lastCost,
          purchased: false,
          discarded: false,
          proposedByStation: station,
        };
        list.items.push(newItem);
      }
    }

    list.updatedAt = new Date();
    await list.save();
    return list;
  }

  /**
   * Implementa ShoppingListMarker: marca items como comprados.
   * Retorna temprano si productIds está vacío (lo llama purchases internamente).
   */
  async markPurchased(
    productIds: string[],
    purchaseId: string,
  ): Promise<{ marked: number; listId?: string }> {
    // Retorno temprano: sin productos a marcar
    if (!productIds || productIds.length === 0) {
      return { marked: 0 };
    }

    const op = await this.configs.obtener('operacion');
    const today = new Date();
    const weekStart = weekStartOf(today, op);

    // Buscar lista APROBADA de esta semana
    const list = await this.shoppingListModel.findOne({
      weekStart,
      status: 'APROBADA',
    });

    if (!list) {
      return { marked: 0 };
    }

    let marked = 0;
    for (const productId of productIds) {
      const item = list.items.find((i) => i.productId === productId);
      if (item && !item.discarded) {
        item.purchased = true;
        item.purchaseId = purchaseId;
        marked++;
      }
    }

    if (marked > 0) {
      list.updatedAt = new Date();
      await list.save();
    }

    return { marked, listId: list._id };
  }

  /**
   * Aprueba una lista (PROPUESTA → APROBADA).
   */
  async approve(listId: string, userId: string): Promise<ShoppingList> {
    const list = await this.shoppingListModel.findOne({ _id: listId });
    if (!list) {
      throw new NotFoundException(`Lista ${listId} no encontrada`);
    }

    if (list.status === 'CERRADA') {
      throw new BadRequestException('No se puede aprobar una lista cerrada');
    }

    list.status = 'APROBADA';
    list.approvedBy = userId;
    list.updatedAt = new Date();
    await list.save();

    // Cerrar lista anterior de semana pasada (si existe y está PROPUESTA o APROBADA)
    const prevWeekStart = new Date(
      list.weekStart.getTime() - 7 * 24 * 3600 * 1000,
    );
    const prevList = await this.shoppingListModel.findOne({
      weekStart: prevWeekStart,
      status: { $in: ['PROPUESTA', 'APROBADA'] },
    });

    if (prevList) {
      prevList.status = 'CERRADA';
      await prevList.save();
    }

    return list;
  }

  /**
   * Lista shopping lists con filtros opcionales.
   */
  async list(filters?: { area?: string; status?: string; limit?: number }) {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;

    return this.shoppingListModel
      .find(query)
      .sort({ weekStart: -1 })
      .limit(Math.min(filters?.limit ?? 50, 500))
      .lean();
  }

  /**
   * Obtiene una lista por ID.
   */
  async getById(id: string): Promise<ShoppingList> {
    const list = await this.shoppingListModel.findOne({ _id: id }).lean();
    if (!list) {
      throw new NotFoundException(`Lista ${id} no encontrada`);
    }
    return list as ShoppingList;
  }

  /**
   * Lista de la semana en curso (404 si no existe — las UIs lo tratan como "sin lista").
   */
  async getCurrent(): Promise<ShoppingList> {
    const op = await this.configs.obtener('operacion');
    const weekStart = weekStartOf(new Date(), op);
    const list = await this.shoppingListModel.findOne({ weekStart }).lean();
    if (!list) {
      throw new NotFoundException('No hay lista de compras esta semana');
    }
    return list as ShoppingList;
  }

  /**
   * Construye plan de compra por lugar con agrupación inteligente y narrativa IA.
   */
  async buildAiPlan(listId: string): Promise<ShoppingList> {
    // 1. Validar lista existe y no está cerrada
    const list = await this.shoppingListModel.findOne({ _id: listId });
    if (!list) {
      throw new NotFoundException(`Lista ${listId} no encontrada`);
    }

    if (list.status === 'CERRADA') {
      throw new BadRequestException(
        'No se puede generar plan para una lista cerrada',
      );
    }

    // 2. Filtrar items NO descartados
    const activeItems = list.items.filter((item) => !item.discarded);
    if (activeItems.length === 0) {
      list.aiPlanByPlace = [];
      list.aiSummary = null;
      list.updatedAt = new Date();
      await list.save();
      return list;
    }

    // 3. Obtener productIds únicos
    const productIds = activeItems.map((item) => item.productId);

    // 4. Obtener hints de mejores lugares y histórico
    const bestPlacesHints = await this.priceHistory.bestPlaces(productIds);
    const hintsMap = new Map(bestPlacesHints.map((h) => [h.productId, h]));

    // 4b. Batch: traer lastCost de todos los productos en una sola query
    const lastCostMap = await this.priceHistory.lastCostBatch(productIds);

    // 4c. Batch: traer suppliers únicos que aparecen en hints o lastCost
    const supplierIdsNeeded = new Set<string>();
    for (const hint of bestPlacesHints) {
      supplierIdsNeeded.add(hint.bestPlaceId);
    }
    for (const lastCostRecord of lastCostMap.values()) {
      supplierIdsNeeded.add(lastCostRecord.placeId);
    }

    let supplierMap = new Map<string, string>(); // placeId → name
    if (supplierIdsNeeded.size > 0) {
      const suppliers = await this.supplierModel
        .find({ _id: { $in: Array.from(supplierIdsNeeded) } })
        .lean();
      for (const supplier of suppliers) {
        supplierMap.set(supplier._id, supplier.name);
      }
    }

    // 5. Construir el plan: agrupar items por lugar
    interface PlaceGroup {
      placeId: string | null;
      placeName: string;
      items: Array<{
        productId: string;
        productName: string;
        qty: number;
        unit: BaseUnit;
        lastCost: number;
      }>;
      estimatedTotal: number;
      savingsVsWorst: number;
    }

    const placeGroups = new Map<string, PlaceGroup>(); // key: placeId || 'where-you-prefer'

    for (const item of activeItems) {
      const hint = hintsMap.get(item.productId);
      const lastCostRecord = lastCostMap.get(item.productId);
      const lastCost = lastCostRecord?.unitCost ?? 0;

      let assignedPlaceId: string | null = null;
      let assignedPlaceName = 'Donde prefieras';
      let costForThisItem = lastCost;

      if (hint) {
        // Producto tiene ≥2 lugares: asignar al mejor lugar
        assignedPlaceId = hint.bestPlaceId;
        costForThisItem = hint.bestCost;
      } else if (lastCostRecord) {
        // Histórico en un solo lugar (o solo último): asignar a ese lugar
        assignedPlaceId = lastCostRecord.placeId;
      }

      // Resolver nombre del lugar si existe (desde mapa precargado)
      if (assignedPlaceId) {
        assignedPlaceName =
          supplierMap.get(assignedPlaceId) ?? 'Donde prefieras';
      }

      // Crear o actualizar grupo del lugar
      const groupKey = assignedPlaceId || 'where-you-prefer';
      let group = placeGroups.get(groupKey);
      if (!group) {
        group = {
          placeId: assignedPlaceId,
          placeName: assignedPlaceName,
          items: [],
          estimatedTotal: 0,
          savingsVsWorst: 0,
        };
        placeGroups.set(groupKey, group);
      }

      // Agregar item al grupo
      const qty = item.adjustedQty ?? item.suggestedQty;
      group.items.push({
        productId: item.productId,
        productName: item.productName,
        qty,
        unit: item.unit as BaseUnit,
        lastCost: costForThisItem,
      });

      // Actualizar estimated total del grupo
      group.estimatedTotal += qty * costForThisItem;

      // Calcular ahorro si es hint (≥2 lugares)
      if (hint) {
        const savingPerUnit = hint.lastCost - hint.bestCost;
        group.savingsVsWorst += qty * savingPerUnit;
      }
    }

    // 6. Convertir mapa a array para respuesta
    const aiPlanByPlace: PlaceGroup[] = Array.from(placeGroups.values());

    // 7. Llamar DeepSeek para narrativa (graceful: si error, aiSummary queda null)
    const systemPrompt =
      'Eres el comprador del restaurante. Redacta el plan de compra por establecimiento, breve y accionable, con totales estimados y el ahorro.';
    const userPrompt = JSON.stringify(aiPlanByPlace, null, 2);

    const deepseekResult = await this.deepseek.complete(
      systemPrompt,
      userPrompt,
    );

    // 8. Actualizar lista
    list.aiPlanByPlace = aiPlanByPlace;
    list.aiSummary = deepseekResult.text ?? null;
    if (deepseekResult.error) {
      list.aiError = deepseekResult.error;
    } else {
      list.aiError = null;
    }
    list.updatedAt = new Date();
    await list.save();

    return list;
  }

  /**
   * Actualiza un item de la lista (ajustar cantidad, marcar comprado o descartar).
   */
  async updateItem(
    listId: string,
    productId: string,
    patch: { adjustedQty?: number; purchased?: boolean; discarded?: boolean },
  ): Promise<ShoppingList> {
    const list = await this.shoppingListModel.findOne({ _id: listId });
    if (!list) {
      throw new NotFoundException(`Lista ${listId} no encontrada`);
    }
    if (list.status === 'CERRADA') {
      throw new BadRequestException('No se puede modificar una lista cerrada');
    }

    const item = list.items.find((i) => i.productId === productId);
    if (!item) {
      throw new NotFoundException(`El insumo ${productId} no está en la lista`);
    }

    if (patch.adjustedQty !== undefined) {
      if (!Number.isFinite(patch.adjustedQty) || patch.adjustedQty < 0) {
        throw new BadRequestException('adjustedQty debe ser un número ≥ 0');
      }
      item.adjustedQty = patch.adjustedQty;
    }
    if (patch.purchased !== undefined) item.purchased = patch.purchased;
    if (patch.discarded !== undefined) item.discarded = patch.discarded;

    list.updatedAt = new Date();
    list.markModified('items');
    await list.save();
    return list;
  }
}
