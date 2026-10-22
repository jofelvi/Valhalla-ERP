import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InsumoRequest,
  InsumoRequestDocument,
} from './schemas/insumo-request.schema';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { CreateInsumoRequestDto } from './dto/create-insumo-request.dto';
import { MovementsService } from './movements.service';
import { planProduction } from './production.helper';
import type { ProductForRecipeCost } from './recipe-cost.helper';
import type { BaseUnit } from './units';
import { areaDeEstacion } from './station-scope.util';

type Actor = { id?: string; name?: string; role?: string } | undefined;

@Injectable()
export class InsumoRequestsService {
  constructor(
    @InjectModel(InsumoRequest.name)
    private reqModel: Model<InsumoRequestDocument>,
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
    // Catalogo: hace falta para expandir la receta de lo que se elabora.
    @InjectModel('Product')
    private productModel: Model<ProductForRecipeCost>,
    private readonly movements: MovementsService,
  ) {}

  // station (BAR/KITCHEN/PIZZA) → area de inventario del almacén destino.
  private areaFor(station: string): string {
    const area = areaDeEstacion(station);
    return area === 'GENERAL' ? 'COCINA' : area;
  }

  private assertAdmin(user: Actor) {
    const role = String(user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') {
      throw new ForbiddenException(
        'Solo un administrador o gerente puede resolver solicitudes',
      );
    }
  }

  private async defaultWarehouse(area: string) {
    return this.warehouseModel
      .findOne({ area, isActive: true })
      .sort({ isDefault: -1 })
      .lean();
  }

  async create(dto: CreateInsumoRequestDto, user: Actor) {
    const type = dto.type ?? 'TRASLADO';
    if (type === 'ALTA_INSUMO' && !dto.proposedProduct?.name) {
      throw new BadRequestException(
        'Para dar de alta un insumo hay que decir al menos su nombre',
      );
    }
    if (type !== 'ALTA_INSUMO' && !dto.items?.length) {
      throw new BadRequestException('La solicitud no tiene renglones');
    }

    const created = await this.reqModel.create({
      station: dto.station.toUpperCase(),
      type,
      items: dto.items ?? [],
      proposedProduct: dto.proposedProduct,
      note: dto.note,
      status: 'PENDING',
      requestedById: user?.id ?? 'desconocido',
      requestedByName: user?.name,
    });
    return created.toObject();
  }

  /**
   * Vista previa de lo que pasaria al aprobar una produccion, SIN tocar nada:
   * la estacion ve que crudo va a descontar antes de enviar, y gerencia ve el
   * costo y los faltantes antes de autorizar.
   */
  async previewProduction(
    station: string,
    items: Array<{ productId: string; qty: number; unit?: string }>,
  ) {
    const to = await this.defaultWarehouse(this.areaFor(station));
    const productos = (await this.productModel
      .find(
        {},
        {
          name: 1,
          cost: 1,
          presentation: 1,
          presentationQuantity: 1,
          ingredients: 1,
          isForInventory: 1,
        },
      )
      .lean()
      .exec()) as unknown as ProductForRecipeCost[];
    const productById = new Map(productos.map((p) => [String(p._id), p]));

    const stockByProductId = new Map<string, number>();
    if (to) {
      const stock = (await this.movements.getStock(String(to._id))) as Array<{
        productId: string;
        qty: number;
      }>;
      for (const s of stock) {
        stockByProductId.set(String(s.productId), Number(s.qty) || 0);
      }
    }

    return items.map((it) =>
      planProduction(
        productById.get(it.productId),
        productById,
        it.qty,
        (it.unit as BaseUnit) ?? 'UND',
        stockByProductId,
      ),
    );
  }

  async list(status?: string) {
    const q: Record<string, unknown> = {};
    if (status) q.status = String(status).toUpperCase();
    return this.reqModel
      .find(q)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
  }

  async countPending(): Promise<number> {
    return this.reqModel.countDocuments({ status: 'PENDING' });
  }

  async approve(id: string, user: Actor) {
    this.assertAdmin(user);
    const req = await this.reqModel.findOne({ _id: id });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== 'PENDING') {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }

    // Las solicitudes viejas no traen `type`: son traslados, que era lo unico
    // que existia cuando se crearon.
    if (req.type === 'PRODUCCION') {
      return this.approveProduction(req, user);
    }
    if (req.type === 'ALTA_INSUMO') {
      throw new BadRequestException(
        'El alta de insumo se aprueba desde el catalogo: crea el producto (unidad, costo, criticidad y receta si es elaborado) y vincula la solicitud.',
      );
    }

    const from = await this.defaultWarehouse('GENERAL');
    const to = await this.defaultWarehouse(this.areaFor(req.station));
    if (!from) {
      throw new BadRequestException(
        'No hay almacén GENERAL (depósito) configurado',
      );
    }
    if (!to) {
      throw new BadRequestException(
        `No hay almacén configurado para ${req.station}`,
      );
    }

    // Transferir cada renglón del depósito a la estación.
    for (const it of req.items) {
      await this.movements.transfer(
        {
          fromWarehouseId: String(from._id),
          toWarehouseId: String(to._id),
          productId: it.productId,
          quantity: it.qty,
          unit: it.unit,
          notes: `Reposicion ${req.station} (solicitud ${String(req._id).slice(-6)})`,
        },
        user?.id ?? 'system',
      );
    }

    req.status = 'APPROVED';
    req.resolvedById = user?.id;
    req.resolvedByName = user?.name;
    req.resolvedAt = new Date();
    req.fromWarehouseId = String(from._id);
    req.toWarehouseId = String(to._id);
    await req.save();
    return req.toObject();
  }

  /**
   * Aprueba una produccion: entra el elaborado al almacen de la estacion y
   * sale el crudo segun la receta.
   *
   * El plan se calcula ANTES de tocar nada (planProduction) para poder
   * rechazar con un motivo util — "falta la receta de X" — en vez de dejar
   * media operacion hecha. Si el crudo no alcanza NO se bloquea: la masa ya
   * existe fisicamente; se registra y el faltante queda como aviso guardado.
   */
  private async approveProduction(req: InsumoRequestDocument, user: Actor) {
    const to = await this.defaultWarehouse(this.areaFor(req.station));
    if (!to) {
      throw new BadRequestException(
        `No hay almacén configurado para ${req.station}`,
      );
    }

    // Catalogo completo: la receta puede apuntar a insumos de otra estacion.
    const productos = (await this.productModel
      .find(
        {},
        {
          name: 1,
          cost: 1,
          presentation: 1,
          presentationQuantity: 1,
          ingredients: 1,
          isForInventory: 1,
        },
      )
      .lean()
      .exec()) as unknown as ProductForRecipeCost[];
    const productById = new Map(productos.map((p) => [String(p._id), p]));

    const stockActual = await this.movements.getStock(String(to._id));
    const stockByProductId = new Map<string, number>(
      (stockActual as Array<{ productId: string; qty: number }>).map((s) => [
        String(s.productId),
        Number(s.qty) || 0,
      ]),
    );

    const avisos: string[] = [];
    const planes = req.items.map((it) => {
      const plan = planProduction(
        productById.get(it.productId),
        productById,
        it.qty,
        (it.unit as BaseUnit) ?? 'UND',
        stockByProductId,
      );
      avisos.push(...plan.warnings);
      return plan;
    });

    const bloqueos = planes.flatMap((p) => p.blockers);
    if (bloqueos.length) {
      throw new BadRequestException(bloqueos.join(' · '));
    }

    for (const plan of planes) {
      // Entra el elaborado
      await this.movements.emit({
        type: 'PRODUCCION',
        warehouseId: String(to._id),
        productId: plan.output.productId,
        qty: plan.output.qty,
        baseUnit: plan.output.baseUnit,
        unitCost: plan.output.unitCost,
        refType: 'movement',
        refId: String(req._id),
        notes: `Produccion ${req.station} (solicitud ${String(req._id).slice(-6)})`,
        userId: user?.id ?? 'system',
      });
      // Sale el crudo
      for (const c of plan.consumptions) {
        await this.movements.emit({
          type: 'CONSUMO_PRODUCCION',
          warehouseId: String(to._id),
          productId: c.productId,
          qty: -c.qtyBase,
          baseUnit: c.baseUnit,
          unitCost: c.costPerBase,
          refType: 'movement',
          refId: String(req._id),
          notes: `Consumido al elaborar ${plan.output.productName}`,
          userId: user?.id ?? 'system',
        });
      }
    }

    req.status = 'APPROVED';
    req.resolvedById = user?.id;
    req.resolvedByName = user?.name;
    req.resolvedAt = new Date();
    req.toWarehouseId = String(to._id);
    if (avisos.length) req.warnings = avisos;
    await req.save();
    return req.toObject();
  }

  async reject(id: string, reason: string | undefined, user: Actor) {
    this.assertAdmin(user);
    const req = await this.reqModel.findOne({ _id: id });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== 'PENDING') {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }
    req.status = 'REJECTED';
    req.rejectionReason = reason;
    req.resolvedById = user?.id;
    req.resolvedByName = user?.name;
    req.resolvedAt = new Date();
    await req.save();
    return req.toObject();
  }
}
