import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InventoryCount,
  InventoryCountDocument,
  CountItemResult,
} from './schemas/inventory-count.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { MovementsService } from './movements.service';
import { CreateCountDto } from './dto/create-count.dto';
import {
  baseUnitOf,
  toBaseQty,
  costPerBaseUnit,
  roundQty,
  roundMoney,
  IncompatibleUnitError,
} from './units';

@Injectable()
export class CountsService {
  constructor(
    @InjectModel(InventoryCount.name)
    private countModel: Model<InventoryCountDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
    private readonly movementsService: MovementsService,
  ) {}

  async createAndConfirm(
    dto: CreateCountDto,
    userId: string,
  ): Promise<InventoryCount & { id: string }> {
    if (!dto.items?.length) {
      throw new BadRequestException('El conteo no tiene items');
    }

    const results: CountItemResult[] = [];
    const largeDiffs: string[] = [];
    const baseUnitByProduct = new Map<string, string>();

    for (const item of dto.items) {
      const product = await this.productModel
        .findOne({ _id: item.productId })
        .lean();
      if (!product) {
        throw new NotFoundException(`Insumo ${item.productId} no existe`);
      }
      const baseUnit = baseUnitOf(product.presentation ?? 'Unidad');
      baseUnitByProduct.set(item.productId, baseUnit);
      let countedQty: number;
      try {
        countedQty = toBaseQty(item.quantity, item.unit, baseUnit);
      } catch (err) {
        if (err instanceof IncompatibleUnitError) {
          throw new BadRequestException(
            `Unidad incompatible en el conteo de "${product.name}": ${item.unit} (base ${baseUnit})`,
          );
        }
        throw err;
      }
      const systemQty =
        dto.type === 'INICIAL'
          ? 0
          : await this.movementsService.getStockFor(
              dto.warehouseId,
              item.productId,
            );
      const diff = roundQty(countedQty - systemQty);
      const unitCost = costPerBaseUnit(
        product.cost,
        product.presentation ?? 'Unidad',
        product.presentationQuantity ?? 1,
      );

      if (
        dto.type !== 'INICIAL' &&
        systemQty > 0 &&
        Math.abs(diff) / systemQty > 0.5 &&
        !dto.confirmLargeDiffs
      ) {
        largeDiffs.push(
          `${product.name}: sistema ${systemQty}, contado ${countedQty}`,
        );
      }

      results.push({
        productId: item.productId,
        productName: product.name,
        systemQty,
        countedQty,
        diff,
        baseUnit,
        unitCost,
        diffCost: roundMoney(diff * unitCost),
      });
    }

    if (largeDiffs.length > 0) {
      throw new BadRequestException(
        `Diferencias mayores al 50% del stock — probable error de unidad. Revisa y reenvía con confirmLargeDiffs: true. Items: ${largeDiffs.join(' · ')}`,
      );
    }

    // Emitir movimientos por cada diff ≠ 0
    const count = await this.countModel.create({
      warehouseId: dto.warehouseId,
      type: dto.type,
      items: results,
      totalDiffCost: roundMoney(results.reduce((s, r) => s + r.diffCost, 0)),
      countedBy: userId,
      confirmedAt: new Date(),
    });

    // ── Línea base del almacén ──
    // Un conteo INICIAL es el momento en que el stock del sistema deja de ser
    // una suposición. Hasta que esto exista, el POS avisa "inventario no
    // cargado" en vez de "agotado": Cocina lleva la Papa en −13.776 g porque
    // nunca se contó, no porque falte, y gritar "agotado" ahí sería mentirle
    // al mesonero en cada plato.
    if (dto.type === 'INICIAL') {
      await this.warehouseModel
        .updateOne(
          { _id: dto.warehouseId },
          { $set: { baselineAt: new Date() } },
        )
        .exec();
    }

    for (const r of results) {
      if (r.diff === 0) continue;
      await this.movementsService.emit({
        type: dto.type === 'INICIAL' ? 'CONTEO_INICIAL' : 'CONTEO_AJUSTE',
        warehouseId: dto.warehouseId,
        productId: r.productId,
        qty: r.diff,
        baseUnit: (baseUnitByProduct.get(r.productId) ?? 'UND') as
          | 'GR'
          | 'ML'
          | 'UND',
        unitCost: r.unitCost,
        refType: 'count',
        refId: String(count._id),
        userId,
      });
    }

    const obj = count.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async list(warehouseId?: string) {
    const q = warehouseId ? { warehouseId } : {};
    const rows = await this.countModel
      .find(q)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return rows.map((r) => ({ ...r, id: String(r._id) }));
  }
}
