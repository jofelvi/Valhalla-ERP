import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
} from './schemas/purchase-order.schema';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { ReceiveMerchandiseDto } from './dto/receive-merchandise.dto';
import { PurchaseOrderStatusEnum } from '@odin6/types';
import { PurchasesService } from '../inventory/purchases.service';
import { mapPurchaseOrderToCreatePurchaseDto } from './purchase-orders.util';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name)
    private purchaseOrderModel: Model<PurchaseOrderDocument>,
    private purchasesService: PurchasesService,
  ) {}

  async findAll(filters?: { supplierId?: string; status?: string }) {
    const query: Record<string, unknown> = {};

    if (filters?.supplierId) {
      query.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    const purchaseOrders = await this.purchaseOrderModel
      .find(query)
      .lean()
      .exec();
    return purchaseOrders.map((po) => ({ ...po, id: po._id }));
  }

  async findById(id: string) {
    const purchaseOrder = await this.purchaseOrderModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }
    return { ...purchaseOrder, id: purchaseOrder._id };
  }

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    const purchaseOrder = new this.purchaseOrderModel(createPurchaseOrderDto);
    const saved = await purchaseOrder.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    const purchaseOrder = await this.purchaseOrderModel
      .findOneAndUpdate({ _id: id }, updatePurchaseOrderDto, { new: true })
      .lean()
      .exec();

    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    return { ...purchaseOrder, id: purchaseOrder._id };
  }

  async changeStatus(id: string, changeStatusDto: ChangeStatusDto) {
    const purchaseOrder = await this.purchaseOrderModel
      .findOneAndUpdate(
        { _id: id },
        { status: changeStatusDto.status },
        { new: true },
      )
      .lean()
      .exec();

    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    return { ...purchaseOrder, id: purchaseOrder._id };
  }

  async receiveMerchandise(
    id: string,
    receiveMerchandiseDto: ReceiveMerchandiseDto,
  ) {
    const purchaseOrder = await this.purchaseOrderModel
      .findOne({ _id: id })
      .exec();

    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    // Idempotencia: si ya está recibida, no duplicar la compra
    if (purchaseOrder.status === PurchaseOrderStatusEnum.RECEIVED) {
      const obj = purchaseOrder.toObject();
      return { ...obj, id: String(obj._id) };
    }

    // Mapear orden a CreatePurchaseDto y crear la compra real
    const createPurchaseDto = mapPurchaseOrderToCreatePurchaseDto(
      purchaseOrder,
      receiveMerchandiseDto,
    );

    // Crear la compra (mueve stock, costo, alertas) en transacción lógica
    // userId es requerido; usar el que creó la orden si no se proporciona
    await this.purchasesService.create(createPurchaseDto, purchaseOrder.userId);

    // Marcar orden como recibida DESPUES de que la compra se guardó exitosamente
    purchaseOrder.status = PurchaseOrderStatusEnum.RECEIVED;
    purchaseOrder.receivedAt = new Date();

    const saved = await purchaseOrder.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async delete(id: string) {
    const purchaseOrder = await this.purchaseOrderModel
      .findOneAndDelete({ _id: id })
      .lean()
      .exec();

    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    return { ...purchaseOrder, id: purchaseOrder._id };
  }
}
