import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { InventoryArea } from './units';

export type WarehouseLean = Warehouse & { id: string };

@Injectable()
export class WarehousesService {
  constructor(
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
  ) {}

  private toLean(doc: Warehouse & { _id: string }): WarehouseLean {
    return { ...doc, id: String(doc._id) };
  }

  async create(dto: CreateWarehouseDto): Promise<WarehouseLean> {
    // El primer almacén de un área es default automáticamente
    const existingDefault = await this.warehouseModel
      .findOne({ area: dto.area, isDefault: true, isActive: true })
      .lean();
    const isDefault = dto.isDefault || !existingDefault;
    if (isDefault && existingDefault) {
      await this.warehouseModel.updateMany(
        { area: dto.area, isDefault: true },
        { isDefault: false },
      );
    }
    const created = await this.warehouseModel.create({ ...dto, isDefault });
    return this.toLean(created.toObject());
  }

  async findAll(): Promise<WarehouseLean[]> {
    const all = await this.warehouseModel
      .find()
      .sort({ area: 1, name: 1 })
      .lean();
    return all.map((w) => this.toLean(w));
  }

  async findById(id: string): Promise<WarehouseLean> {
    const w = await this.warehouseModel.findOne({ _id: id }).lean();
    if (!w) throw new NotFoundException(`Almacén ${id} no existe`);
    return this.toLean(w);
  }

  async findDefaultForArea(area: InventoryArea): Promise<WarehouseLean | null> {
    const w = await this.warehouseModel
      .findOne({ area, isDefault: true, isActive: true })
      .lean();
    return w ? this.toLean(w) : null;
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<WarehouseLean> {
    const current = await this.findById(id);

    if (dto.isActive === false && current.isDefault) {
      const others = await this.warehouseModel.countDocuments({
        area: current.area,
        isActive: true,
        _id: { $ne: id },
        isDefault: true,
      });
      if (others === 0) {
        throw new BadRequestException(
          'No puedes desactivar el almacén default del área. Asigna otro default primero.',
        );
      }
    }

    if (dto.isDefault === true) {
      await this.warehouseModel.updateMany(
        { area: dto.area ?? current.area, isDefault: true, _id: { $ne: id } },
        { isDefault: false },
      );
    }

    const updated = await this.warehouseModel
      .findOneAndUpdate({ _id: id }, { ...dto }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Almacén ${id} no existe`);
    return this.toLean(updated);
  }
}
