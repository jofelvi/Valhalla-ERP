import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tip, TipDocument } from './schemas/tip.schema';
import { CreateTipDto } from './dto/create-tip.dto';
import { UpdateTipDto } from './dto/update-tip.dto';

@Injectable()
export class TipsService {
  private readonly logger = new Logger(TipsService.name);

  constructor(
    @InjectModel(Tip.name) private tipModel: Model<TipDocument>,
    @InjectModel('Order') private orderModel: Model<{ tipAmount?: number }>,
  ) {}

  /**
   * Registra la propina de una orden.
   *
   * ─── Una sola fuente ────────────────────────────────────────────────────
   * La propina vivia en dos lugares que no coincidian: esta coleccion (la
   * escribe la web al cobrar) y `order.tipAmount` (lo escribe el APK del
   * mesonero). 269 registros se pisaban, 25 diferian y varios tenian el doble
   * exacto — tips $2,17 contra tipAmount $1,09. Arbitrando contra lo que
   * realmente se cobro, `tips` acertaba 22 a 1, o sea que habia mesoneros
   * cobrando la mitad de su propina.
   *
   * Ahora `order.tipAmount` es la fuente de verdad y este metodo la escribe
   * en el mismo paso: una sola llamada, un solo dueño, imposible que se
   * separen. El registro en `tips` queda como historial por mesonero.
   *
   * Idempotente por orden: si ya hay propina registrada, se devuelve esa. Dos
   * clics no crean dos propinas (habia 9 grupos duplicados asi).
   */
  async create(createTipDto: CreateTipDto) {
    const orderId = createTipDto.orderId
      ? String(createTipDto.orderId)
      : undefined;

    if (orderId) {
      const existente = await this.tipModel.findOne({ orderId }).lean().exec();
      if (existente) {
        this.logger.warn(
          `Propina duplicada evitada: la orden ${orderId} ya tenia $${existente.amount} registrados`,
        );
        return { ...existente, id: String(existente._id) };
      }
    }

    const tip = await this.tipModel.create({
      ...createTipDto,
      createdAt: new Date(),
    });

    // La orden es la fuente de verdad: se actualiza en el mismo paso.
    if (orderId) {
      await this.orderModel
        .updateOne(
          { _id: orderId },
          { $set: { tipAmount: createTipDto.amount } },
        )
        .exec();
    }

    const obj = tip.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: {
    waiterId?: string;
    orderId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const query: Record<string, unknown> = {};

    if (filters?.waiterId) {
      query.waiterId = filters.waiterId;
    }

    // La pantalla de recibo necesita LA propina de UNA orden. Sin este filtro
    // se bajaba la coleccion entera para hacer un `.find()` en el navegador.
    if (filters?.orderId) {
      query.orderId = filters.orderId;
    }

    if (filters?.fromDate || filters?.toDate) {
      const rango: { $gte?: Date; $lte?: Date } = {};
      if (filters.fromDate) {
        rango.$gte = filters.fromDate;
      }
      if (filters.toDate) {
        rango.$lte = filters.toDate;
      }
      query.createdAt = rango;
    }

    const tips = await this.tipModel
      .find(query)
      .lean()
      .sort({ createdAt: -1 })
      .exec();
    return tips.map((tip) => ({ ...tip, id: tip._id }));
  }

  async findById(id: string) {
    const tip = await this.tipModel.findOne({ _id: id }).lean().exec();
    if (!tip) {
      throw new NotFoundException(`Tip with ID ${id} not found`);
    }
    return { ...tip, id: tip._id };
  }

  async update(id: string, updateTipDto: UpdateTipDto) {
    const tip = await this.tipModel
      .findOneAndUpdate(
        { _id: id },
        { ...updateTipDto, updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();
    if (!tip) {
      throw new NotFoundException(`Tip with ID ${id} not found`);
    }
    return { ...tip, id: tip._id };
  }

  async remove(id: string) {
    const tip = await this.tipModel.findOne({ _id: id }).exec();
    if (!tip) {
      throw new NotFoundException(`Tip with ID ${id} not found`);
    }

    await this.tipModel.deleteOne({ _id: id });
    return { message: 'Tip deleted successfully' };
  }
}
