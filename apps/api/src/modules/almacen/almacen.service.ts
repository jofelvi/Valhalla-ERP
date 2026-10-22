import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AlmacenDiario,
  AlmacenDiarioDocument,
} from './schemas/almacen-diario.schema';
import {
  AlmacenGeneral,
  AlmacenGeneralDocument,
} from './schemas/almacen-general.schema';
import { OpenDayDto } from './dto/open-day.dto';
import { ConfigsService } from '../configs/configs.service';
import { fechaDeCalendarioUtc } from '../../common/operacion/operacion.util';
import { CloseDayDto } from './dto/close-day.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { LinkOrderDto } from './dto/link-order.dto';
import { TransferToDailyDto } from './dto/transfer-to-daily.dto';

@Injectable()
export class AlmacenService {
  constructor(
    @InjectModel(AlmacenDiario.name)
    private almacenDiarioModel: Model<AlmacenDiarioDocument>,
    @InjectModel(AlmacenGeneral.name)
    private almacenGeneralModel: Model<AlmacenGeneralDocument>,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Clave del día de hoy: medianoche UTC del día calendario de la operación (configs/operacion).
   * Así la fecha no depende de la zona del servidor.
   */
  private async claveHoy(): Promise<Date> {
    return fechaDeCalendarioUtc(
      new Date(),
      await this.configs.obtener('operacion'),
    );
  }

  /** Clave de un día `YYYY-MM-DD` (o ISO): medianoche UTC de esa fecha calendario. */
  private claveDeFecha(fecha: string): Date {
    return new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  }

  /**
   * El dia abierto de hoy, o `null` si no lo hay. No hay dia abierto es el
   * estado NORMAL (el almacen diario lleva meses sin usarse), no un error: el
   * 404 de antes ensuciaba la consola de cada pantalla que lo consultaba. Los
   * tres lectores (pantalla de almacen, almacen diario y el enganche de la
   * orden) ya trataban la ausencia como `null`; el APK no lo usa.
   */
  async getActiveDay() {
    const today = await this.claveHoy();

    const almacen = await this.almacenDiarioModel
      .findOne({
        fecha: today,
        estado: 'abierto',
      })
      .lean()
      .exec();

    if (!almacen) return null;

    return { ...almacen, id: almacen._id };
  }

  async getDayByDate(fecha: string) {
    const date = this.claveDeFecha(fecha);

    const almacen = await this.almacenDiarioModel
      .findOne({ fecha: date })
      .lean()
      .exec();

    if (!almacen) {
      throw new NotFoundException(`No hay registro para la fecha ${fecha}`);
    }

    return { ...almacen, id: almacen._id };
  }

  async openDay(openDayDto: OpenDayDto) {
    const today = await this.claveHoy();

    const existing = await this.almacenDiarioModel
      .findOne({
        fecha: today,
        estado: 'abierto',
      })
      .lean()
      .exec();

    if (existing) {
      throw new BadRequestException('Ya existe un día abierto para hoy');
    }

    const almacen = new this.almacenDiarioModel({
      fecha: today,
      estado: 'abierto',
      horaApertura: new Date(),
      stockInicial: openDayDto.stockInicial || [],
      stockActual: openDayDto.stockInicial || [],
      movimientos: [],
      ventasRef: [],
      usuarioApertura: openDayDto.usuarioApertura,
      notas: openDayDto.notas,
    });

    const saved = await almacen.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async closeDay(fecha: string, closeDayDto: CloseDayDto) {
    const date = this.claveDeFecha(fecha);

    const almacen = await this.almacenDiarioModel
      .findOne({ fecha: date })
      .exec();

    if (!almacen) {
      throw new NotFoundException(`No hay registro para la fecha ${fecha}`);
    }

    almacen.estado = 'cerrado';
    almacen.horaCierre = new Date();
    almacen.usuarioCierre = closeDayDto.usuarioCierre;
    almacen.notas = closeDayDto.notas;

    const saved = await almacen.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async adjustStock(fecha: string, adjustStockDto: AdjustStockDto) {
    const date = this.claveDeFecha(fecha);

    const almacen = await this.almacenDiarioModel
      .findOne({ fecha: date, estado: 'abierto' })
      .exec();

    if (!almacen) {
      throw new NotFoundException(
        `No hay un día abierto para la fecha ${fecha}`,
      );
    }

    const movimiento = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tipo: adjustStockDto.tipo,
      productId: adjustStockDto.productId,
      cantidad: adjustStockDto.cantidad,
      timestamp: new Date(),
      motivo: adjustStockDto.motivo,
      usuario: adjustStockDto.usuario,
    };

    almacen.movimientos.push(movimiento);

    const stockIndex = almacen.stockActual.findIndex(
      (s) => s.productId === adjustStockDto.productId,
    );

    if (stockIndex >= 0) {
      almacen.stockActual[stockIndex].cantidad += adjustStockDto.cantidad;
    } else {
      almacen.stockActual.push({
        productId: adjustStockDto.productId,
        cantidad: adjustStockDto.cantidad,
      });
    }

    const saved = await almacen.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async linkOrder(fecha: string, linkOrderDto: LinkOrderDto) {
    const date = this.claveDeFecha(fecha);

    const almacen = await this.almacenDiarioModel
      .findOne({ fecha: date, estado: 'abierto' })
      .exec();

    if (!almacen) {
      throw new NotFoundException(
        `No hay un día abierto para la fecha ${fecha}`,
      );
    }

    almacen.ventasRef.push({
      orderId: linkOrderDto.orderId,
      timestamp: new Date(),
      total: linkOrderDto.total,
    });

    const saved = await almacen.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async getDefaultTemplate() {
    // Plantillas se guardan en la colección plantillas-stock
    // Por ahora retornar null si no hay
    const db = this.almacenDiarioModel.db;
    const col = db.collection('plantillas-stock');
    const template = await col.findOne({ isDefault: true });
    if (!template) return null;
    return { ...template, id: template._id };
  }

  async saveTemplate(data: {
    productos: unknown[];
    nombre: string;
    isDefault?: boolean;
    usuario?: string;
  }) {
    const db = this.almacenDiarioModel.db;
    const col = db.collection('plantillas-stock');
    if (data.isDefault) {
      await col.updateMany({}, { $set: { isDefault: false } });
    }
    const result = await col.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: result.insertedId, ...data };
  }

  async getGeneralInventory() {
    let almacen = await this.almacenGeneralModel.findOne().lean().exec();

    if (!almacen) {
      const newAlmacen = new this.almacenGeneralModel({
        productos: [],
      });
      const saved = await newAlmacen.save();
      const obj = saved.toObject();
      return { ...obj, id: String(obj._id) };
    }

    return { ...almacen, id: almacen._id };
  }

  async transferToDaily(transferToDailyDto: TransferToDailyDto) {
    const today = await this.claveHoy();

    let almacen = await this.almacenDiarioModel
      .findOne({
        fecha: today,
        estado: 'abierto',
      })
      .exec();

    if (!almacen) {
      almacen = new this.almacenDiarioModel({
        fecha: today,
        estado: 'abierto',
        horaApertura: new Date(),
        stockInicial: transferToDailyDto.productos || [],
        stockActual: transferToDailyDto.productos || [],
        movimientos: [],
        ventasRef: [],
      });
    } else {
      if (transferToDailyDto.productos) {
        for (const producto of transferToDailyDto.productos) {
          const index = almacen.stockActual.findIndex(
            (s) => s.productId === producto.productId,
          );
          if (index >= 0) {
            almacen.stockActual[index].cantidad += producto.cantidad;
          } else {
            almacen.stockActual.push(producto);
          }
        }
      }
    }

    const saved = await almacen.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }
}
