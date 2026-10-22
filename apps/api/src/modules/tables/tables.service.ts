import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Table, TableDocument } from './schemas/table.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import {
  ClaimTableDto,
  ReleaseTableDto,
  HeartbeatTableDto,
} from './dto/claim-table.dto';
import { PosGateway } from '../websockets/gateways/pos.gateway';
import { decideAutoRelease, TableSweepState } from './table-auto-release';

const ACTIVE_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY'];

// Los umbrales del auto-release viven en table-auto-release.ts (logica pura
// y testeada). Aqui solo queda cada cuanto corre el barrido.
const SWEEP_INTERVAL_MS = 30 * 1000;

function isReleaseAttempt(
  payload: Partial<UpdateTableDto> | UpdateTableStatusDto,
): boolean {
  const orderIdNull =
    payload.orderId === null || (payload as UpdateTableDto).orderId === null;
  const statusFree =
    payload.status === 'ISAVAILABLE' ||
    (payload as UpdateTableDto).isAvailable === true;
  return orderIdNull || statusFree;
}

@Injectable()
export class TablesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TablesService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Table.name) private tableModel: Model<TableDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly posGateway: PosGateway,
  ) {}

  onModuleInit() {
    // Cron ligero en proceso: barre mesas con claim expirado cada minuto.
    // Si la API corre en varias replicas, la operacion es idempotente —
    // el findOneAndUpdate atomico garantiza que solo una replica libera
    // efectivamente cada mesa.
    this.sweepTimer = setInterval(
      () => void this.releaseExpiredClaims(),
      SWEEP_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private async findActiveOrderInTable(
    tableId: string,
    excludeOrderId?: string,
  ) {
    const query: Record<string, unknown> = {
      tableId,
      status: { $in: ACTIVE_ORDER_STATUSES },
      isDeleted: { $ne: true },
    };
    if (excludeOrderId) {
      query._id = { $ne: excludeOrderId };
    }
    return this.orderModel.findOne(query).lean().exec();
  }

  private async safeApplyUpdate(
    id: string,
    desiredUpdate: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const wantsRelease = isReleaseAttempt(
      desiredUpdate as unknown as UpdateTableStatusDto,
    );

    if (!wantsRelease) return desiredUpdate;

    const other = await this.findActiveOrderInTable(id);
    if (!other) return desiredUpdate;

    this.logger.warn(
      `Bloqueado intento de liberar mesa ${id}: orden activa ${String(other._id)} ` +
        `(status=${other.status}, mesa seguira OCUPADA).`,
    );

    return {
      status: 'OCCUPIED',
      isAvailable: false,
      orderId: String(other._id),
    };
  }

  async create(createTableDto: CreateTableDto) {
    const table = await this.tableModel.create(createTableDto);
    const obj = table.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyTableUpdated(result);
    return result;
  }

  async findAll(status?: string) {
    let query = this.tableModel.find();
    if (status) {
      query = query.where('status').equals(status);
    }
    const tables = await query.lean().exec();
    return tables.map((table) => ({ ...table, id: table._id }));
  }

  async findById(id: string) {
    const table = await this.tableModel.findOne({ _id: id }).lean().exec();
    if (!table) {
      throw new NotFoundException(`Mesa con id ${id} no encontrada`);
    }
    return { ...table, id: table._id };
  }

  async update(id: string, updateTableDto: UpdateTableDto) {
    const patch = await this.safeApplyUpdate(
      id,
      updateTableDto as unknown as Record<string, unknown>,
    );
    const table = await this.tableModel
      .findOneAndUpdate({ _id: id }, patch, { new: true })
      .lean()
      .exec();

    if (!table) {
      throw new NotFoundException(`Mesa con id ${id} no encontrada`);
    }

    const result = { ...table, id: table._id };
    this.posGateway.notifyTableUpdated(result);
    return result;
  }

  async updateStatus(id: string, updateTableStatusDto: UpdateTableStatusDto) {
    const patch = await this.safeApplyUpdate(
      id,
      updateTableStatusDto as unknown as Record<string, unknown>,
    );
    const table = await this.tableModel
      .findOneAndUpdate({ _id: id }, patch, { new: true })
      .lean()
      .exec();

    if (!table) {
      throw new NotFoundException(`Mesa con id ${id} no encontrada`);
    }

    const result = { ...table, id: table._id };
    this.posGateway.notifyTableUpdated(result);
    return result;
  }

  async softDelete(id: string) {
    const table = await this.tableModel
      .findOneAndUpdate(
        { _id: id },
        { isAvailable: false, status: 'ISAVAILABLE', orderId: null },
        { new: true },
      )
      .lean()
      .exec();

    if (!table) {
      throw new NotFoundException(`Mesa con id ${id} no encontrada`);
    }

    const result = { ...table, id: table._id };
    this.posGateway.notifyTableUpdated(result);
    return result;
  }

  /**
   * Reserva una mesa para un mesonero antes de crear la orden. Atomico:
   * solo gana si la mesa esta libre (isAvailable:true) o ya estaba tomada
   * por el MISMO mesonero sin orden (idempotente al re-entrar en la
   * pantalla de CreateOrder). Si el mismo waiter tenia claim en otra
   * mesa sin orden, se libera esa primero.
   */
  async claim(id: string, dto: ClaimTableDto) {
    // Nota: NO liberamos automaticamente otras mesas del mismo waiter
    // que puedan estar claimed sin orden. El cliente es quien sabe si
    // tiene productos en progreso en esa otra mesa y debe decidir
    // (descartar y liberar, o volver alli). Si el cliente llega aqui,
    // asumimos que ya tomo esa decision.

    const now = new Date();
    const claimed = await this.tableModel
      .findOneAndUpdate(
        {
          _id: id,
          $or: [
            { isAvailable: true },
            {
              isAvailable: false,
              claimedBy: dto.waiterId,
              orderId: null,
            },
          ],
        },
        {
          status: 'OCCUPIED',
          isAvailable: false,
          orderId: null,
          claimedBy: dto.waiterId,
          claimedByName: dto.waiterName ?? null,
          claimedAt: now,
          lastHeartbeatAt: null,
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!claimed) {
      const current = await this.tableModel.findOne({ _id: id }).lean().exec();
      if (!current) {
        throw new NotFoundException(`Mesa con id ${id} no encontrada`);
      }
      if (current.orderId) {
        throw new BadRequestException(
          'La mesa ya tiene una orden activa. No se puede reservar.',
        );
      }
      if (current.claimedBy && current.claimedBy !== dto.waiterId) {
        throw new BadRequestException(
          `La mesa la esta atendiendo ${current.claimedByName ?? 'otro mesonero'}.`,
        );
      }
      throw new BadRequestException('La mesa no esta disponible.');
    }

    const result = { ...claimed, id: claimed._id };
    this.posGateway.notifyTableUpdated(result);
    return result;
  }

  /**
   * Libera una mesa que el mesonero tenia reservada sin orden. Solo
   * libera si el waiterId coincide y NO hay orden — evita pisar mesas
   * que ya avanzaron a tener orden activa.
   */
  async release(id: string, dto: ReleaseTableDto) {
    const released = await this.tableModel
      .findOneAndUpdate(
        {
          _id: id,
          claimedBy: dto.waiterId,
          orderId: null,
        },
        {
          status: 'ISAVAILABLE',
          isAvailable: true,
          claimedBy: null,
          claimedByName: null,
          claimedAt: null,
          lastHeartbeatAt: null,
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!released) {
      // Idempotente: no fue el dueno, o ya se convirtio en orden.
      // Devolver el estado actual sin error.
      const current = await this.tableModel.findOne({ _id: id }).lean().exec();
      if (!current) {
        throw new NotFoundException(`Mesa con id ${id} no encontrada`);
      }
      return { ...current, id: current._id };
    }

    const result = { ...released, id: released._id };
    this.posGateway.notifyTableUpdated(result);
    return result;
  }

  /**
   * Renueva el timestamp de claim. El cliente lo invoca mientras el
   * mesonero esta en la pantalla de armado de pedido.
   */
  async heartbeat(id: string, dto: HeartbeatTableDto) {
    const updated = await this.tableModel
      .findOneAndUpdate(
        {
          _id: id,
          claimedBy: dto.waiterId,
          orderId: null,
        },
        // lastHeartbeatAt (no claimedAt): claimedAt queda como inicio del
        // claim para poder aplicar el tope absoluto de 30 min
        { lastHeartbeatAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      const current = await this.tableModel.findOne({ _id: id }).lean().exec();
      if (!current) {
        throw new NotFoundException(`Mesa con id ${id} no encontrada`);
      }
      // El heartbeat no dispara WS update (solo toca claimedAt).
      return { ...current, id: current._id };
    }

    return { ...updated, id: updated._id };
  }

  /**
   * Barrido periodico: libera mesas cuyo claim expiro (5 min sin heartbeat
   * ni orden). Atomico por mesa.
   */
  private async releaseExpiredClaims(): Promise<void> {
    try {
      const now = Date.now();

      // Todas las mesas bloqueadas (rojas en el POS). Son pocas decenas, asi
      // que se evaluan en memoria con la logica pura — eso permite cubrir los
      // estados que la query vieja no veia: ocupada sin claim, creacion de
      // orden atascada y orderId apuntando a una orden que ya no existe.
      const blocked = await this.tableModel
        .find({
          $or: [
            { isAvailable: false },
            { status: 'OCCUPIED' },
            { orderId: { $nin: [null] } },
          ],
        })
        .lean()
        .exec();

      if (blocked.length === 0) return;

      // ¿Cuales de esas mesas tienen una orden REAL detras? (intocables)
      const orderIds = blocked
        .map((t) => t.orderId)
        .filter((id): id is string => !!id && id !== 'PENDING_ORDER_CREATION');
      const liveOrderIds = new Set<string>();
      if (orderIds.length > 0) {
        const orders = await this.orderModel
          .find({
            _id: { $in: orderIds },
            status: { $ne: 'CANCELLED' },
            isDeleted: { $ne: true },
          })
          .select('_id')
          .lean()
          .exec();
        orders.forEach((o) => liveOrderIds.add(String(o._id)));
      }

      for (const t of blocked) {
        const reason = decideAutoRelease(t as TableSweepState, {
          hasRealOrder: !!t.orderId && liveOrderIds.has(String(t.orderId)),
          now,
        });
        if (!reason) continue;

        // Guarda optimista: si alguien reclamo o creo orden entre la lectura
        // y esta escritura, el update no aplica y la mesa queda intacta.
        const released = await this.tableModel
          .findOneAndUpdate(
            {
              _id: t._id,
              orderId: t.orderId ?? null,
              claimedBy: t.claimedBy ?? null,
            },
            {
              status: 'ISAVAILABLE',
              isAvailable: true,
              orderId: null,
              claimedBy: null,
              claimedByName: null,
              claimedAt: null,
              lastHeartbeatAt: null,
            },
            { new: true },
          )
          .lean()
          .exec();

        if (released) {
          this.logger.log(
            `Auto-release mesa ${t.name ?? String(t._id)} — motivo: ${reason}` +
              (t.claimedByName ? ` (claim de ${t.claimedByName})` : ''),
          );
          this.posGateway.notifyTableUpdated({ ...released, id: released._id });
        }
      }
    } catch (err) {
      this.logger.error('Error en releaseExpiredClaims', err as Error);
    }
  }
}
