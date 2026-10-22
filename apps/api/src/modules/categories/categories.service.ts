import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const category = await this.categoryModel.create(createCategoryDto);
    const obj = category.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll() {
    const categories = await this.categoryModel.find().lean().exec();
    return categories.map((category) => ({ ...category, id: category._id }));
  }

  async findById(id: string) {
    const category = await this.categoryModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!category) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    return { ...category, id: category._id };
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoryModel
      .findOneAndUpdate({ _id: id }, updateCategoryDto, { new: true })
      .lean()
      .exec();

    if (!category) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }

    return { ...category, id: category._id };
  }

  async softDelete(id: string) {
    const category = await this.categoryModel
      .findOneAndUpdate({ _id: id }, { isActive: false }, { new: true })
      .lean()
      .exec();

    if (!category) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }

    return { ...category, id: category._id };
  }
}
