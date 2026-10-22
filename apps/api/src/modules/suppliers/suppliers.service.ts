import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Supplier, SupplierDocument } from './schemas/supplier.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private supplierModel: Model<SupplierDocument>,
  ) {}

  async findAll(filters?: { active?: boolean; productId?: string }) {
    const query: Record<string, unknown> = {};

    if (filters?.active === true) {
      query.isActive = true;
    }

    if (filters?.productId) {
      query.productIds = { $in: [filters.productId] };
    }

    const suppliers = await this.supplierModel.find(query).lean().exec();
    return suppliers.map((supplier) => ({ ...supplier, id: supplier._id }));
  }

  async findById(id: string) {
    const supplier = await this.supplierModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!supplier) {
      throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
    }
    return { ...supplier, id: supplier._id };
  }

  async create(createSupplierDto: CreateSupplierDto) {
    const supplier = new this.supplierModel(createSupplierDto);
    const saved = await supplier.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    const supplier = await this.supplierModel
      .findOneAndUpdate({ _id: id }, updateSupplierDto, { new: true })
      .lean()
      .exec();

    if (!supplier) {
      throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
    }

    return { ...supplier, id: supplier._id };
  }

  async softDelete(id: string) {
    const supplier = await this.supplierModel
      .findOneAndUpdate(
        { _id: id },
        {
          isActive: false,
          productIds: [],
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!supplier) {
      throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
    }

    return { ...supplier, id: supplier._id };
  }

  async addProductToSupplier(supplierId: string, productId: string) {
    const supplier = await this.supplierModel
      .findOne({ _id: supplierId })
      .exec();
    if (!supplier) {
      throw new NotFoundException(
        `Proveedor con id ${supplierId} no encontrado`,
      );
    }

    if (!supplier.productIds) {
      supplier.productIds = [];
    }

    if (!supplier.productIds.includes(productId)) {
      supplier.productIds.push(productId);
      await supplier.save();
    }

    const obj = supplier.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async removeProductFromSupplier(supplierId: string, productId: string) {
    const supplier = await this.supplierModel
      .findOne({ _id: supplierId })
      .exec();
    if (!supplier) {
      throw new NotFoundException(
        `Proveedor con id ${supplierId} no encontrado`,
      );
    }

    if (supplier.productIds) {
      supplier.productIds = supplier.productIds.filter(
        (id) => id !== productId,
      );
      await supplier.save();
    }

    const obj = supplier.toObject();
    return { ...obj, id: String(obj._id) };
  }
}
