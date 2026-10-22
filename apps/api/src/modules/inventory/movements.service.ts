import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  InventoryMovement,
  InventoryMovementDocument,
  MovementType,
} from './schemas/inventory-movement.schema';
import {
  WarehouseStock,
  WarehouseStockDocument,
} from './schemas/warehouse-stock.schema';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import {
  BaseUnit,
  InventoryArea,
  roundQty,
  roundMoney,
  roundUnitCost,
  baseUnitOf,
  toBaseQty,
  conversionOf,
  costPerBaseUnit,
  IncompatibleUnitError,
} from './units';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { TransferDto } from './dto/transfer.dto';
import { DeclareWasteDto } from './dto/declare-waste.dto';
import { areaDeEstacion } from './station-scope.util';
import { homeAreaOf } from './home-warehouse.util';

// La casa de un producto casi nunca cambia: 60 s evita una consulta por cada
// ingrediente de cada venta sin dejar un cambio de estación colgado mucho rato.
const HOME_CACHE_MS = 60_000;

export type TransferResult =
  | { unified: false; out: InventoryMovementLean; in: InventoryMovementLean }
  // Stock unificado: origen y destino son la misma casa, no se mueve nada.
  | { unified: true; out: null; in: null };

export interface EmitMovementInput {
  type: MovementType;
  warehouseId: string;
  productId: string;
  qty: number; // + entra / − sale, en unidad base
  baseUnit: BaseUnit;
  unitCost: number;
  refType?: 'order' | 'purchase' | 'count' | 'waste' | 'transfer' | 'movement';
  refId?: string;
  // Item de la orden que originó el consumo (descuento en vivo al entregar)
  refItemId?: string;
  counterpartWarehouseId?: string;
  notes?: string;
  userId: string;
}

export type InventoryMovementLean = InventoryMovement & {
  id: string;
  createdAt?: Date;
};

export interface MovementFilters {
  warehouseId?: string;
  productId?: string;
  type?: MovementType;
  refId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

@Injectable()
export class MovementsService {
  constructor(
    @InjectModel(InventoryMovement.name)
    private movementModel: Model<InventoryMovementDocument>,
    @InjectModel(WarehouseStock.name)
    private stockModel: Model<WarehouseStockDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
  ) {}

  private readonly homeAreaCache = new Map<
    string,
    { area: InventoryArea | null; at: number }
  >();
  private readonly areaWarehouseCache = new Map<
    InventoryArea,
    { id: string | null; at: number }
  >();

  /** Vacía las cachés de casa (tests, o tras cambiar almacenes default). */
  resetHomeCache(): void {
    this.homeAreaCache.clear();
    this.areaWarehouseCache.clear();
  }

  /**
   * Almacén donde vive el stock del producto (el default activo del área de su
   * estación), o null si no aplica: producto sin estación, área sin almacén
   * default, o `STOCK_UNIFICADO=0` (interruptor para volver atrás sin deploy).
   */
  async homeWarehouseIdFor(productId: string): Promise<string | null> {
    if (process.env.STOCK_UNIFICADO === '0') return null;
    const now = Date.now();

    let areaHit = this.homeAreaCache.get(productId);
    if (!areaHit || now - areaHit.at > HOME_CACHE_MS) {
      const product = await this.productModel
        .findOne({ _id: productId }, { station: 1 })
        .lean();
      areaHit = { area: product ? homeAreaOf(product) : null, at: now };
      this.homeAreaCache.set(productId, areaHit);
    }
    if (!areaHit.area) return null;
    return this.warehouseIdDeArea(areaHit.area);
  }

  /** Almacén por defecto y activo de un área (BARRA, COCINA…), o null si no hay ninguno. */
  async warehouseIdDeArea(area: InventoryArea): Promise<string | null> {
    const now = Date.now();
    let whHit = this.areaWarehouseCache.get(area);
    if (!whHit || now - whHit.at > HOME_CACHE_MS) {
      const wh = await this.warehouseModel
        .findOne({ area, isDefault: true, isActive: true }, { _id: 1 })
        .lean();
      whHit = { id: wh ? String(wh._id) : null, at: now };
      this.areaWarehouseCache.set(area, whHit);
    }
    return whHit.id;
  }

  async emit(input: EmitMovementInput): Promise<InventoryMovementLean> {
    if (!Number.isFinite(input.qty) || input.qty === 0) {
      throw new BadRequestException(
        'La cantidad del movimiento debe ser un número distinto de 0',
      );
    }
    const qty = roundQty(input.qty);
    const unitCost = roundUnitCost(input.unitCost ?? 0);
    // Stock unificado: toda escritura (compra, conteo, merma, venta, producción,
    // anulación, tobo) va a la casa del producto, elija lo que elija el cliente.
    // Así los APK y la web viejos quedan corregidos sin actualizar nada.
    const warehouseId =
      (await this.homeWarehouseIdFor(input.productId)) ?? input.warehouseId;
    const created = await this.movementModel.create({
      ...input,
      warehouseId,
      qty,
      unitCost,
      totalCost: roundMoney(qty * unitCost),
    });

    // Snapshot incremental (upsert atómico)
    await this.stockModel.updateOne(
      { warehouseId, productId: input.productId },
      {
        $inc: { qty },
        $setOnInsert: { baseUnit: input.baseUnit },
      },
      { upsert: true },
    );

    const obj = created.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async getStock(warehouseId: string): Promise<
    Array<{
      productId: string;
      qty: number;
      baseUnit: BaseUnit;
      productName?: string;
      isActive?: boolean;
    }>
  > {
    const rows = await this.stockModel.find({ warehouseId }).lean();
    if (!rows.length) return [];

    // Batch lookup products to enrich with name and active status (no N+1)
    const productIds = rows.map((r) => r.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds } }, { name: 1, isActive: 1 })
      .lean();
    const productById = new Map(products.map((p) => [String(p._id), p]));

    return rows.map((r) => {
      const product = productById.get(String(r.productId));
      return {
        productId: r.productId,
        qty: roundQty(r.qty),
        baseUnit: r.baseUnit,
        productName: product?.name,
        isActive: product?.isActive,
      };
    });
  }

  async getStockFor(warehouseId: string, productId: string): Promise<number> {
    const row = await this.stockModel
      .findOne({ warehouseId, productId })
      .lean();
    return roundQty(row?.qty ?? 0);
  }

  // Insumos disponibles para una ESTACION (barra/cocina/pizza): stock del
  // almacen default de su area, enriquecido con nombre del producto. Para que
  // la estacion vea "que hay" antes de despachar.
  async getAvailableByStation(
    station: string,
  ): Promise<
    Array<{ productId: string; productName: string; qty: number; unit: string }>
  > {
    const area = areaDeEstacion(station);
    if (area === 'GENERAL') return [];
    const wh = await this.warehouseModel
      .findOne({ area, isActive: true })
      .sort({ isDefault: -1 })
      .lean();
    if (!wh) return [];
    const stock = await this.getStock(String(wh._id));
    if (!stock.length) return [];
    const products = await this.productModel
      .find(
        { _id: { $in: stock.map((s) => s.productId) } },
        { name: 1, isActive: 1 },
      )
      .lean();
    const pById = new Map(products.map((p) => [String(p._id), p]));
    return stock
      .map((s) => {
        const p = pById.get(String(s.productId));
        return {
          productId: s.productId,
          productName: p?.name ?? s.productId,
          qty: s.qty,
          unit: s.baseUnit,
          active: p?.isActive !== false,
        };
      })
      .filter((r) => r.active)
      .map(({ active: _active, ...r }) => r)
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }

  async list(filters: MovementFilters): Promise<InventoryMovementLean[]> {
    const q: FilterQuery<InventoryMovementDocument> = {};
    if (filters.warehouseId) q.warehouseId = filters.warehouseId;
    if (filters.productId) q.productId = filters.productId;
    if (filters.type) q.type = filters.type;
    if (filters.refId) q.refId = filters.refId;
    if (filters.from || filters.to) {
      q.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    const rows = await this.movementModel
      .find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(filters.limit ?? 200, 1000))
      .lean();
    return rows.map((r) => ({ ...r, id: String(r._id) }));
  }

  async annul(
    movementId: string,
    userId: string,
    notes: string,
  ): Promise<InventoryMovementLean> {
    const original = await this.movementModel
      .findOne({ _id: movementId })
      .lean();
    if (!original) {
      throw new NotFoundException(`Movimiento ${movementId} no existe`);
    }
    const alreadyAnnulled = await this.movementModel
      .findOne({ type: 'ANULACION', refId: movementId })
      .lean();
    if (alreadyAnnulled) {
      throw new BadRequestException('Este movimiento ya fue anulado');
    }
    return this.emit({
      type: 'ANULACION',
      warehouseId: original.warehouseId,
      productId: original.productId,
      qty: -original.qty,
      baseUnit: original.baseUnit,
      unitCost: original.unitCost,
      refType: 'movement',
      refId: movementId,
      notes,
      userId,
    });
  }

  /** Convierte una cantidad ingresada por el usuario a la unidad base del insumo. */
  private async resolveProductQty(
    productId: string,
    quantity: number,
    unit: string,
  ): Promise<{ qtyBase: number; baseUnit: BaseUnit; unitCost: number }> {
    const product = await this.productModel.findOne({ _id: productId }).lean();
    if (!product) {
      throw new NotFoundException(`Insumo ${productId} no existe`);
    }
    const baseUnit = baseUnitOf(product.presentation ?? 'Unidad');
    let qtyBase: number;
    try {
      qtyBase = toBaseQty(quantity, unit, baseUnit, conversionOf(product));
    } catch (err) {
      if (err instanceof IncompatibleUnitError) {
        throw new BadRequestException(
          `Unidad incompatible: "${unit}" para el insumo "${product.name}" (base ${baseUnit}).`,
        );
      }
      throw err;
    }
    return {
      qtyBase,
      baseUnit,
      unitCost: costPerBaseUnit(
        product.cost,
        product.presentation ?? 'Unidad',
        product.presentationQuantity ?? 1,
      ),
    };
  }

  async transfer(dto: TransferDto, userId: string): Promise<TransferResult> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Origen y destino deben ser distintos');
    }

    // Validar que ambos almacenes existan
    const [fromWh, toWh] = await Promise.all([
      this.warehouseModel.findOne({ _id: dto.fromWarehouseId }).lean(),
      this.warehouseModel.findOne({ _id: dto.toWarehouseId }).lean(),
    ]);
    if (!fromWh || !toWh) {
      throw new NotFoundException(
        `Almacén ${!fromWh ? dto.fromWarehouseId : dto.toWarehouseId} no existe`,
      );
    }

    // Con stock unificado las dos puntas caerían en la misma casa: el traspaso
    // no tiene nada que mover. No es error, para que la aprobación de "pedir
    // insumo" de las estaciones siga funcionando.
    if (await this.homeWarehouseIdFor(dto.productId)) {
      return { unified: true, out: null, in: null };
    }

    const { qtyBase, baseUnit, unitCost } = await this.resolveProductQty(
      dto.productId,
      dto.quantity,
      dto.unit,
    );

    // Verificar si quedaría stock negativo y registrar advertencia
    const originStock = await this.getStockFor(
      dto.fromWarehouseId,
      dto.productId,
    );
    const negativeWarning =
      originStock < qtyBase
        ? ` | ADVERTENCIA: stock del sistema quedaba en ${roundQty(originStock - qtyBase)} (origen tenía ${originStock})`
        : '';
    const notes = `${dto.notes ?? ''}${negativeWarning}`.trim() || undefined;

    const outMove = await this.emit({
      type: 'TRASLADO',
      warehouseId: dto.fromWarehouseId,
      productId: dto.productId,
      qty: -qtyBase,
      baseUnit,
      unitCost,
      refType: 'transfer',
      counterpartWarehouseId: dto.toWarehouseId,
      notes,
      userId,
    });
    const inMove = await this.emit({
      type: 'TRASLADO',
      warehouseId: dto.toWarehouseId,
      productId: dto.productId,
      qty: qtyBase,
      baseUnit,
      unitCost,
      refType: 'transfer',
      refId: outMove.id,
      counterpartWarehouseId: dto.fromWarehouseId,
      notes,
      userId,
    });
    return { unified: false, out: outMove, in: inMove };
  }

  async declareWaste(
    dto: DeclareWasteDto,
    userId: string,
  ): Promise<InventoryMovementLean> {
    const { qtyBase, baseUnit, unitCost } = await this.resolveProductQty(
      dto.productId,
      dto.quantity,
      dto.unit,
    );
    return this.emit({
      type: 'MERMA_DECLARADA',
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      qty: -qtyBase,
      baseUnit,
      unitCost,
      refType: 'waste',
      notes: `${dto.reason} | foto: ${dto.photoUrl}${dto.notes ? ` | ${dto.notes}` : ''}`,
      userId,
    });
  }

  /** Re-suma el ledger y corrige snapshots desviados. Devuelve cuántos corrigió. */
  async reconcile(warehouseId: string): Promise<{ fixed: number }> {
    const sums = await this.movementModel.aggregate<{
      _id: string;
      total: number;
      baseUnit: BaseUnit;
    }>([
      { $match: { warehouseId } },
      {
        $group: {
          _id: '$productId',
          total: { $sum: '$qty' },
          baseUnit: { $first: '$baseUnit' },
        },
      },
    ]);
    let fixed = 0;
    for (const s of sums) {
      const current = await this.stockModel
        .findOne({ warehouseId, productId: s._id })
        .lean();
      const expected = roundQty(s.total);
      if (!current || roundQty(current.qty) !== expected) {
        await this.stockModel.updateOne(
          { warehouseId, productId: s._id },
          { $set: { qty: expected, baseUnit: s.baseUnit } },
          { upsert: true },
        );
        fixed++;
      }
    }
    const ledgerProductIds = sums.map((s) => s._id);
    const orphanResult = await this.stockModel.deleteMany({
      warehouseId,
      productId: { $nin: ledgerProductIds },
    });
    return { fixed: fixed + orphanResult.deletedCount };
  }
}
